import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config();

// ค่าเหล่านี้อ่านจากไฟล์ .env (ดูตัวอย่างใน .env.example)
const HOODI_RPC_URL =
  process.env.HOODI_RPC_URL || "https://ethereum-hoodi-rpc.publicnode.com";
// Private Key ของบัญชี MetaMask ที่ใช้ทดสอบเท่านั้น (ห้ามใช้บัญชีที่มีเงินจริง)
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      // ตั้งให้ตรงกับค่าปกติของ Remix (paris + optimizer 200, ไม่ใช้ viaIR)
      // เพื่อให้ bytecode ตรงกันไม่ว่าจะ deploy ด้วย Hardhat หรือ Remix + MetaMask
      optimizer: { enabled: true, runs: 200 },
      evmVersion: "paris",
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    // Ethereum Hoodi Testnet (เครือข่ายเดียวกับที่ตั้งใน MetaMask)
    hoodi: {
      url: HOODI_RPC_URL,
      chainId: 560048,
      accounts: DEPLOYER_PRIVATE_KEY ? [DEPLOYER_PRIVATE_KEY] : [],
    },
  },
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
    customChains: [
      {
        network: "hoodi",
        chainId: 560048,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=560048",
          browserURL: "https://hoodi.etherscan.io",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
