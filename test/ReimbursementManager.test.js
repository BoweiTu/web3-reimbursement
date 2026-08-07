/**
 * ReimbursementManager 合约测试
 *
 * 覆盖场景：
 *   1. 提交报销（正常提交、参数校验、事件）
 *   2. 审批流程（部门审批 → 财务审批 → 结算 完整流转）
 *   3. 重复凭证检测（同一凭证哈希不可二次提交）
 *   4. 驳回流程（部门/财务驳回、权限校验、原因校验）
 */

const { expect } = require("chai");
const { ethers } = require("hardhat");

// Status 枚举值（与合约定义一致）
const Status = {
  Pending: 0,
  DepartmentApproved: 1,
  FinanceApproved: 2,
  Settled: 3,
  Rejected: 4,
};

describe("ReimbursementManager", function () {
  let reimbursement;
  let admin, departmentHead, financeOfficer, applicant, other;

  // 辅助：根据种子字符串生成唯一的凭证哈希
  function makeCredentialHash(seed) {
    return ethers.keccak256(ethers.toUtf8Bytes(`receipt-${seed}`));
  }

  // 辅助：提交一笔报销，返回交易
  async function submitAs(applicantSigner, seed, amountEth = "1.0") {
    return reimbursement
      .connect(applicantSigner)
      .submitReimbursement(
        "差旅",
        ethers.parseEther(amountEth),
        makeCredentialHash(seed),
        `Qm${seed}`,
        `报销事由-${seed}`
      );
  }

  beforeEach(async function () {
    [admin, departmentHead, financeOfficer, applicant, other] =
      await ethers.getSigners();

    // 部署合约（admin = 部署者）
    const ReimbursementManager = await ethers.getContractFactory(
      "ReimbursementManager"
    );
    reimbursement = await ReimbursementManager.deploy();
    await reimbursement.waitForDeployment();

    // 设置角色：部门负责人、财务人员
    await reimbursement.setDepartmentHead(departmentHead.address, true);
    await reimbursement.setFinanceOfficer(financeOfficer.address, true);
  });

  // ========================================
  // 1. 提交报销测试
  // ========================================
  describe("提交报销", function () {
    it("应该成功提交报销并返回 id=0", async function () {
      const amount = ethers.parseEther("1.5");
      const credHash = makeCredentialHash("001");
      const tx = await reimbursement
        .connect(applicant)
        .submitReimbursement("差旅", amount, credHash, "Qm001", "北京出差交通费");

      await tx.wait();

      // 计数与自增 id 正确
      expect(await reimbursement.getTotalReimbursements()).to.equal(1);
      expect(await reimbursement.nextId()).to.equal(1);

      // 查询报销详情
      const r = await reimbursement.getReimbursement(0);
      expect(r.id).to.equal(0);
      expect(r.applicant).to.equal(applicant.address);
      expect(r.category).to.equal("差旅");
      expect(r.amount).to.equal(amount);
      expect(r.credentialHash).to.equal(credHash);
      expect(r.ipfsHash).to.equal("Qm001");
      expect(r.description).to.equal("北京出差交通费");
      expect(r.status).to.equal(Status.Pending);
      expect(r.submittedAt).to.be.gt(0);
    });

    it("提交报销应该触发 ReimbursementSubmitted 事件", async function () {
      const amount = ethers.parseEther("2.0");
      const credHash = makeCredentialHash("002");

      await expect(
        reimbursement
          .connect(applicant)
          .submitReimbursement("餐饮", amount, credHash, "Qm002", "客户宴请")
      )
        .to.emit(reimbursement, "ReimbursementSubmitted")
        .withArgs(0, applicant.address, credHash, amount, "餐饮");
    });

    it("凭证哈希应被标记为已使用", async function () {
      const credHash = makeCredentialHash("003");
      await submitAs(applicant, "003");

      expect(await reimbursement.isCredentialUsed(credHash)).to.equal(true);
      expect(await reimbursement.usedCredentialHashes(credHash)).to.equal(true);
    });

    it("申请人的报销索引应正确记录", async function () {
      await submitAs(applicant, "a");
      await submitAs(applicant, "b");

      const ids = await reimbursement.getApplicantReimbursements(
        applicant.address
      );
      expect(ids.length).to.equal(2);
      expect(ids[0]).to.equal(0);
      expect(ids[1]).to.equal(1);
    });

    it("金额为 0 应该 revert", async function () {
      await expect(
        reimbursement
          .connect(applicant)
          .submitReimbursement(
            "差旅",
            0,
            makeCredentialHash("zero"),
            "Qm0",
            "零金额"
          )
      ).to.be.revertedWith("ReimbursementManager: amount must be positive");
    });

    it("凭证哈希为 0 应该 revert", async function () {
      await expect(
        reimbursement
          .connect(applicant)
          .submitReimbursement(
            "差旅",
            ethers.parseEther("1"),
            ethers.ZeroHash,
            "Qm0",
            "无效哈希"
          )
      ).to.be.revertedWith("ReimbursementManager: invalid credential hash");
    });

    it("类目为空应该 revert", async function () {
      await expect(
        reimbursement
          .connect(applicant)
          .submitReimbursement(
            "",
            ethers.parseEther("1"),
            makeCredentialHash("empty"),
            "Qm0",
            "空类目"
          )
      ).to.be.revertedWith("ReimbursementManager: category cannot be empty");
    });
  });

  // ========================================
  // 2. 审批流程测试
  // ========================================
  describe("审批流程", function () {
    it("应该完成 部门审批 → 财务审批 → 结算 完整流程", async function () {
      // 提交报销
      await submitAs(applicant, "flow1", "3.0");

      // 部门审批
      const tx1 = await reimbursement
        .connect(departmentHead)
        .departmentApprove(0);
      await expect(tx1)
        .to.emit(reimbursement, "DepartmentApproved")
        .withArgs(0, departmentHead.address);

      let r = await reimbursement.getReimbursement(0);
      expect(r.status).to.equal(Status.DepartmentApproved);
      expect(r.departmentHead).to.equal(departmentHead.address);
      expect(r.departmentApprovedAt).to.be.gt(0);

      // 财务审批
      const tx2 = await reimbursement
        .connect(financeOfficer)
        .financeApprove(0);
      await expect(tx2)
        .to.emit(reimbursement, "FinanceApproved")
        .withArgs(0, financeOfficer.address);

      r = await reimbursement.getReimbursement(0);
      expect(r.status).to.equal(Status.FinanceApproved);
      expect(r.financeOfficer).to.equal(financeOfficer.address);
      expect(r.financeApprovedAt).to.be.gt(0);

      // 结算
      const tx3 = await reimbursement
        .connect(financeOfficer)
        .settleReimbursement(0);
      await expect(tx3)
        .to.emit(reimbursement, "ReimbursementSettled")
        .withArgs(0, financeOfficer.address, ethers.parseEther("3.0"));

      r = await reimbursement.getReimbursement(0);
      expect(r.status).to.equal(Status.Settled);
      expect(r.settledAt).to.be.gt(0);
    });

    it("非部门负责人不能进行部门审批", async function () {
      await submitAs(applicant, "perm1");

      await expect(
        reimbursement.connect(other).departmentApprove(0)
      ).to.be.revertedWith("ReimbursementManager: caller is not department head");
    });

    it("非财务不能进行财务审批", async function () {
      await submitAs(applicant, "perm2");
      await reimbursement.connect(departmentHead).departmentApprove(0);

      await expect(
        reimbursement.connect(other).financeApprove(0)
      ).to.be.revertedWith(
        "ReimbursementManager: caller is not finance officer"
      );
    });

    it("非财务不能进行结算", async function () {
      await submitAs(applicant, "perm3");
      await reimbursement.connect(departmentHead).departmentApprove(0);
      await reimbursement.connect(financeOfficer).financeApprove(0);

      await expect(
        reimbursement.connect(other).settleReimbursement(0)
      ).to.be.revertedWith(
        "ReimbursementManager: caller is not finance officer"
      );
    });

    it("未经过部门审批不能直接财务审批", async function () {
      await submitAs(applicant, "skip1");

      await expect(
        reimbursement.connect(financeOfficer).financeApprove(0)
      ).to.be.revertedWith(
        "ReimbursementManager: not in department-approved status"
      );
    });

    it("未经过财务审批不能直接结算", async function () {
      await submitAs(applicant, "skip2");
      await reimbursement.connect(departmentHead).departmentApprove(0);

      await expect(
        reimbursement.connect(financeOfficer).settleReimbursement(0)
      ).to.be.revertedWith(
        "ReimbursementManager: not in finance-approved status"
      );
    });
  });

  // ========================================
  // 3. 重复凭证检测测试
  // ========================================
  describe("重复凭证检测", function () {
    it("同一凭证哈希第二次提交应该 revert", async function () {
      const credHash = makeCredentialHash("dup001");
      await reimbursement
        .connect(applicant)
        .submitReimbursement(
          "差旅",
          ethers.parseEther("1"),
          credHash,
          "QmDup",
          "第一次提交"
        );

      // 不同申请人使用相同凭证哈希也应被拒绝
      await expect(
        reimbursement
          .connect(other)
          .submitReimbursement(
            "办公用品",
            ethers.parseEther("2"),
            credHash,
            "QmDup2",
            "重复凭证"
          )
      ).to.be.revertedWith(
        "ReimbursementManager: duplicate credential - this receipt has already been submitted"
      );
    });

    it("不同凭证哈希应该都能成功提交", async function () {
      await submitAs(applicant, "unique1");
      await submitAs(applicant, "unique2");
      await submitAs(applicant, "unique3");

      expect(await reimbursement.getTotalReimbursements()).to.equal(3);
      expect(await reimbursement.isCredentialUsed(makeCredentialHash("unique1"))).to.equal(true);
      expect(await reimbursement.isCredentialUsed(makeCredentialHash("unique2"))).to.equal(true);
      expect(await reimbursement.isCredentialUsed(makeCredentialHash("unique3"))).to.equal(true);
    });

    it("未使用的凭证哈希 isCredentialUsed 应返回 false", async function () {
      expect(
        await reimbursement.isCredentialUsed(makeCredentialHash("unused"))
      ).to.equal(false);
    });
  });

  // ========================================
  // 4. 驳回测试
  // ========================================
  describe("驳回流程", function () {
    it("部门负责人可以驳回 Pending 状态的报销", async function () {
      await submitAs(applicant, "reject1");

      const tx = await reimbursement
        .connect(departmentHead)
        .rejectReimbursement(0, "金额超出标准");

      await expect(tx)
        .to.emit(reimbursement, "ReimbursementRejected")
        .withArgs(0, departmentHead.address, "金额超出标准");

      const r = await reimbursement.getReimbursement(0);
      expect(r.status).to.equal(Status.Rejected);
      expect(r.rejectReason).to.equal("金额超出标准");
      expect(r.rejector).to.equal(departmentHead.address);
    });

    it("财务可以驳回 DepartmentApproved 状态的报销", async function () {
      await submitAs(applicant, "reject2");
      await reimbursement.connect(departmentHead).departmentApprove(0);

      await reimbursement
        .connect(financeOfficer)
        .rejectReimbursement(0, "凭证不清晰");

      const r = await reimbursement.getReimbursement(0);
      expect(r.status).to.equal(Status.Rejected);
      expect(r.rejector).to.equal(financeOfficer.address);
    });

    it("无权限的普通用户不能驳回", async function () {
      await submitAs(applicant, "reject3");

      await expect(
        reimbursement.connect(other).rejectReimbursement(0, "无权驳回")
      ).to.be.revertedWith("ReimbursementManager: not authorized to reject");
    });

    it("驳回原因不能为空", async function () {
      await submitAs(applicant, "reject4");

      await expect(
        reimbursement.connect(departmentHead).rejectReimbursement(0, "")
      ).to.be.revertedWith("ReimbursementManager: reason cannot be empty");
    });

    it("已结算的报销不能被驳回", async function () {
      await submitAs(applicant, "reject5");
      await reimbursement.connect(departmentHead).departmentApprove(0);
      await reimbursement.connect(financeOfficer).financeApprove(0);
      await reimbursement.connect(financeOfficer).settleReimbursement(0);

      await expect(
        reimbursement.connect(financeOfficer).rejectReimbursement(0, "已结算")
      ).to.be.revertedWith(
        "ReimbursementManager: cannot reject at current status"
      );
    });

    it("已驳回的报销不能再次驳回", async function () {
      await submitAs(applicant, "reject6");
      await reimbursement.connect(departmentHead).rejectReimbursement(0, "第一次驳回");

      await expect(
        reimbursement.connect(departmentHead).rejectReimbursement(0, "第二次驳回")
      ).to.be.revertedWith(
        "ReimbursementManager: cannot reject at current status"
      );
    });
  });

  // ========================================
  // 5. 角色管理测试（补充）
  // ========================================
  describe("角色管理", function () {
    it("admin 设置部门负责人应触发 RoleAssigned 事件", async function () {
      await expect(reimbursement.setDepartmentHead(other.address, true))
        .to.emit(reimbursement, "RoleAssigned")
        .withArgs(other.address, "departmentHead", true);

      expect(await reimbursement.departmentHeads(other.address)).to.equal(true);
    });

    it("admin 设置财务人员应触发 RoleAssigned 事件", async function () {
      await expect(reimbursement.setFinanceOfficer(other.address, true))
        .to.emit(reimbursement, "RoleAssigned")
        .withArgs(other.address, "finance", true);

      expect(await reimbursement.financeOfficers(other.address)).to.equal(true);
    });

    it("非 admin 不能设置角色", async function () {
      await expect(
        reimbursement.connect(other).setDepartmentHead(other.address, true)
      ).to.be.revertedWith("ReimbursementManager: caller is not admin");
    });

    it("admin 可以转移管理员权限", async function () {
      await expect(reimbursement.transferAdmin(other.address))
        .to.emit(reimbursement, "AdminTransferred")
        .withArgs(admin.address, other.address);

      expect(await reimbursement.admin()).to.equal(other.address);
    });

    it("不能将 admin 转移给零地址", async function () {
      await expect(
        reimbursement.transferAdmin(ethers.ZeroAddress)
      ).to.be.revertedWith("ReimbursementManager: zero address");
    });

    it("撤销角色后该用户无法再审批", async function () {
      // 撤销部门负责人权限
      await reimbursement.setDepartmentHead(departmentHead.address, false);
      expect(await reimbursement.departmentHeads(departmentHead.address)).to.equal(false);

      await submitAs(applicant, "revoke1");
      await expect(
        reimbursement.connect(departmentHead).departmentApprove(0)
      ).to.be.revertedWith(
        "ReimbursementManager: caller is not department head"
      );
    });
  });

  // ========================================
  // 6. 查询函数测试（补充）
  // ========================================
  describe("查询函数", function () {
    it("getReimbursementIdsByStatus 应正确返回对应状态的 id 列表", async function () {
      // 提交 3 笔
      await submitAs(applicant, "q1");
      await submitAs(applicant, "q2");
      await submitAs(applicant, "q3");

      // 审批第 1 笔到 DepartmentApproved
      await reimbursement.connect(departmentHead).departmentApprove(0);

      // 驳回第 3 笔
      await reimbursement.connect(departmentHead).rejectReimbursement(2, "不合规");

      const pending = await reimbursement.getReimbursementIdsByStatus(Status.Pending);
      expect(pending.length).to.equal(1);
      expect(pending[0]).to.equal(1);

      const deptApproved = await reimbursement.getReimbursementIdsByStatus(
        Status.DepartmentApproved
      );
      expect(deptApproved.length).to.equal(1);
      expect(deptApproved[0]).to.equal(0);

      const rejected = await reimbursement.getReimbursementIdsByStatus(
        Status.Rejected
      );
      expect(rejected.length).to.equal(1);
      expect(rejected[0]).to.equal(2);
    });

    it("查询不存在的 id 应该 revert", async function () {
      await expect(reimbursement.getReimbursement(999)).to.be.revertedWith(
        "ReimbursementManager: invalid id"
      );
    });
  });
});
