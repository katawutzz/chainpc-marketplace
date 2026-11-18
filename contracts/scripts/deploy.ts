import path from "path";
import { ethers, network } from "hardhat";
import { CONTRACTS_ROOT, exportToWeb, writeDeployment } from "./lib/deployments";

/**
 * Deploy PCMarketplace
 *
 *   npm run deploy:local   (ต้องรัน `npm run node` ไว้อีกหน้าต่าง)
 *   npm run deploy:hoodi   (ใช้ DEPLOYER_PRIVATE_KEY จาก .env = บัญชี MetaMask ที่จะเป็น Admin)
 *
 * ตั้งค่าเพิ่มได้ใน .env: FEE_BPS, SHIP_WINDOW_SECONDS, CONFIRM_WINDOW_SECONDS
 */
const DAY = 24 * 60 * 60;

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} ต้องเป็นจำนวนเต็มบวก (ได้ "${raw}")`);
  return value;
}

async function main() {
  const feeBps = envInt("FEE_BPS", 200); // 2%
  const shipWindow = envInt("SHIP_WINDOW_SECONDS", 3 * DAY);
  const confirmWindow = envInt("CONFIRM_WINDOW_SECONDS", 7 * DAY);

  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("ไม่พบบัญชีสำหรับ deploy — ใส่ DEPLOYER_PRIVATE_KEY ในไฟล์ contracts/.env ก่อน");
  }
  const deployer = signers[0];
  const { chainId } = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log(`เครือข่าย      : ${network.name} (chainId ${chainId})`);
  console.log(`ผู้ deploy (Admin): ${deployer.address}`);
  console.log(`ยอดคงเหลือ     : ${ethers.formatEther(balance)} ETH`);
  console.log(`ค่าธรรมเนียม    : ${feeBps / 100}%`);
  console.log(`ส่งของภายใน    : ${shipWindow} วินาที (${(shipWindow / DAY).toFixed(2)} วัน)`);
  console.log(`ยืนยันภายใน    : ${confirmWindow} วินาที (${(confirmWindow / DAY).toFixed(2)} วัน)`);

  if (balance === 0n) {
    throw new Error("บัญชีนี้ไม่มี ETH — ขอ Hoodi ETH จาก faucet ก่อน");
  }

  const factory = await ethers.getContractFactory("PCMarketplace");
  const contract = await factory.deploy(feeBps, shipWindow, confirmWindow);
  const deployTx = contract.deploymentTransaction();
  console.log(`\nส่งธุรกรรมแล้ว  : ${deployTx?.hash}`);
  console.log("กำลังรอยืนยัน...");

  await contract.waitForDeployment();
  const receipt = await deployTx!.wait();
  const address = await contract.getAddress();
  console.log(`✅ Deploy สำเร็จ : ${address} (block ${receipt!.blockNumber})`);

  // เครือข่าย "hardhat" เป็นแบบชั่วคราว (หายเมื่อสคริปต์จบ) จึงไม่บันทึกไฟล์
  if (network.name === "hardhat") {
    console.log("\n(เครือข่าย hardhat เป็นแบบชั่วคราว จึงไม่บันทึกไฟล์ deployment)");
    return;
  }

  const file = writeDeployment({
    network: network.name,
    chainId: Number(chainId),
    address,
    deployer: deployer.address,
    txHash: deployTx!.hash,
    deployBlock: receipt!.blockNumber,
    deployedAt: new Date().toISOString(),
    constructorArgs: [feeBps, shipWindow, confirmWindow],
  });
  console.log(`บันทึกข้อมูล    : ${path.relative(CONTRACTS_ROOT, file)}`);

  const webFile = exportToWeb();
  console.log(`ส่ง ABI ให้เว็บ   : ${path.relative(path.resolve(CONTRACTS_ROOT, ".."), webFile)}`);

  if (network.name === "hoodi") {
    console.log(`\n🔎 ดูบน Etherscan: https://hoodi.etherscan.io/address/${address}`);
    console.log("ถัดไป: npm run seed:hoodi   (ลงสินค้าตัวอย่าง)");
    console.log("       npm run verify:hoodi (verify source code — ต้องมี ETHERSCAN_API_KEY)");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
