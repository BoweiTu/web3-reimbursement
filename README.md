# BlockReimburse — Web3 区块链报销全流程工作流

> Monad Playground Hackathon 参赛项目

## 项目简介

BlockReimburse 是一套基于区块链的企业报销全流程管理系统，借助 Monad 区块链的不可篡改、存证可追溯特性，对报销单据、凭证、审批链路做链上存证，杜绝事后篡改单据、修改审批记录、重复报销，降低虚报和舞弊风险。

### 核心能力

- **凭证上链存证**：发票/小票通过 SHA-256 计算哈希摘要上链，原始文件存 IPFS，链上仅保存哈希
- **多级审批留痕**：部门负责人 → 财务审核，每一级审批操作全部写入链上，不可删除、不可回溯修改
- **重复报销拦截**：凭证哈希全局唯一，同一张发票重复提交时合约自动拦截
- **防篡改审计**：全部申请、凭证哈希、审批记录、结算记录链上留存，审计可按钱包地址/报销单号快速检索

### 工作流程

```
员工提交报销(Pending) → 部门负责人审批(DepartmentApproved) → 财务审批(FinanceApproved) → 结算(Settled)
                          ↘ 任意环节可驳回(Rejected) ↙
```

驳回后不可修改原申请，只能新建报销单。

## 技术栈

| 层级 | 技术 |
|------|------|
| 区块链 | Monad Testnet (Chain ID: 10143, EVM 兼容) |
| 智能合约 | Solidity ^0.8.19 |
| 开发框架 | Hardhat |
| 前端 | 原生 HTML/CSS/JS + ethers.js v6 |
| 存储 | IPFS（凭证原始文件）+ 链上哈希存证 |

## 项目结构

```
web3-reimbursement/
├── contracts/
│   └── ReimbursementManager.sol   # 核心智能合约
├── frontend/
│   ├── index.html                  # 前端入口
│   ├── style.css                   # 样式（Web3 暗色主题）
│   ├── config.js                   # 合约 ABI & Monad 网络配置
│   └── app.js                      # 应用逻辑（Demo 模式 + 链上模式）
├── scripts/
│   └── deploy.js                   # 部署脚本
├── test/
│   └── ReimbursementManager.test.js # 单元测试
├── hardhat.config.js
├── package.json
└── .env.example
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 编译合约

```bash
npm run compile
```

### 3. 运行测试

```bash
npm test
```

### 4. 部署到 Monad 测试网

```bash
cp .env.example .env
# 编辑 .env，填入你的 Monad 测试网私钥
npm run deploy:testnet
```

部署成功后，合约地址会自动写入 `frontend/config.js`。

### 5. 启动前端

```bash
npm run serve
```

浏览器打开 `http://localhost:3000`，连接 MetaMask 即可使用。

> **Demo 模式**：未部署合约时，前端自动以 Demo 模式运行，展示完整工作流的模拟数据，无需钱包和测试币。

## 智能合约

### ReimbursementManager.sol

**核心函数：**

| 函数 | 权限 | 说明 |
|------|------|------|
| `submitReimbursement()` | 任意用户 | 提交报销申请，凭证哈希上链 |
| `departmentApprove()` | 部门负责人 | 部门审批通过 |
| `financeApprove()` | 财务人员 | 财务审批通过 |
| `rejectReimbursement()` | 部门/财务 | 驳回报销，需填写原因 |
| `settleReimbursement()` | 财务人员 | 确认结算打款 |
| `setDepartmentHead()` | 管理员 | 设置部门负责人角色 |
| `setFinanceOfficer()` | 管理员 | 设置财务人员角色 |

**安全特性：**

- `usedCredentialHashes` 映射确保凭证哈希全局唯一，防重复报销
- `onlyDepartmentHead` / `onlyFinance` / `onlyAdmin` 修饰器实现角色权限控制
- 所有状态变更均触发事件，完整审批轨迹上链留痕
- 驳回状态不可逆，原申请不可修改，只能新建

## 方案局限性（客观声明）

1. **不能解决源头造假**：区块链无法识别假发票，仍需财务人工核验原始票据
2. **隐私考量**：企业报销为内部敏感业务，建议部署联盟链做权限控制，链上仅存哈希不存明文
3. **对接成本**：链上存证作为存证审计增强层，不完全替代传统 ERP/财务系统

## License

MIT
