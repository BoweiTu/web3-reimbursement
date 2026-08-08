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

// ========== Demo 模拟数据 ==========
const DEMO_DATA = [
  {
    id: 0,
    applicant: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1',
    category: '差旅费',
    amount: '0.85',
    credentialHash: '0xa3f5e8b2c1d4f6a8e0b2c4d6f8a0e2c4b6d8f0a2e4c6b8d0f2a4c6e8b0d2f4a6',
    ipfsHash: 'QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG',
    description: '上海客户拜访差旅费，含高铁往返及两晚住宿',
    status: 3, // Settled
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: Date.now() - 86400000 * 7,
    departmentApprovedAt: Date.now() - 86400000 * 6,
    financeApprovedAt: Date.now() - 86400000 * 5,
    settledAt: Date.now() - 86400000 * 4,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 1,
    applicant: '0x8Ba1f9551926F5677C50e7C5c3F7D9e1a2B3c4D5',
    category: '办公用品',
    amount: '0.32',
    credentialHash: '0xb4e6f9c3d2e5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7',
    ipfsHash: 'QmZdE7r2PpX8nKMqXfnAHKocQ7n3yLpv2n5rRGfERP5oBzK',
    description: '研发部办公用品采购：A4纸、笔、文件夹等',
    status: 2, // FinanceApproved
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x4dE7...3aC1',
    submittedAt: Date.now() - 86400000 * 3,
    departmentApprovedAt: Date.now() - 86400000 * 2,
    financeApprovedAt: Date.now() - 86400000 * 1,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 2,
    applicant: '0x3Cd5e7F9a1B3c5D7e9F1a3B5c7D9e1F3a5B7c9D1',
    category: '餐饮费',
    amount: '0.18',
    credentialHash: '0xc5f7a1b3d5e7f9a1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9',
    ipfsHash: 'QmX9zK2pP4rR6tT8vV1bB3nN5mM7kK9jJ2lL4oO6qQ8sS',
    description: '客户接待餐饮费用，3人商务午餐',
    status: 1, // DepartmentApproved
    departmentHead: '0x1aB3...9fE2',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: Date.now() - 86400000 * 2,
    departmentApprovedAt: Date.now() - 86400000 * 1,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 3,
    applicant: '0x5Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5c7D9e1F3',
    category: '交通费',
    amount: '0.06',
    credentialHash: '0xd6a8b2c4e6f8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2',
    ipfsHash: 'QmP3kL7mN1oP5qR9sT2uU4vV6wW8xX0yY1zZ3aA5bB7cC',
    description: '市内出租车交通费，拜访三个客户点位',
    status: 0, // Pending
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: Date.now() - 3600000 * 5,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 4,
    applicant: '0x9f1a3B5c7D9e1F3a5B7c9D1e3F5a7B9c1D3e5F7a',
    category: '培训费',
    amount: '1.20',
    credentialHash: '0xe7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3b5c7d1e3f5a7b9c1d3e5f7a9b1c3',
    ipfsHash: 'QmK2jJ5lL8oO1pP3qQ6rR9sS2tT4uU7vV0wW3xX5yY8zZ',
    description: '区块链开发技术培训课程费用',
    status: 4, // Rejected
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: Date.now() - 86400000 * 4,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '培训预算已超本季度上限，请下季度重新申请',
    rejector: '0x1aB3...9fE2'
  },
  {
    id: 5,
    applicant: '0x2Bd4f6A8c0E2b4D6f8A0e2C4b6D8f0A2e4C6b8D0',
    category: '会议费',
    amount: '0.45',
    credentialHash: '0xf8a0b2c4d6e8f0a2b4c6d8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2',
    ipfsHash: 'QmA1bB3cC5dD7eE9fF1gG2hH4iI6jJ8kK0lL2mM4nN6oO',
    description: '行业峰会参会费用，含门票及材料费',
    status: 0, // Pending
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: Date.now() - 3600000 * 2,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  },
  {
    id: 6,
    applicant: '0x4Ef7a9B1c3D5e7F9a1B3c5D7e9F1a3B5c7D9e1F3',
    category: '差旅费',
    amount: '1.50',
    credentialHash: '0xa1b3c5d7e9f1a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5',
    ipfsHash: 'QmB2cC4dD6eE8fF0gG1hH3iI5jJ7kK9lL1mM3nN5oO7pP',
    description: '北京技术交流会议差旅费，含机票及三晚住宿',
    status: 0, // Pending
    departmentHead: '0x0000000000000000000000000000000000000000',
    financeOfficer: '0x0000000000000000000000000000000000000000',
    submittedAt: Date.now() - 3600000 * 1,
    departmentApprovedAt: 0,
    financeApprovedAt: 0,
    settledAt: 0,
    rejectReason: '',
    rejector: '0x0000000000000000000000000000000000000000'
  }
];

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
      App.reimbursements.push({
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
        rejectReason: '', rejector: '0x0000000000000000000000000000000000000000'
      });
      showToast('Demo 模式：报销已模拟提交上链（ID: ' + newId + '）', 'success');
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
      if (action === 'deptApprove') {
        r.status = 1;
        r.departmentHead = App.account || '0x1aB3...9fE2';
        r.departmentApprovedAt = Date.now();
      } else if (action === 'financeApprove') {
        r.status = 2;
        r.financeOfficer = App.account || '0x4dE7...3aC1';
        r.financeApprovedAt = Date.now();
      } else if (action === 'settle') {
        r.status = 3;
        r.settledAt = Date.now();
      } else if (action === 'reject') {
        r.status = 4;
        r.rejectReason = extra;
        r.rejector = App.account || '0x1aB3...9fE2';
      }
      showToast('Demo 模式：操作已模拟执行', 'success');
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
  closeRejectModal();
  await doAction('reject', App.pendingRejectId, reason);
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
      ${actions ? `<div class="reimburse-actions">${actions}</div>` : ''}
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

// 暴露给 inline onclick
window.doAction = doAction;
window.openRejectModal = openRejectModal;

// ========== 启动 ==========
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
