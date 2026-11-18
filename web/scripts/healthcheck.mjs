// =====================================================================
// ตรวจสุขภาพระบบที่รันอยู่จริง (Hoodi + Supabase) — ใช้ก่อนพรีเซนต์
//   cd web && npm run healthcheck
//
// 1) อ่านสถานะ contract บน Hoodi และตรวจว่าเงินใน contract พอจ่ายทุกคน
// 2) ตรวจว่า Supabase sync ทันล่าสุด
// 3) ทดสอบ RLS จากภายนอกในฐานะผู้ใช้ที่ไม่ได้ล็อกอิน (anon)
// =====================================================================
import { readFileSync } from "node:fs";
import { createPublicClient, formatEther, http } from "viem";
import { pcMarketplaceAbi as abi, pcMarketplaceAddress } from "../src/contracts/pcMarketplace.ts";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1).trim()]),
);
const RPC = env.VITE_HOODI_RPC_URL || "https://ethereum-hoodi-rpc.publicnode.com";
const SUPABASE = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const address = pcMarketplaceAddress[560048];

let failures = 0;
const ok = (cond, label, detail = "") => {
  if (!cond) failures++;
  console.log(`${cond ? "✅" : "❌"} ${label}${detail ? ` — ${detail}` : ""}`);
};

// ── 1) Contract บน Hoodi ──
console.log(`\n⛓  Contract ${address} (Hoodi)`);
const client = createPublicClient({ transport: http(RPC) });
const read = (functionName) => client.readContract({ address, abi, functionName });
const [balance, escrow, fees, products, orders, paused, feeBps, ship, confirm, head] = await Promise.all([
  client.getBalance({ address }),
  read("totalEscrow"),
  read("accumulatedFees"),
  read("productCount"),
  read("orderCount"),
  read("paused"),
  read("feeBps"),
  read("shipWindow"),
  read("confirmWindow"),
  client.getBlockNumber(),
]);
console.log(`   สินค้า ${products} · คำสั่งซื้อ ${orders} · ค่าธรรมเนียม ${Number(feeBps) / 100}% · เวลา ${ship}s / ${confirm}s`);
console.log(`   ยอดใน contract ${formatEther(balance)} ETH = escrow ${formatEther(escrow)} + ค่าธรรมเนียม ${formatEther(fees)} + ยอดรอถอน ${formatEther(balance - escrow - fees)}`);
ok(balance >= escrow + fees, "เงินใน contract พอจ่าย escrow + ค่าธรรมเนียม");
ok(!paused, "ระบบไม่ได้หยุดชั่วคราว", paused ? "กำลัง pause อยู่" : "");

// ── 2) Supabase sync ──
console.log(`\n🗄  Supabase ${SUPABASE}`);
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
const rest = (path, init = {}) => fetch(`${SUPABASE}/rest/v1/${path}`, { ...init, headers: { ...H, ...init.headers } });
const count = async (table) => {
  const res = await rest(`${table}?select=*&limit=1`, { headers: { Prefer: "count=exact" } });
  return Number(res.headers.get("content-range")?.split("/")[1] ?? -1);
};
const [dbProducts, dbOrders] = await Promise.all([count("products"), count("orders")]);
const [state] = await (await rest("sync_state?select=last_block,last_run_at")).json();
const lag = Number(head) - Number(state?.last_block ?? 0);
const age = (Date.now() - Date.parse(state?.last_run_at ?? 0)) / 1000;
ok(dbProducts === Number(products), "จำนวนสินค้าใน Supabase ตรงกับ chain", `${dbProducts} / ${products}`);
ok(dbOrders === Number(orders), "จำนวนคำสั่งซื้อใน Supabase ตรงกับ chain", `${dbOrders} / ${orders}`);
ok(lag <= 10, "sync ตามทัน block ล่าสุด", `ช้ากว่า ${lag} block`);
ok(age <= 180, "cron sync ทำงานภายใน 3 นาทีล่าสุด", `${Math.round(age)} วินาทีที่แล้ว`);

// ── 3) RLS (ผู้ใช้ที่ไม่ได้ล็อกอิน) ──
console.log("\n🔐 RLS ในฐานะผู้ใช้ที่ไม่ได้ล็อกอิน");
const cases = [
  ["อ่านสินค้า", "GET", "products?select=id&limit=1", 200],
  ["อ่านรีวิว", "GET", "reviews?select=order_id&limit=1", 200],
  ["อ่านที่อยู่จัดส่ง (ข้อมูลส่วนตัว)", "GET", "order_shipping?select=*", 401],
  ["อ่านสมุดที่อยู่", "GET", "addresses?select=*", 401],
  ["อ่านรายละเอียดการแจ้งปัญหา", "GET", "dispute_details?select=*", 401],
  ["อ่านการแจ้งเตือน", "GET", "notifications?select=*", 401],
  ["เขียนสินค้าปลอม", "POST", "products", 401],
  ["เขียนคำสั่งซื้อปลอม", "POST", "orders", 401],
  ["เขียนรีวิวโดยไม่ล็อกอิน", "POST", "reviews", 401],
  ["เรียกฟังก์ชันภายใน current_wallet", "POST", "rpc/current_wallet", 404],
];
for (const [label, method, path, expected] of cases) {
  const res = await rest(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? "{}" : undefined,
  });
  ok(res.status === expected, label, `HTTP ${res.status} (ต้องเป็น ${expected})`);
}

console.log(failures === 0 ? "\n🎉 ผ่านทั้งหมด" : `\n⚠️  ไม่ผ่าน ${failures} ข้อ`);
process.exitCode = failures ? 1 : 0;
