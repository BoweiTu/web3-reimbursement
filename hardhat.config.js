require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/**
 * Hardhat 配置文件
 * Web3 区块链报销系统 - 部署在 Monad 测试网
 */

// 从环境变量读取私钥，本地开发时使用占位私钥避免报错
const PRIVATE_KEY =
  process.env.PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

// Monad 测试网 RPC URL
const MONAD_RPC_URL =
  process.env.MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.19",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "hardhat",
  networks: {
    // 本地开发网络（默认）
    hardhat: {
      chainId: 31337,
    },
    // Monad 测试网
    monadTestnet: {
      url: MONAD_RPC_URL,
      chainId: 10143,
      accounts: [PRIVATE_KEY],
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    timeout: 60000,
  },
};
