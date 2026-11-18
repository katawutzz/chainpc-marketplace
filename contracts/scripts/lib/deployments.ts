import fs from "fs";
import path from "path";

/** ข้อมูลการ deploy ที่บันทึกไว้ใน contracts/deployments/<network>.json */
export interface DeploymentInfo {
  network: string;
  chainId: number;
  address: string;
  deployer: string;
  txHash: string;
  deployBlock: number;
  deployedAt: string;
  constructorArgs: [number, number, number, string[]]; // [feeBps, shipWindow, confirmWindow, extraAdmins]
}

export const CONTRACTS_ROOT = path.resolve(__dirname, "..", "..");
export const DEPLOYMENTS_DIR = path.join(CONTRACTS_ROOT, "deployments");
export const WEB_CONTRACTS_DIR = path.resolve(CONTRACTS_ROOT, "..", "web", "src", "contracts");
// Edge Function (Deno) ใช้ ABI ชุดเดียวกัน
export const SUPABASE_SHARED_DIR = path.resolve(CONTRACTS_ROOT, "..", "supabase", "functions", "_shared");
const ARTIFACT_PATH = path.join(
  CONTRACTS_ROOT,
  "artifacts",
  "contracts",
  "PCMarketplace.sol",
  "PCMarketplace.json"
);

export function deploymentPath(network: string): string {
  return path.join(DEPLOYMENTS_DIR, `${network}.json`);
}

export function readDeployment(network: string): DeploymentInfo {
  const file = deploymentPath(network);
  if (!fs.existsSync(file)) {
    throw new Error(`ไม่พบ ${path.relative(CONTRACTS_ROOT, file)} — ต้อง deploy บนเครือข่าย "${network}" ก่อน`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8")) as DeploymentInfo;
}

export function writeDeployment(info: DeploymentInfo): string {
  fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  const file = deploymentPath(info.network);
  fs.writeFileSync(file, JSON.stringify(info, null, 2) + "\n");
  return file;
}

/**
 * สร้างไฟล์ web/src/contracts/pcMarketplace.ts จาก ABI ล่าสุดและทุกเครือข่ายที่เคย deploy
 * ใช้กับ wagmi/viem ได้ทันที (ABI เป็น `as const` จึงได้ type อัตโนมัติ)
 */
export function exportToWeb(): string {
  const artifact = JSON.parse(fs.readFileSync(ARTIFACT_PATH, "utf8"));

  const deployments: DeploymentInfo[] = fs.existsSync(DEPLOYMENTS_DIR)
    ? fs
        .readdirSync(DEPLOYMENTS_DIR)
        .filter((f) => f.endsWith(".json"))
        .map((f) => JSON.parse(fs.readFileSync(path.join(DEPLOYMENTS_DIR, f), "utf8")))
    : [];
  deployments.sort((a, b) => a.chainId - b.chainId);

  const addressLines = deployments.map((d) => `  ${d.chainId}: "${d.address}", // ${d.network}`).join("\n");
  const blockLines = deployments.map((d) => `  ${d.chainId}: ${d.deployBlock}n, // ${d.network}`).join("\n");

  const content = `// ⚠️ ไฟล์นี้สร้างอัตโนมัติจาก contracts/scripts/deploy.ts — ห้ามแก้ไขด้วยมือ
// รัน \`npm run deploy:hoodi\` (หรือ \`npm run export:web\`) ในโฟลเดอร์ contracts เพื่ออัปเดต

export const pcMarketplaceAddress = {
${addressLines}
} as const satisfies Record<number, \`0x\${string}\`>;

/** block ที่ deploy contract (ใช้เป็นจุดเริ่มอ่าน Events) */
export const pcMarketplaceDeployBlock = {
${blockLines}
} as const satisfies Record<number, bigint>;

export const pcMarketplaceAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;
`;

  fs.mkdirSync(WEB_CONTRACTS_DIR, { recursive: true });
  const file = path.join(WEB_CONTRACTS_DIR, "pcMarketplace.ts");
  fs.writeFileSync(file, content);

  fs.mkdirSync(SUPABASE_SHARED_DIR, { recursive: true });
  fs.writeFileSync(path.join(SUPABASE_SHARED_DIR, "pcMarketplace.ts"), content);
  return file;
}
