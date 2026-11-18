import path from "path";
import { CONTRACTS_ROOT, exportToWeb } from "./lib/deployments";

/** สร้าง web/src/contracts/pcMarketplace.ts ใหม่จาก ABI และ deployments ที่มีอยู่ */
const file = exportToWeb();
console.log(`✅ ${path.relative(path.resolve(CONTRACTS_ROOT, ".."), file)}`);
