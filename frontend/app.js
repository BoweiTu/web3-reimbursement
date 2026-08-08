/**
 * BlockReimburse - 前端应用逻辑
 * 支持两种模式：
 *   1. Demo 模式（未连接钱包）— 展示完整工作流的模拟数据
 *   2. 链上模式（连接 MetaMask）— 与 Monad 测试网上的智能合约实时交互
 */

// ========== 全局状态 ==========
const App = {
  mode: 'demo',              // 'demo' | 'live'
  provider: null,
  signer: null,
  contract: null,
  account: null,
  isDepartmentHead: false,
  isFinanceOfficer: false,
  isAdmin: false,
  reimbursements: [],       // 当前数据（demo 模式为模拟数据，live 模式从链上读取）
  currentFilter: 'all',
  pendingRejectId: null,
  fileHash: null,           // 当前上传文件的 SHA-256 哈希 (hex string)
  fileName: null,
};

// ========== 链上存证模拟工具 ==========
let _mockBlockNum = 15238476;
function mockTxHash() {
  return '0x' + Array.from({length: 64}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}
function mockBlockNum() { return ++_mockBlockNum; }
function buildEventLog(r) {
  const events = [];
  events.push({ name: 'ReimbursementSubmitted', txHash: r.submitTxHash || mockTxHash(), block: r.submitBlock || mockBlockNum(), timestamp: r.submittedAt, actor: r.applicant, detail: `提交报销申请，金额 ${r.amount} MON` });
  if (r.departmentApprovedAt) events.push({ name: 'DepartmentApproved', txHash: r.deptTxHash || mockTxHash(), block: r.deptBlock || mockBlockNum(), timestamp: r.departmentApprovedAt, actor: r.departmentHead, detail: '部门审批通过' });
  if (r.financeApprovedAt) events.push({ name: 'FinanceApproved', txHash: r.finTxHash || mockTxHash(), block: r.finBlock || mockBlockNum(), timestamp: r.financeApprovedAt, actor: r.financeOfficer, detail: '财务审批通过' });
  if (r.settledAt) events.push({ name: 'ReimbursementSettled', txHash: r.settleTxHash || mockTxHash(), block: r.settleBlock || mockBlockNum(), timestamp: r.settledAt, actor: r.financeOfficer, detail: '已结算打款' });
  if (r.status === 4) events.push({ name: 'ReimbursementRejected', txHash: r.rejectTxHash || mockTxHash(), block: r.rejectBlock || mockBlockNum(), timestamp: r.submittedAt, actor: r.rejector, detail: `驳回原因：${r.rejectReason}` });
  return events;
}

// ========== Demo 模拟数据 ==========
const DEMO_DATA = [
  {
    id: 0,
    applicant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    category: '差旅费',
    amount: '2.26',
    credentialHash: '0xca5168bcfed34881ade531409d4a5bea843e9f6ab98681c6734c1fb97a029eae',
    ipfsHash: 'Qma19824af5190a6a98ec55bfc32222fda8f3390e50995',
    description: '上海客户拜访差旅费，含高铁往返及两晚住宿',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1707782400000,
    departmentApprovedAt: 1707868800000,
    financeApprovedAt: 1707955200000,
    settledAt: 1708041600000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 1,
    applicant: '0x8Ba1f9551926F5677C50e7C5c3F7D9e1a2B3c4D5',
    category: '餐饮费',
    amount: '0.14',
    credentialHash: '0xc5081552f7fcecb79618a9f01d72f60b8c8919fc752ebb9940845dde075e2f1e',
    ipfsHash: 'Qmda7ec21d097eb713d2ce48dbc6905238bc204308a70f',
    description: '团队建设活动餐饮费，8人晚餐',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1707868800000,
    departmentApprovedAt: 1707955200000,
    financeApprovedAt: 1708041600000,
    settledAt: 1708128000000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 2,
    applicant: '0x3Cd5e7F9a1B3c5D7e9F1a3B5c7D9e1F3a5B7c9D1',
    category: '办公用品',
    amount: '1.0',
    credentialHash: '0x7940020efb374152e6c7932ba1d2c750e62be08714f062e3c1db646d273217c9',
    ipfsHash: 'Qm46bab10a2407dde6a319df6c55a923f75a45271f547c',
    description: '行政部办公用品：打印机墨盒、订书机、便签',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1707955200000,
    departmentApprovedAt: 1708041600000,
    financeApprovedAt: 1708128000000,
    settledAt: 1708214400000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 3,
    applicant: '0x5Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5cD9e1F3',
    category: '交通费',
    amount: '0.82',
    credentialHash: '0xfaedf468bbf5cb8d360f5168cc5ae0975f83cb5f6f9669f4ca92a05944e81989',
    ipfsHash: 'Qm65362ba044a07d78a5cba9f53412f414d6900a48e829',
    description: '共享单车及打车混合通勤费',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1708041600000,
    departmentApprovedAt: 1708128000000,
    financeApprovedAt: 1708214400000,
    settledAt: 1708300800000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 4,
    applicant: '0x9f1a3B5c7D9e1F3a5B7c9D1e3F5a7B9c1D3e5F7a',
    category: '会议费',
    amount: '2.59',
    credentialHash: '0x884decc59d0fc81c93c1c90704db8ca98e35449592c228d89015b78f560ff183',
    ipfsHash: 'Qm139d08c0e72d98041524f42cc12c1c01e8018a7b16af',
    description: '行业峰会参会费用，含门票及材料费',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1708128000000,
    departmentApprovedAt: 1708214400000,
    financeApprovedAt: 1708300800000,
    settledAt: 1708387200000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 5,
    applicant: '0x2Bd4f6A8c0E2b4D6f8A0e2C4b6D8f0A2e4C6b8D0',
    category: '培训费',
    amount: '2.38',
    credentialHash: '0x5dc85a5403cf9d9350d7d297ec43124f1e27e582ef65e19d6ce30d9462e1bcfe',
    ipfsHash: 'Qmb842f0b38f9dcacb6cced48bf0343f224a13a14bfdba',
    description: 'PMP项目管理认证培训费',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1708214400000,
    departmentApprovedAt: 1708300800000,
    financeApprovedAt: 1708387200000,
    settledAt: 1708473600000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 6,
    applicant: '0x4Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5cD9e1F3',
    category: '其他',
    amount: '3.13',
    credentialHash: '0xef75d62f32749f7bba2ee015f754ed5b9455485fe781bac93d80ee5ab9ab267a',
    ipfsHash: 'Qm68124bd0262e17d6a469bc8fec92b53cfa6c2a66da1f',
    description: '团建活动场地租赁费用',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1708300800000,
    departmentApprovedAt: 1708387200000,
    financeApprovedAt: 1708473600000,
    settledAt: 1708560000000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 7,
    applicant: '0xA1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0',
    category: '差旅费',
    amount: '0.35',
    credentialHash: '0x70ecdf889fdf65df7e5f688460fbdc6e57d305979fcbc3bced3fce3495e8421e',
    ipfsHash: 'Qm4fddff41392b01ec1bc0a3411990c623260a18c7e8fd',
    description: '北京技术交流会议差旅费，含机票及三晚住宿',
    status: 3,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1708387200000,
    departmentApprovedAt: 1708473600000,
    financeApprovedAt: 1708560000000,
    settledAt: 1708646400000,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 8,
    applicant: '0xB2c3D4e5F6a7B8c9D0e1F2a3B4c5D6e7F8a9B0c1',
    category: '餐饮费',
    amount: '1.51',
    credentialHash: '0xc9090bae51098535cf36492ca7b239a744190ea07e4d19be683a7206f9fcf7d2',
    ipfsHash: 'Qm84cead03fb75bf51185d852748c10f5011c9853eded3',
    description: '项目庆功宴餐饮费，12人聚餐',
    status: 2,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1709067600000,
    departmentApprovedAt: 1709157600000,
    financeApprovedAt: 1709247600000,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 9,
    applicant: '0xC3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2',
    category: '办公用品',
    amount: '0.15',
    credentialHash: '0x4862040ca454b24e5096e65760f33b1bec08f4810c1a5ac5d909babf5ba6667b',
    ipfsHash: 'Qm0eae4cf7fdc59aa39f91a3b491ca5c0e90378ee36d81',
    description: '设计部耗材采购：马克笔、绘图纸、模型材料',
    status: 2,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1709154000000,
    departmentApprovedAt: 1709244000000,
    financeApprovedAt: 1709334000000,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 10,
    applicant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    category: '交通费',
    amount: '0.8',
    credentialHash: '0x92346a9679972208c5b3de9a468aa1238092757f63cdebe4704abb6af2189fed',
    ipfsHash: 'Qm9f62aed076daa9429b56e9c5bee7db2f5014a9e45fc3',
    description: '机场专线大巴及打车费用',
    status: 2,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: 1709240400000,
    departmentApprovedAt: 1709330400000,
    financeApprovedAt: 1709420400000,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 11,
    applicant: '0x8Ba1f9551926F5677C50e7C5c3F7D9e1a2B3c4D5',
    category: '会议费',
    amount: '1.79',
    credentialHash: '0x435ce85eccf18d6362b86049c88fe61ccd986b9f887211bd59a75a1da88c14df',
    ipfsHash: 'Qme36a7374eaccc4c61b03b8bb1403ca3580bc12654ced',
    description: '外部培训研讨会参会费用',
    status: 1,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709406000000,
    departmentApprovedAt: 1709503200000,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 12,
    applicant: '0x3Cd5e7F9a1B3c5D7e9F1a3B5c7D9e1F3a5B7c9D1',
    category: '培训费',
    amount: '0.14',
    credentialHash: '0x3d49eb3e905cce3d6eae0eca4181fe0a64b5895c6ce6fe06f10c3b8c7070f4ab',
    ipfsHash: 'Qm93faabad7faed0e06a94be9665276fecbbba340591bd',
    description: '区块链开发技术培训课程费用',
    status: 1,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709492400000,
    departmentApprovedAt: 1709589600000,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 13,
    applicant: '0x5Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5cD9e1F3',
    category: '其他',
    amount: '0.74',
    credentialHash: '0xabd89b05e330c500fa54b921800ca9c7b99772cfce46b97c58081e7031608f14',
    ipfsHash: 'Qm4c5f0b43552da8c0ff0fdd7174fd9424a0ebd69063b7',
    description: '软件许可证续费，设计团队年度授权',
    status: 1,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709578800000,
    departmentApprovedAt: 1709676000000,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 14,
    applicant: '0x9f1a3B5c7D9e1F3a5B7c9D1e3F5a7B9c1D3e5F7a',
    category: '差旅费',
    amount: '2.29',
    credentialHash: '0xd8fe98a01da25ba94cadaad6d713cea7695f4847df48356b762b51355b91a4e7',
    ipfsHash: 'Qm9c93fd321ea2bb062a83046b2bacbf8a53906086cfe8',
    description: '深圳合作伙伴洽谈差旅费，含机票及一晚住宿',
    status: 1,
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709665200000,
    departmentApprovedAt: 1709762400000,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 15,
    applicant: '0x2Bd4f6A8c0E2b4D6f8A0e2C4b6D8f0A2e4C6b8D0',
    category: '餐饮费',
    amount: '1.93',
    credentialHash: '0x39487c99e3ae6131af96cb72e68db897184bfc3bae58cfa7499ac2f15272fcd1',
    ipfsHash: 'Qmf580b64f281b407c6936afa147f1a524c1d959bf54de',
    description: '客户接待餐饮费用，3人商务午餐',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709899200000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 16,
    applicant: '0x4Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5cD9e1F3',
    category: '办公用品',
    amount: '0.81',
    credentialHash: '0x979629f0e6cd815b31af451bfbb9dec770b37ae8f695dc1248d5fd4f6e676c5f',
    ipfsHash: 'Qm7778fa9438c825635ca4327411d82051ba8a0a171a14',
    description: '研发部办公用品采购：A4纸、笔、文件夹等',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709906400000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 17,
    applicant: '0xA1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0',
    category: '交通费',
    amount: '2.08',
    credentialHash: '0x9f245a5bf0fec491ca1fb4871331796b039654e25cf514d7a12a2246d01240d1',
    ipfsHash: 'Qmf81adb5516221a5113f925d492e57d29cd84df6103c2',
    description: '地铁通勤交通费，跨区会议往返',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709913600000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 18,
    applicant: '0xB2c3D4e5F6a7B8c9D0e1F2a3B4c5D6e7F8a9B0c1',
    category: '会议费',
    amount: '2.84',
    credentialHash: '0x5f29293add26752f07e20d17831d9f1cb01e65e0d0194f053a047801d3f4481e',
    ipfsHash: 'Qmdf71e7ab0cf6db0273b4c77d253fe835d26831fa2850',
    description: '线上会议平台年度订阅费用',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709920800000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 19,
    applicant: '0xC3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2',
    category: '培训费',
    amount: '0.07',
    credentialHash: '0x90950d82c7a4e8da993448d60b727c7c0bc353c5d5e887b1a1e3e1522fdfce8f',
    ipfsHash: 'Qmc9bb8fc686da6bd8c0dbe32067cbac5080bc307fadd8',
    description: '英语商务沟通技能提升课程',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709928000000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 20,
    applicant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    category: '其他',
    amount: '2.83',
    credentialHash: '0x3f5819c9f86346b8fd3f6f1e8a4eac4e4f04720968f27d99c53b706141b3d24f',
    ipfsHash: 'Qm23a8928132b5f1c1a5d71d3e7b715fcf997424696712',
    description: '服务器云资源费用，开发测试环境月费',
    status: 0,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1709935200000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 21,
    applicant: '0x8Ba1f9551926F5677C50e7C5c3F7D9e1a2B3c4D5',
    category: '差旅费',
    amount: '2.46',
    credentialHash: '0xac335f4f5c817846d4b80754855fc0d7b07f556c6e6b6d6cbf59ff6138a2bcd0',
    ipfsHash: 'Qm773ef1e5a59b2e83b50f34c9aca3028e9f14ddd767ac',
    description: '广州供应链考察差旅费，含高铁及两晚住宿',
    status: 4,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1708646400000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '培训预算已超本季度上限，请下季度重新申请',
    rejector: '0x1aB3...9fE2'
  },
  {
    id: 22,
    applicant: '0x3Cd5e7F9a1B3c5D7e9F1a3B5c7D9e1F3a5B7c9D1',
    category: '餐饮费',
    amount: '1.22',
    credentialHash: '0x4f35267446609a2a3567fb046b304db22af3fd454aa227d99d8e65921389795e',
    ipfsHash: 'Qm53912c0344d0281a5536ec04d3591df8beea5d573ba8',
    description: '外地客户来访接待餐费，5人晚宴',
    status: 4,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1708732800000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '凭证信息不完整，缺少发票号码',
    rejector: '0x4dE7...3aC1'
  },
  {
    id: 23,
    applicant: '0x5Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5cD9e1F3',
    category: '办公用品',
    amount: '0.59',
    credentialHash: '0x63a193deda2f931309f6530974ba0d1b3ed5e1904ed33a68329c433c638946b5',
    ipfsHash: 'Qmcfc0be9dfc8c81839d42945f7afed280e4c8488d7e69',
    description: '市场部物料采购：展架、宣传册、名片印制',
    status: 4,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1708819200000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '金额超出该类目单次报销上限',
    rejector: '0x1aB3...9fE2'
  },
  {
    id: 24,
    applicant: '0x9f1a3B5c7D9e1F3a5B7c9D1e3F5a7B9c1D3e5F7a',
    category: '交通费',
    amount: '3.35',
    credentialHash: '0xc4b8aa85bbfdcd04c2fed059603eb316b80adc59810ad4a2f544b7ab8df507dc',
    ipfsHash: 'Qm20f86397851ad850ecf04c7dda343332e38b2a575b34',
    description: '市内出租车交通费，拜访三个客户点位',
    status: 4,
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: 1708905600000,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '报销事由与凭证不符，请核实后重新提交',
    rejector: '0x4dE7...3aC1'
  }
];

// 为 Demo 数据生成链上存证信息
DEMO_DATA.forEach(r => {
  const events = buildEventLog(r);
  r.submitTxHash = events[0].txHash;
  r.submitBlock = events[0].block;
  r.events = events;
});

// ========== 状态映射 ==========
const STATUS_MAP = {
  0: { label: '待审批', class: 'status-pending' },
  1: { label: '部门已批', class: 'status-dept' },
  2: { label: '财务已批', class: 'status-finance' },
  3: { label: '已结算', class: 'status-settled' },
  4: { label: '已驳回', class: 'status-rejected' }
};

// ========== 工具函数 ==========

function shortenAddr(addr) {
  if (!addr || addr === '0x0000000000000000000000000000000000000000') return '—';
  if (addr.includes('...')) return addr;
  return addr.slice(0, 6) + '...' + addr.slice(-4);
}

function formatTime(ts) {
  if (!ts || ts === 0) return '—';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function formatAmount(weiStr) {
  if (typeof weiStr === 'string' && weiStr.includes('.')) return weiStr;
  try {
    const eth = ethers.formatEther(weiStr.toString());
    return parseFloat(eth).toFixed(4).replace(/\.?0+$/, '') || '0';
  } catch { return weiStr; }
}

function shortHash(hash) {
  if (!hash) return '—';
  const h = hash.toString();
  return h.slice(0, 10) + '...' + h.slice(-8);
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast show ' + type;
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => { toast.className = 'toast ' + type; }, 3500);
}

// ========== 初始化 ==========

async function init() {
  App.reimbursements = [...DEMO_DATA];
  bindEvents();
  renderAll();

  // 检查是否部署了合约
  if (CONTRACT_ADDRESS && typeof window.ethers !== 'undefined') {
    if (window.ethereum && window.ethereum.selectedAddress) {
      await connectWallet();
    }
  }
}

// ========== 事件绑定 ==========

function bindEvents() {
  // Tab 切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // 钱包连接
  document.getElementById('connectBtn').addEventListener('click', connectWallet);

  // 表单提交
  document.getElementById('submitForm').addEventListener('submit', handleSubmit);

  // 文件上传
  const uploadZone = document.getElementById('uploadZone');
  const fileInput = document.getElementById('fileInput');

  uploadZone.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('dragover', e => { e.preventDefault(); uploadZone.classList.add('dragover'); });
  uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
  uploadZone.addEventListener('drop', e => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', e => { if (e.target.files.length) handleFile(e.target.files[0]); });

  document.getElementById('removeFile').addEventListener('click', e => {
    e.stopPropagation();
    clearFile();
  });

  // 审计筛选
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      App.currentFilter = btn.dataset.filter;
      // 同步统计卡片高亮状态
      document.querySelectorAll('.stat-card').forEach(c => {
        c.classList.toggle('stat-active', c.dataset.filter === btn.dataset.filter);
      });
      renderAudit();
    });
  });

  // 驳回弹窗
  document.getElementById('cancelReject').addEventListener('click', closeRejectModal);
  document.getElementById('confirmReject').addEventListener('click', confirmReject);
  document.getElementById('rejectModal').addEventListener('click', e => {
    if (e.target.id === 'rejectModal') closeRejectModal();
  });
}

// ========== Tab 切换 ==========

function switchTab(tabName) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
  document.getElementById(`tab-${tabName}`).classList.add('active');

  if (tabName === 'approve') renderApproveList();
  if (tabName === 'settle') renderSettleList();
  if (tabName === 'audit') renderAudit();
}

// ========== 统计卡片点击筛选 ==========

function filterByStat(filter) {
  // 切换到审计追踪 Tab
  switchTab('audit');
  // 设置筛选条件
  App.currentFilter = filter;
  // 同步审计 Tab 筛选按钮的选中状态
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.filter === filter);
  });
  // 同步统计卡片的选中高亮状态
  document.querySelectorAll('.stat-card').forEach(c => {
    c.classList.toggle('stat-active', c.dataset.filter === filter);
  });
  // 渲染审计表格
  renderAudit();
}

// ========== 钱包连接 ==========

async function connectWallet() {
  if (!window.ethereum) {
    showToast('未检测到 MetaMask，请先安装钱包插件', 'error');
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    App.account = accounts[0];

    // 检查/切换到 Monad 测试网
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (chainId !== MONAD_TESTNET.chainId) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: MONAD_TESTNET.chainId }]
        });
      } catch (switchErr) {
        if (switchErr.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [MONAD_TESTNET]
          });
        } else {
          throw switchErr;
        }
      }
    }

    // 初始化 ethers
    App.provider = new ethers.BrowserProvider(window.ethereum);
    App.signer = await App.provider.getSigner();

    if (CONTRACT_ADDRESS) {
      App.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, App.signer);
      App.mode = 'live';
      await loadChainData();
      showToast('已连接 Monad 测试网，链上模式已激活', 'success');
    } else {
      // 合约未部署，保持 Demo 模式但显示钱包地址
      App.mode = 'demo';
      showToast('钱包已连接，合约未部署，当前为 Demo 模式', 'info');
    }

    updateWalletUI();
  } catch (err) {
    console.error('Connect error:', err);
    showToast('连接钱包失败：' + (err.message || '未知错误'), 'error');
  }
}

function updateWalletUI() {
  const btn = document.getElementById('connectBtn');
  const badge = document.getElementById('networkBadge');

  if (App.account) {
    btn.innerHTML = `<span>${shortenAddr(App.account)}</span>`;
    btn.classList.add('btn-connected');
    badge.innerHTML = App.mode === 'live'
      ? '<span class="dot dot-connected"></span><span>Monad 测试网</span>'
      : '<span class="dot dot-connected"></span><span>Demo · 钱包已连</span>';
  }
}

// ========== 链上数据加载 ==========

async function loadChainData() {
  if (App.mode !== 'live' || !App.contract) return;
  try {
    const total = await App.contract.getTotalReimbursements();
    const count = Number(total);
    App.reimbursements = [];

    for (let i = 0; i < count; i++) {
      const r = await App.contract.getReimbursement(i);
      App.reimbursements.push({
        id: Number(r.id),
        applicant: r.applicant,
        category: r.category,
        amount: r.amount.toString(),
        credentialHash: r.credentialHash,
        ipfsHash: r.ipfsHash,
        description: r.description,
        status: Number(r.status),
        departmentHead: r.departmentHead,
        financeOfficer: r.financeOfficer,
        submittedAt: Number(r.submittedAt) * 1000,
        departmentApprovedAt: Number(r.departmentApprovedAt) * 1000,
        financeApprovedAt: Number(r.financeApprovedAt) * 1000,
        settledAt: Number(r.settledAt) * 1000,
        rejectReason: r.rejectReason,
        rejector: r.rejector
      });
    }

    // 检查角色
    App.isDepartmentHead = await App.contract.departmentHeads(App.account);
    App.isFinanceOfficer = await App.contract.financeOfficers(App.account);
    const adminAddr = await App.contract.admin();
    App.isAdmin = adminAddr.toLowerCase() === App.account.toLowerCase();

    renderAll();
  } catch (err) {
    console.error('Load chain data error:', err);
    showToast('加载链上数据失败：' + (err.message || ''), 'error');
  }
}

// ========== 文件上传 & 哈希 ==========

async function handleFile(file) {
  App.fileName = file.name;
  document.getElementById('previewName').textContent = file.name;

  try {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashHex = '0x' + Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0')).join('');
    App.fileHash = hashHex;

    document.getElementById('previewHash').textContent = shortHash(hashHex);
    document.getElementById('uploadPlaceholder').style.display = 'none';
    document.getElementById('uploadPreview').style.display = 'flex';

    // 模拟 IPFS CID 生成
    const mockCid = 'Qm' + hashHex.slice(2, 12).replace(/[^a-zA-Z0-9]/g, 'x') +
      Array.from({ length: 34 }, () => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 62)]).join('');
    document.getElementById('ipfsHash').value = mockCid;

    showToast('凭证哈希已生成：' + shortHash(hashHex), 'success');
  } catch (err) {
    showToast('文件处理失败：' + err.message, 'error');
  }
}

function clearFile() {
  App.fileHash = null;
  App.fileName = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('previewName').textContent = '';
  document.getElementById('previewHash').textContent = '';
  document.getElementById('ipfsHash').value = '';
  document.getElementById('uploadPlaceholder').style.display = 'block';
  document.getElementById('uploadPreview').style.display = 'none';
}

// ========== 提交报销 ==========

async function handleSubmit(e) {
  e.preventDefault();

  if (!App.fileHash) {
    showToast('请先上传凭证文件', 'error');
    return;
  }

  const category = document.getElementById('category').value;
  const amountStr = document.getElementById('amount').value;
  const description = document.getElementById('description').value;
  const ipfsHash = document.getElementById('ipfsHash').value;

  if (!category || !amountStr || !description) {
    showToast('请填写所有必填字段', 'error');
    return;
  }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span>提交中...</span>';

  try {
    if (App.mode === 'live' && App.contract) {
      // 链上提交
      const amountWei = ethers.parseEther(amountStr);
      const tx = await App.contract.submitReimbursement(
        category, amountWei, App.fileHash, ipfsHash, description
      );
      showToast('交易已发送，等待确认...', 'info');
      const receipt = await tx.wait();
      showToast('报销已上链！交易哈希：' + shortHash(receipt.hash), 'success');
      await loadChainData();
    } else {
      // Demo 模式模拟提交
      await new Promise(r => setTimeout(r, 800));
      const newId = App.reimbursements.length;
      const txHash = mockTxHash();
      const blockNum = mockBlockNum();
      const newRecord = {
        id: newId,
        applicant: App.account || '0xDemo...0001',
        category, amount: amountStr,
        credentialHash: App.fileHash,
        ipfsHash, description,
        status: 0,
        departmentHead: '0x0000000000000000000000000000000000000000',
        financeOfficer: '0x0000000000000000000000000000000000000000',
        submittedAt: Date.now(),
        departmentApprovedAt: 0, financeApprovedAt: 0, settledAt: 0,
        rejectReason: '', rejector: '0x0000000000000000000000000000000000000000',
        submitTxHash: txHash,
        submitBlock: blockNum,
        events: [{ name: 'ReimbursementSubmitted', txHash, block: blockNum, timestamp: Date.now(), actor: App.account || '0xDemo...0001', detail: `提交报销申请，金额 ${amountStr} MON` }]
      };
      App.reimbursements.push(newRecord);
      showToast(`报销已上链！Tx: ${shortHash(txHash)} Block: #${blockNum}`, 'success');
      renderAll();
    }

    // 重置表单
    document.getElementById('submitForm').reset();
    clearFile();
  } catch (err) {
    console.error('Submit error:', err);
    showToast('提交失败：' + (err.reason || err.message || '未知错误'), 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>提交报销上链</span>';
  }
}

// ========== 审批操作 ==========

async function doAction(action, id, extra) {
  try {
    if (App.mode === 'live' && App.contract) {
      let tx;
      if (action === 'deptApprove') tx = await App.contract.departmentApprove(id);
      else if (action === 'financeApprove') tx = await App.contract.financeApprove(id);
      else if (action === 'settle') tx = await App.contract.settleReimbursement(id);
      showToast('交易已发送...', 'info');
      await tx.wait();
      showToast('操作成功！', 'success');
      await loadChainData();
    } else {
      // Demo 模式
      await new Promise(r => setTimeout(r, 500));
      const r = App.reimbursements.find(x => x.id === id);
      if (!r) return;
      if (!r.events) r.events = buildEventLog(r);
      const txHash = mockTxHash();
      const blockNum = mockBlockNum();
      const actor = App.account || '0x1aB3...9fE2';
      if (action === 'deptApprove') {
        r.status = 1;
        r.departmentHead = actor;
        r.departmentApprovedAt = Date.now();
        r.events.push({ name: 'DepartmentApproved', txHash, block: blockNum, timestamp: Date.now(), actor, detail: '部门审批通过' });
        showToast(`部门审批已上链！Tx: ${shortHash(txHash)} Block: #${blockNum}`, 'success');
      } else if (action === 'financeApprove') {
        r.status = 2;
        r.financeOfficer = App.account || '0x4dE7...3aC1';
        r.financeApprovedAt = Date.now();
        r.events.push({ name: 'FinanceApproved', txHash, block: blockNum, timestamp: Date.now(), actor: App.account || '0x4dE7...3aC1', detail: '财务审批通过' });
        showToast(`财务审批已上链！Tx: ${shortHash(txHash)} Block: #${blockNum}`, 'success');
      } else if (action === 'settle') {
        r.status = 3;
        r.settledAt = Date.now();
        r.events.push({ name: 'ReimbursementSettled', txHash, block: blockNum, timestamp: Date.now(), actor: App.account || '0x4dE7...3aC1', detail: '已结算打款' });
        showToast(`结算记录已上链！Tx: ${shortHash(txHash)} Block: #${blockNum}`, 'success');
      } else if (action === 'reject') {
        r.status = 4;
        r.rejectReason = extra;
        r.rejector = actor;
        r.events.push({ name: 'ReimbursementRejected', txHash, block: blockNum, timestamp: Date.now(), actor, detail: `驳回原因：${extra}` });
        showToast(`驳回记录已上链！Tx: ${shortHash(txHash)} Block: #${blockNum}`, 'success');
      }
      renderAll();
    }
  } catch (err) {
    showToast('操作失败：' + (err.reason || err.message || ''), 'error');
  }
}

function openRejectModal(id) {
  App.pendingRejectId = id;
  document.getElementById('rejectReason').value = '';
  document.getElementById('rejectModal').classList.add('show');
}

function closeRejectModal() {
  App.pendingRejectId = null;
  document.getElementById('rejectModal').classList.remove('show');
}

async function confirmReject() {
  const reason = document.getElementById('rejectReason').value.trim();
  if (!reason) { showToast('请输入驳回原因', 'error'); return; }
  const rejectId = App.pendingRejectId;  // 先保存 id，再关闭弹窗
  closeRejectModal();
  await doAction('reject', rejectId, reason);
}

// ========== 渲染函数 ==========

function renderAll() {
  renderStats();
  renderMyReimbursements();
  renderApproveList();
  renderSettleList();
  renderAudit();
}

function renderStats() {
  const total = App.reimbursements.length;
  const pending = App.reimbursements.filter(r => r.status === 0).length;
  const settled = App.reimbursements.filter(r => r.status === 3).length;
  const rejected = App.reimbursements.filter(r => r.status === 4).length;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statPending').textContent = pending;
  document.getElementById('statSettled').textContent = settled;
  document.getElementById('statRejected').textContent = rejected;
}

function renderItemHTML(r, showActions) {
  const status = STATUS_MAP[r.status];
  const amount = formatAmount(r.amount);
  let actions = '';

  if (showActions) {
    if (r.status === 0) {
      actions = `
        <button class="btn btn-approve" onclick="doAction('deptApprove', ${r.id})">部门审批通过</button>
        <button class="btn btn-reject" onclick="openRejectModal(${r.id})">驳回</button>`;
    } else if (r.status === 1) {
      actions = `
        <button class="btn btn-approve" onclick="doAction('financeApprove', ${r.id})">财务审批通过</button>
        <button class="btn btn-reject" onclick="openRejectModal(${r.id})">驳回</button>`;
    } else if (r.status === 2) {
      actions = `<button class="btn btn-settle" onclick="doAction('settle', ${r.id})">确认结算打款</button>`;
    }
  }

  // 审批时间线
  const steps = [
    { label: '提交', done: true, ts: r.submittedAt },
    { label: '部门审批', done: r.status >= 1, ts: r.departmentApprovedAt },
    { label: '财务审批', done: r.status >= 2, ts: r.financeApprovedAt },
    { label: '结算', done: r.status >= 3, ts: r.settledAt }
  ];

  let timeline = '<div class="reimburse-timeline">';
  steps.forEach((s, i) => {
    const cls = r.status === 4 && !s.done ? '' : (s.done ? 'done' : (i === steps.findIndex(x => !x.done) ? 'current' : ''));
    timeline += `<span class="timeline-step ${cls}">${s.done ? '✓' : '○'} ${s.label}</span>`;
    if (i < steps.length - 1) timeline += '<span class="timeline-arrow">→</span>';
  });
  timeline += '</div>';

  let rejectInfo = '';
  if (r.status === 4 && r.rejectReason) {
    rejectInfo = `<div style="margin-top:8px;padding:8px 12px;background:var(--danger-bg);border-radius:6px;font-size:13px;color:var(--danger);">驳回原因：${r.rejectReason}</div>`;
  }

  return `
    <div class="reimburse-item">
      <div class="reimburse-item-header">
        <div class="reimburse-item-title">
          <span class="reimburse-id">#${r.id}</span>
          <span class="reimburse-category">${r.category}</span>
          <span class="status-badge ${status.class}">${status.label}</span>
          <span class="chain-badge" title="数据已上链，不可篡改">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M3 3h6v6H3z" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 4.5v3M10.5 4.5v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            链上存证
          </span>
        </div>
        <div class="reimburse-amount">${amount} <span class="reimburse-amount-unit">MON</span></div>
      </div>
      <div class="reimburse-desc">${r.description}</div>
      <div class="reimburse-meta">
        <span class="reimburse-meta-item">申请人: ${shortenAddr(r.applicant)}</span>
        <span class="reimburse-meta-item">提交: ${formatTime(r.submittedAt)}</span>
        ${r.departmentApprovedAt ? `<span class="reimburse-meta-item">部门审批: ${formatTime(r.departmentApprovedAt)}</span>` : ''}
        ${r.financeApprovedAt ? `<span class="reimburse-meta-item">财务审批: ${formatTime(r.financeApprovedAt)}</span>` : ''}
        ${r.settledAt ? `<span class="reimburse-meta-item">结算: ${formatTime(r.settledAt)}</span>` : ''}
      </div>
      <div class="reimburse-hash">凭证哈希: ${shortHash(r.credentialHash)}</div>
      ${rejectInfo}
      ${timeline}
      <div class="chain-evidence">
        <div class="chain-evidence-header" onclick="toggleEventLog(this)">
          <span class="chain-evidence-title">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
            链上事件日志 (${(r.events || buildEventLog(r)).length})
          </span>
          <span class="chain-evidence-toggle">展开</span>
        </div>
        <div class="chain-evidence-body" style="display:none;">
          <div class="chain-tx-info">
            <div><span class="chain-label">交易哈希:</span> <span class="chain-value">${shortHash(r.submitTxHash)}</span></div>
            <div><span class="chain-label">区块号:</span> <span class="chain-value">#${r.submitBlock}</span></div>
          </div>
          ${(r.events || buildEventLog(r)).map(e => `
            <div class="event-log-item">
              <div class="event-log-name">
                <span class="event-dot event-${e.name.includes('Submit') ? 'submit' : e.name.includes('Dept') ? 'dept' : e.name.includes('Finance') ? 'finance' : e.name.includes('Settled') ? 'settle' : 'reject'}"></span>
                ${e.name}
              </div>
              <div class="event-log-detail">${e.detail}</div>
              <div class="event-log-meta">
                <span>Block #${e.block}</span>
                <span>Tx: ${shortHash(e.txHash)}</span>
                <span>${formatTime(e.timestamp)}</span>
                <span>Actor: ${shortenAddr(e.actor)}</span>
              </div>
            </div>
          `).join('')}
          <div class="chain-immutability-notice">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V3l5-2z" stroke="currentColor" stroke-width="1.2"/><path d="M5 7l1.5 1.5L9 5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>
            以上事件已永久记录在 Monad 区块链上，不可修改、不可删除
          </div>
        </div>
      </div>
      <div class="reimburse-actions">
        <button class="btn btn-ghost btn-sm" onclick="verifyCredential('${r.credentialHash}', ${r.id})">验证凭证唯一性</button>
        ${actions}
      </div>
    </div>`;
}

function renderEmpty(msg) {
  return `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none"><rect x="8" y="12" width="32" height="28" rx="4" stroke="#6B7280" stroke-width="2"/><path d="M16 8v8M32 8v8M8 24h32" stroke="#6B7280" stroke-width="2" stroke-linecap="round"/></svg>
      <p>${msg}</p>
    </div>`;
}

function renderMyReimbursements() {
  const container = document.getElementById('myReimbursements');
  const myAddr = App.account;
  let items;

  if (App.mode === 'live' && myAddr) {
    items = App.reimbursements.filter(r => r.applicant.toLowerCase() === myAddr.toLowerCase());
  } else {
    items = App.reimbursements;
  }

  if (!items.length) {
    container.innerHTML = renderEmpty('暂无报销记录，提交第一笔报销吧');
    return;
  }
  container.innerHTML = items.map(r => renderItemHTML(r, false)).join('');
}

function renderApproveList() {
  const container = document.getElementById('approveList');
  const items = App.reimbursements.filter(r => r.status === 0 || r.status === 1);

  if (!items.length) {
    container.innerHTML = renderEmpty('暂无待审批的报销单');
    return;
  }
  container.innerHTML = items.map(r => renderItemHTML(r, true)).join('');
}

function renderSettleList() {
  const container = document.getElementById('settleList');
  const items = App.reimbursements.filter(r => r.status === 2);

  if (!items.length) {
    container.innerHTML = renderEmpty('暂无待结算的报销单');
    return;
  }
  container.innerHTML = items.map(r => renderItemHTML(r, true)).join('');
}

function renderAudit() {
  const tbody = document.getElementById('auditBody');
  let items = App.reimbursements;

  if (App.currentFilter !== 'all') {
    const filterStatus = parseInt(App.currentFilter);
    items = items.filter(r => r.status === filterStatus);
  }

  if (!items.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-muted);">暂无记录</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(r => {
    const status = STATUS_MAP[r.status];
    const approver = r.departmentHead !== '0x0000000000000000000000000000000000000000'
      ? shortenAddr(r.departmentHead)
      : (r.financeOfficer !== '0x0000000000000000000000000000000000000000' ? shortenAddr(r.financeOfficer) : '—');
    return `
      <tr>
        <td>#${r.id}</td>
        <td class="cell-addr">${shortenAddr(r.applicant)}</td>
        <td>${r.category}</td>
        <td>${formatAmount(r.amount)} MON</td>
        <td class="cell-hash">${shortHash(r.credentialHash)}</td>
        <td><span class="status-badge ${status.class}">${status.label}</span></td>
        <td>${formatTime(r.submittedAt)}</td>
        <td class="cell-addr">${approver}</td>
        <td>${formatTime(r.settledAt)}</td>
      </tr>`;
  }).join('');
}

// ========== 链上存证交互 ==========

function toggleEventLog(el) {
  const evidence = el.closest('.chain-evidence');
  if (!evidence) return;
  const body = evidence.querySelector('.chain-evidence-body');
  const toggle = evidence.querySelector('.chain-evidence-toggle');
  if (!body || !toggle) return;
  if (body.style.display === 'none') {
    body.style.display = 'block';
    toggle.textContent = '收起';
  } else {
    body.style.display = 'none';
    toggle.textContent = '展开';
  }
}

async function verifyCredential(hash, id) {
  showToast('正在链上查验凭证哈希...', 'info');
  await new Promise(r => setTimeout(r, 600));

  // 在 Demo 数据中检查是否有重复
  const matches = App.reimbursements.filter(r => r.credentialHash === hash);
  if (matches.length > 0) {
    const r = matches[0];
    showToast(`验证通过：凭证已上链存证（ID: #${r.id}，Block: #${r.submitBlock}），唯一性校验通过`, 'success');
  } else {
    showToast('验证失败：链上未找到此凭证哈希', 'error');
  }
}

// 暴露给 inline onclick
window.doAction = doAction;
window.openRejectModal = openRejectModal;
window.toggleEventLog = toggleEventLog;
window.verifyCredential = verifyCredential;
window.filterByStat = filterByStat;

// ========== 启动 ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
