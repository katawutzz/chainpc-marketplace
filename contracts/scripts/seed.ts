import { ethers, network } from "hardhat";
import { readDeployment } from "./lib/deployments";

/**
 * ลงสินค้าตัวอย่างสำหรับสาธิต (1 รายการต่อหมวดหมู่)
 *
 *   npm run seed:local
 *   npm run seed:hoodi
 *
 * ผู้ขาย = SELLER_PRIVATE_KEY ใน .env (บัญชี MetaMask ผู้ขาย) ถ้าไม่ใส่จะใช้บัญชี deployer
 * จะข้ามถ้ามีสินค้าอยู่แล้ว (ตั้ง SEED_FORCE=true เพื่อลงซ้ำ)
 *
 * รายละเอียด/รูปของสินค้าจะเพิ่มใน Supabase ภายหลัง (ระยะ 4) ตอนนี้ detailsHash = 0x00..00
 */

// enum Category: 0 BuiltPC, 1 CPU, 2 GPU, 3 RAM, 4 SSD, 5 Mainboard, 6 Monitor, 7 KeyboardMouse, 8 Headset
// enum Condition: 0 New, 1 Used
// ราคาตั้งต่ำ ๆ เพื่อให้ทดสอบซื้อด้วย Hoodi ETH จาก faucet ได้หลายครั้ง
const SAMPLE_PRODUCTS = [
  { title: "Gaming PC Ryzen 5 7600 + RTX 4060", category: 0, condition: 0, price: "0.012", stock: 2 },
  { title: "AMD Ryzen 7 7800X3D", category: 1, condition: 0, price: "0.006", stock: 5 },
  { title: "NVIDIA GeForce RTX 4070 Super 12GB", category: 2, condition: 1, price: "0.008", stock: 1 },
  { title: "Kingston FURY Beast DDR5 32GB (2x16GB) 6000MHz", category: 3, condition: 0, price: "0.002", stock: 10 },
  { title: "Samsung 990 PRO 2TB NVMe M.2", category: 4, condition: 0, price: "0.003", stock: 8 },
  { title: "ASUS TUF Gaming B650-PLUS WIFI", category: 5, condition: 1, price: "0.003", stock: 1 },
  { title: "LG UltraGear 27\" 1440p 165Hz", category: 6, condition: 0, price: "0.004", stock: 3 },
  { title: "Logitech G Pro X TKL + G Pro X Superlight 2", category: 7, condition: 0, price: "0.003", stock: 4 },
  { title: "HyperX Cloud III Wireless", category: 8, condition: 1, price: "0.002", stock: 2 },
];

async function main() {
  const deployment = readDeployment(network.name);
  const signers = await ethers.getSigners();

  // บน localhost ใช้บัญชีที่ 2 ของ Hardhat เป็นผู้ขาย (แยกจาก Admin)
  let seller = signers[0];
  if (process.env.SELLER_PRIVATE_KEY) {
    seller = new ethers.Wallet(process.env.SELLER_PRIVATE_KEY, ethers.provider) as unknown as typeof seller;
  } else if (network.name === "localhost" && signers.length > 1) {
    seller = signers[1];
  }

  const market = await ethers.getContractAt("PCMarketplace", deployment.address, seller);
  const existing = await market.productCount();
  if (existing > 0n && process.env.SEED_FORCE !== "true") {
    console.log(`มีสินค้าอยู่แล้ว ${existing} รายการ — ข้ามการ seed (ตั้ง SEED_FORCE=true เพื่อลงซ้ำ)`);
    return;
  }

  console.log(`Contract : ${deployment.address} (${network.name})`);
  console.log(`ผู้ขาย    : ${await seller.getAddress()}`);
  console.log(`ยอดคงเหลือ: ${ethers.formatEther(await ethers.provider.getBalance(await seller.getAddress()))} ETH\n`);

  for (const p of SAMPLE_PRODUCTS) {
    const tx = await market.listProduct(
      p.title,
      p.category,
      p.condition,
      ethers.parseEther(p.price),
      p.stock,
      ethers.ZeroHash
    );
    await tx.wait();
    console.log(`✅ ${p.title} — ${p.price} ETH x${p.stock}`);
  }

  console.log(`\nลงสินค้าแล้ว ทั้งหมด ${await market.productCount()} รายการ`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
