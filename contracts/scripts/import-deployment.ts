import path from "path";
import { artifacts, ethers, network } from "hardhat";
import { CONTRACTS_ROOT, exportToWeb, writeDeployment } from "./lib/deployments";

/**
 * บันทึก contract ที่ deploy เองผ่าน Remix + MetaMask เข้าโปรเจกต์
 *
 *   CONTRACT_ADDRESS=0x... npx hardhat run scripts/import-deployment.ts --network hoodi
 *
 * - อ่านค่าจาก chain (owner, fee, deadlines) เพื่อตรวจว่าเป็น PCMarketplace จริง
 * - เทียบ bytecode กับที่ compile ในโปรเจกต์ (ไม่นับส่วน metadata ท้ายไฟล์)
 * - หาธุรกรรมที่ deploy จาก block ล่าสุดย้อนหลัง (SEARCH_BLOCKS, ค่าเริ่มต้น 2000 ≈ 6.6 ชม.)
 * - เขียน deployments/<network>.json และ web/src/contracts/pcMarketplace.ts
 */

/** ตัดส่วน CBOR metadata ท้าย runtime bytecode (ความยาวอยู่ใน 2 byte สุดท้าย) */
function stripMetadata(code: string): string {
  const hex = code.startsWith("0x") ? code.slice(2) : code;
  const metaLen = parseInt(hex.slice(-4), 16);
  return hex.slice(0, hex.length - (metaLen + 2) * 2);
}

async function main() {
  const address = process.env.CONTRACT_ADDRESS;
  if (!address || !ethers.isAddress(address)) throw new Error("ใส่ CONTRACT_ADDRESS=0x... ให้ถูกต้อง");
  const checksummed = ethers.getAddress(address);
  const provider = ethers.provider;
  const { chainId } = await provider.getNetwork();

  const code = await provider.getCode(checksummed);
  if (code === "0x") throw new Error(`ไม่พบ contract ที่ ${checksummed} บน ${network.name}`);

  // 1) อ่านค่าจาก contract
  const market = await ethers.getContractAt("PCMarketplace", checksummed);
  const [owner, feeBps, shipWindow, confirmWindow, productCount, orderCount] = await Promise.all([
    market.owner(),
    market.feeBps(),
    market.shipWindow(),
    market.confirmWindow(),
    market.productCount(),
    market.orderCount(),
  ]);
  console.log(`เครือข่าย       : ${network.name} (chainId ${chainId})`);
  console.log(`Contract       : ${checksummed}`);
  console.log(`Admin (owner)  : ${owner}`);
  console.log(`ค่าธรรมเนียม     : ${Number(feeBps) / 100}%`);
  console.log(`ส่งของภายใน     : ${shipWindow} วินาที`);
  console.log(`ยืนยันภายใน     : ${confirmWindow} วินาที`);
  console.log(`สินค้า / คำสั่งซื้อ : ${productCount} / ${orderCount}`);

  // 2) เทียบ bytecode
  const artifact = await artifacts.readArtifact("PCMarketplace");
  const sameCode = stripMetadata(code) === stripMetadata(artifact.deployedBytecode);
  console.log(`Bytecode ตรงกับโปรเจกต์: ${sameCode ? "✅ ตรงกัน" : "⚠️ ไม่ตรง (อาจ compile ด้วยค่าต่างกัน)"}`);

  // 3) หาธุรกรรม deploy
  const searchBlocks = Number(process.env.SEARCH_BLOCKS || 2000);
  const latest = await provider.getBlockNumber();
  let txHash = "";
  let deployBlock = 0;
  console.log(`\nกำลังค้นหาธุรกรรม deploy ใน ${searchBlocks} block ล่าสุด...`);
  for (let b = latest; b > latest - searchBlocks && b > 0 && !txHash; b--) {
    const block = await provider.getBlock(b, true);
    if (!block) continue;
    for (const tx of block.prefetchedTransactions) {
      if (tx.to !== null || ethers.getAddress(tx.from) !== ethers.getAddress(owner)) continue;
      const receipt = await provider.getTransactionReceipt(tx.hash);
      if (receipt?.contractAddress && ethers.getAddress(receipt.contractAddress) === checksummed) {
        txHash = tx.hash;
        deployBlock = b;
        break;
      }
    }
  }
  if (!txHash) {
    throw new Error("หาธุรกรรม deploy ไม่เจอ — ลองเพิ่ม SEARCH_BLOCKS หรือดู tx hash จาก Etherscan");
  }
  console.log(`ธุรกรรม deploy  : ${txHash} (block ${deployBlock})`);

  const file = writeDeployment({
    network: network.name,
    chainId: Number(chainId),
    address: checksummed,
    deployer: owner,
    txHash,
    deployBlock,
    deployedAt: new Date(((await provider.getBlock(deployBlock))!.timestamp) * 1000).toISOString(),
    constructorArgs: [Number(feeBps), Number(shipWindow), Number(confirmWindow)],
  });
  console.log(`\nบันทึกข้อมูล     : ${path.relative(CONTRACTS_ROOT, file)}`);
  const webFile = exportToWeb();
  console.log(`ส่ง ABI ให้เว็บ    : ${path.relative(path.resolve(CONTRACTS_ROOT, ".."), webFile)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
