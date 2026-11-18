import hre, { network } from "hardhat";
import { readDeployment } from "./lib/deployments";

/**
 * Verify source code บน hoodi.etherscan.io
 *   npm run verify:hoodi   (ต้องมี ETHERSCAN_API_KEY ใน .env)
 */
async function main() {
  if (!process.env.ETHERSCAN_API_KEY) {
    throw new Error("ยังไม่ได้ใส่ ETHERSCAN_API_KEY ในไฟล์ contracts/.env");
  }
  const d = readDeployment(network.name);
  console.log(`กำลัง verify ${d.address} บน ${network.name} ...`);
  await hre.run("verify:verify", {
    address: d.address,
    constructorArguments: d.constructorArgs,
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
