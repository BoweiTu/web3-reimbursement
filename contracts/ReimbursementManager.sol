// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title ReimbursementManager
 * @notice Web3 区块链报销全流程工作流智能合约
 * @dev 部署在 Monad 测试网上，实现报销提交、多级审批、结算、防重复、审计功能
 *
 * 工作流程：
 *   员工提交报销(Pending) → 部门负责人审批(DepartmentApproved) → 财务审批(FinanceApproved) → 结算(Settled)
 *   任意审批环节可驳回(Rejected)，驳回后不可修改原申请，只能新建
 *
 * 安全特性：
 *   - 凭证哈希唯一性校验，防止同一张发票重复报销
 *   - 审批轨迹全部上链，不可篡改、不可删除
 *   - 角色权限控制（管理员、部门负责人、财务）
 */
contract ReimbursementManager {

    // ============ 状态枚举 ============
    enum Status {
        Pending,            // 0 - 待部门审批
        DepartmentApproved, // 1 - 部门已审批，待财务审批
        FinanceApproved,    // 2 - 财务已审批，待结算
        Settled,            // 3 - 已结算
        Rejected            // 4 - 已驳回
    }

    // ============ 数据结构 ============
    struct Reimbursement {
        uint256 id;
        address applicant;         // 报销申请人钱包地址
        string  category;          // 报销类目（差旅、餐饮、办公用品等）
        uint256 amount;            // 报销金额（单位：wei）
        bytes32 credentialHash;    // 凭证哈希摘要（发票/小票的 SHA-256）
        string  ipfsHash;          // IPFS CID（原始凭证文件存储地址）
        string  description;       // 报销事由说明
        Status  status;            // 当前审批状态
        address departmentHead;    // 部门审批人地址
        address financeOfficer;    // 财务审批人地址
        uint256 submittedAt;       // 提交时间戳
        uint256 departmentApprovedAt; // 部门审批时间戳
        uint256 financeApprovedAt;    // 财务审批时间戳
        uint256 settledAt;         // 结算时间戳
        string  rejectReason;      // 驳回原因
        address rejector;          // 驳回人地址
    }

    // ============ 状态变量 ============
    uint256 public nextId;
    address public admin;

    mapping(uint256 => Reimbursement) private reimbursements;
    mapping(bytes32 => bool) public usedCredentialHashes; // 凭证哈希去重
    mapping(address => bool) public departmentHeads;      // 部门负责人白名单
    mapping(address => bool) public financeOfficers;      // 财务人员白名单
    mapping(address => uint256[]) public reimbursementsByApplicant; // 按申请人索引

    // ============ 事件 ============
    event ReimbursementSubmitted(uint256 indexed id, address indexed applicant, bytes32 credentialHash, uint256 amount, string category);
    event DepartmentApproved(uint256 indexed id, address indexed approver);
    event FinanceApproved(uint256 indexed id, address indexed approver);
    event ReimbursementSettled(uint256 indexed id, address indexed financeOfficer, uint256 amount);
    event ReimbursementRejected(uint256 indexed id, address indexed rejector, string reason);
    event RoleAssigned(address indexed account, string role, bool granted);
    event AdminTransferred(address indexed previousAdmin, address indexed newAdmin);

    // ============ 修饰器 ============
    modifier onlyAdmin() {
        require(msg.sender == admin, "ReimbursementManager: caller is not admin");
        _;
    }
    modifier onlyDepartmentHead() {
        require(departmentHeads[msg.sender], "ReimbursementManager: caller is not department head");
        _;
    }
    modifier onlyFinance() {
        require(financeOfficers[msg.sender], "ReimbursementManager: caller is not finance officer");
        _;
    }

    // ============ 构造函数 ============
    constructor() {
        admin = msg.sender;
        emit AdminTransferred(address(0), msg.sender);
    }

    // ============ 角色管理 ============

    function setDepartmentHead(address account, bool granted) external onlyAdmin {
        departmentHeads[account] = granted;
        emit RoleAssigned(account, "departmentHead", granted);
    }

    function setFinanceOfficer(address account, bool granted) external onlyAdmin {
        financeOfficers[account] = granted;
        emit RoleAssigned(account, "finance", granted);
    }

    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "ReimbursementManager: zero address");
        emit AdminTransferred(admin, newAdmin);
        admin = newAdmin;
    }

    // ============ 核心业务流程 ============

    /**
     * @notice 员工提交报销申请
     * @param category   报销类目
     * @param amount     报销金额（wei）
     * @param credentialHash 凭证哈希摘要
     * @param ipfsHash   IPFS CID
     * @param description 报销事由
     */
    function submitReimbursement(
        string calldata category,
        uint256 amount,
        bytes32 credentialHash,
        string calldata ipfsHash,
        string calldata description
    ) external returns (uint256) {
        require(amount > 0, "ReimbursementManager: amount must be positive");
        require(credentialHash != bytes32(0), "ReimbursementManager: invalid credential hash");
        require(!usedCredentialHashes[credentialHash], "ReimbursementManager: duplicate credential - this receipt has already been submitted");
        require(bytes(category).length > 0, "ReimbursementManager: category cannot be empty");

        uint256 id = nextId++;
        bytes32 credHash = credentialHash;
        usedCredentialHashes[credHash] = true;

        reimbursements[id] = Reimbursement({
            id: id,
            applicant: msg.sender,
            category: category,
            amount: amount,
            credentialHash: credHash,
            ipfsHash: ipfsHash,
            description: description,
            status: Status.Pending,
            departmentHead: address(0),
            financeOfficer: address(0),
            submittedAt: block.timestamp,
            departmentApprovedAt: 0,
            financeApprovedAt: 0,
            settledAt: 0,
            rejectReason: "",
            rejector: address(0)
        });

        reimbursementsByApplicant[msg.sender].push(id);

        emit ReimbursementSubmitted(id, msg.sender, credHash, amount, category);
        return id;
    }

    /**
     * @notice 部门负责人审批通过
     */
    function departmentApprove(uint256 id) external onlyDepartmentHead {
        Reimbursement storage r = reimbursements[id];
        require(r.status == Status.Pending, "ReimbursementManager: not in pending status");

        r.status = Status.DepartmentApproved;
        r.departmentHead = msg.sender;
        r.departmentApprovedAt = block.timestamp;

        emit DepartmentApproved(id, msg.sender);
    }

    /**
     * @notice 财务审批通过
     */
    function financeApprove(uint256 id) external onlyFinance {
        Reimbursement storage r = reimbursements[id];
        require(r.status == Status.DepartmentApproved, "ReimbursementManager: not in department-approved status");

        r.status = Status.FinanceApproved;
        r.financeOfficer = msg.sender;
        r.financeApprovedAt = block.timestamp;

        emit FinanceApproved(id, msg.sender);
    }

    /**
     * @notice 驳回报销申请（部门负责人或财务均可驳回）
     */
    function rejectReimbursement(uint256 id, string calldata reason) external {
        Reimbursement storage r = reimbursements[id];
        require(
            r.status == Status.Pending || r.status == Status.DepartmentApproved,
            "ReimbursementManager: cannot reject at current status"
        );
        require(
            departmentHeads[msg.sender] || financeOfficers[msg.sender],
            "ReimbursementManager: not authorized to reject"
        );
        require(bytes(reason).length > 0, "ReimbursementManager: reason cannot be empty");

        r.status = Status.Rejected;
        r.rejectReason = reason;
        r.rejector = msg.sender;

        emit ReimbursementRejected(id, msg.sender, reason);
    }

    /**
     * @notice 财务结算（标记报销已打款）
     * @dev 实际转账通过链下传统对公转账完成，链上仅记录结算状态
     */
    function settleReimbursement(uint256 id) external onlyFinance {
        Reimbursement storage r = reimbursements[id];
        require(r.status == Status.FinanceApproved, "ReimbursementManager: not in finance-approved status");

        r.status = Status.Settled;
        r.settledAt = block.timestamp;

        emit ReimbursementSettled(id, msg.sender, r.amount);
    }

    // ============ 查询函数 ============

    function getReimbursement(uint256 id) external view returns (Reimbursement memory) {
        require(id < nextId, "ReimbursementManager: invalid id");
        return reimbursements[id];
    }

    function getTotalReimbursements() external view returns (uint256) {
        return nextId;
    }

    function isCredentialUsed(bytes32 hash) external view returns (bool) {
        return usedCredentialHashes[hash];
    }

    function getApplicantReimbursements(address applicant) external view returns (uint256[] memory) {
        return reimbursementsByApplicant[applicant];
    }

    function getReimbursementIdsByStatus(Status status) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < nextId; i++) {
            if (reimbursements[i].status == status) {
                count++;
            }
        }
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < nextId; i++) {
            if (reimbursements[i].status == status) {
                result[idx] = i;
                idx++;
            }
        }
        return result;
    }
}
