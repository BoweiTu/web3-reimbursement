/**
 * ReimbursementManager 合约部署脚本
 *
 * 用法：
 *   本地部署:  npx hardhat run scripts/deploy.js --network hardhat
 *   测试网部署: npx hardhat run scripts/deploy.js --network monadTestnet
 *
 * 部署完成后，合约地址会自动写入 frontend/config.js
 */

const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  // 获取部署账户
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("========================================");
  console.log("  ReimbursementManager 部署脚本");
  console.log("========================================");
  console.log("网络名称:    ", network.name);
  console.log("网络 ChainId:", network.chainId.toString());
  console.log("部署账户:    ", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("账户余额:    ", ethers.formatEther(balance), "ETH");
  console.log("----------------------------------------");

  // 部署合约
  console.log("正在部署 ReimbursementManager 合约...");
  const ReimbursementManager = await ethers.getContractFactory(
    "ReimbursementManager"
  );
  const reimbursement = await ReimbursementManager.deploy();
  await reimbursement.waitForDeployment();

  const address = await reimbursement.getAddress();
  const deployTx = reimbursement.deploymentTransaction();

  console.log("合约部署成功!");
  console.log("合约地址:    ", address);
  console.log("交易哈希:    ", deployTx.hash);
  console.log("部署者(将成为合约 admin):", deployer.address);
  console.log("----------------------------------------");

  // 将合约地址写入 frontend/config.js
  const frontendDir = path.join(__dirname, "..", "frontend");
  if (!fs.existsSync(frontendDir)) {
    fs.mkdirSync(frontendDir, { recursive: true });
    console.log("已创建 frontend 目录");
  }

  const configPath = path.join(frontendDir, "config.js");
  const timestamp = new Date().toISOString();
  const configContent = `/**
 * 前端配置文件 - 由部署脚本自动生成
 * 生成时间: ${timestamp}
 * 切勿手动修改合约地址，请重新运行部署脚本
 */

// 已部署的合约地址
const CONTRACT_ADDRESS = "${address}";

// Monad 测试网配置
const NETWORK_CONFIG = {
  chainId: "0x279f",          // 10143 十六进制
  chainIdDecimal: 10143,
  name: "Monad Testnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorerUrl: "https://testnet.monadexplorer.com",
  nativeCurrency: {
    name: "Monad",
    symbol: "MON",
    decimals: 18,
  },
};

// 完整配置
const WEB3_CONFIG = {
  contractAddress: CONTRACT_ADDRESS,
  network: NETWORK_CONFIG,
  deployedAt: "${timestamp}",
  deployer: "${deployer.address}",
};

// 导出配置（兼容浏览器全局变量与 Node.js module）
if (typeof window !== "undefined") {
  window.CONTRACT_ADDRESS = CONTRACT_ADDRESS;
  window.NETWORK_CONFIG = NETWORK_CONFIG;
  window.WEB3_CONFIG = WEB3_CONFIG;
}
if (typeof module !== "undefined" && module.exports) {
  module.exports = { CONTRACT_ADDRESS, NETWORK_CONFIG, WEB3_CONFIG };
}
`;

  fs.writeFileSync(configPath, configContent, "utf8");
  console.log("合约地址已写入:", configPath);
  console.log("========================================");
  console.log("部署完成!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("========================================");
    console.error("部署失败!");
    console.error("========================================");
    console.error(error);
    process.exit(1);
  });
