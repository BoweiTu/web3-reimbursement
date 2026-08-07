/**
 * BlockReimburse 配置文件
 * 部署合约后，deploy.js 会自动更新此文件中的 CONTRACT_ADDRESS
 */

const MONAD_TESTNET = {
  chainId: '0x27b7',        // 10143 in hex
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://monad-testnet.socialscan.io/']
};

// 部署后自动填充，空值表示 Demo 模式
let CONTRACT_ADDRESS = '';

// ReimbursementManager 合约 ABI
const CONTRACT_ABI = [
  // 写入函数
  {
    type: 'function',
    name: 'submitReimbursement',
    inputs: [
      { name: 'category', type: 'string' },
      { name: 'amount', type: 'uint256' },
      { name: 'credentialHash', type: 'bytes32' },
      { name: 'ipfsHash', type: 'string' },
      { name: 'description', type: 'string' }
    ],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'departmentApprove',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'financeApprove',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'rejectReimbursement',
    inputs: [
      { name: 'id', type: 'uint256' },
      { name: 'reason', type: 'string' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'settleReimbursement',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setDepartmentHead',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'granted', type: 'bool' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'setFinanceOfficer',
    inputs: [
      { name: 'account', type: 'address' },
      { name: 'granted', type: 'bool' }
    ],
    outputs: [],
    stateMutability: 'nonpayable'
  },
  // 读取函数
  {
    type: 'function',
    name: 'getReimbursement',
    inputs: [{ name: 'id', type: 'uint256' }],
    outputs: [{
      name: '',
      type: 'tuple',
      components: [
        { name: 'id', type: 'uint256' },
        { name: 'applicant', type: 'address' },
        { name: 'category', type: 'string' },
        { name: 'amount', type: 'uint256' },
        { name: 'credentialHash', type: 'bytes32' },
        { name: 'ipfsHash', type: 'string' },
        { name: 'description', type: 'string' },
        { name: 'status', type: 'uint8' },
        { name: 'departmentHead', type: 'address' },
        { name: 'financeOfficer', type: 'address' },
        { name: 'submittedAt', type: 'uint256' },
        { name: 'departmentApprovedAt', type: 'uint256' },
        { name: 'financeApprovedAt', type: 'uint256' },
        { name: 'settledAt', type: 'uint256' },
        { name: 'rejectReason', type: 'string' },
        { name: 'rejector', type: 'address' }
      ]
    }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getTotalReimbursements',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'isCredentialUsed',
    inputs: [{ name: 'hash', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'getReimbursementIdsByStatus',
    inputs: [{ name: 'status', type: 'uint8' }],
    outputs: [{ name: '', type: 'uint256[]' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'departmentHeads',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'financeOfficers',
    inputs: [{ name: '', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view'
  },
  // 公共变量
  {
    type: 'function',
    name: 'nextId',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view'
  },
  {
    type: 'function',
    name: 'admin',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view'
  },
  // 事件
  {
    type: 'event',
    name: 'ReimbursementSubmitted',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'applicant', type: 'address', indexed: true },
      { name: 'credentialHash', type: 'bytes32', indexed: false },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'category', type: 'string', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'DepartmentApproved',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'approver', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'FinanceApproved',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'approver', type: 'address', indexed: true }
    ]
  },
  {
    type: 'event',
    name: 'ReimbursementSettled',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'financeOfficer', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'ReimbursementRejected',
    inputs: [
      { name: 'id', type: 'uint256', indexed: true },
      { name: 'rejector', type: 'address', indexed: true },
      { name: 'reason', type: 'string', indexed: false }
    ]
  }
];

// 支持浏览器和 Node.js 两种环境
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MONAD_TESTNET, CONTRACT_ADDRESS, CONTRACT_ABI };
}
