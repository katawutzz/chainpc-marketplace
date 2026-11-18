import { BaseError, ContractFunctionRevertedError, formatEther } from "viem";
import {
  CircuitBoard,
  Cpu,
  Gpu,
  HardDrive,
  Headphones,
  Keyboard,
  MemoryStick,
  Monitor,
  PcCase,
  type LucideIcon,
} from "lucide-react";

/** หมวดหมู่ (ลำดับตรงกับ enum Category ใน contract) */
export const CATEGORIES: readonly { id: number; label: string; icon: LucideIcon }[] = [
  { id: 0, label: "PC ประกอบ", icon: PcCase },
  { id: 1, label: "CPU", icon: Cpu },
  { id: 2, label: "การ์ดจอ", icon: Gpu },
  { id: 3, label: "RAM", icon: MemoryStick },
  { id: 4, label: "SSD", icon: HardDrive },
  { id: 5, label: "เมนบอร์ด", icon: CircuitBoard },
  { id: 6, label: "จอมอนิเตอร์", icon: Monitor },
  { id: 7, label: "คีย์บอร์ด / เมาส์", icon: Keyboard },
  { id: 8, label: "หูฟังเกมมิ่ง", icon: Headphones },
];

export const CONDITIONS = [
  { id: 0, label: "มือหนึ่ง" },
  { id: 1, label: "มือสอง" },
] as const;

export const ORDER_STATUS: Record<number, { label: string; tone: "info" | "warn" | "danger" | "ok" | "muted" }> = {
  1: { label: "ชำระเงินแล้ว · รอจัดส่ง", tone: "info" },
  2: { label: "จัดส่งแล้ว · รอยืนยัน", tone: "warn" },
  3: { label: "แจ้งปัญหา · รอ Admin ตัดสิน", tone: "danger" },
  4: { label: "สำเร็จ", tone: "ok" },
  5: { label: "คืนเงินแล้ว", tone: "muted" },
};

export const categoryOf = (id: number) => CATEGORIES.find((c) => c.id === id) ?? CATEGORIES[0];
export const conditionLabel = (id: number) => CONDITIONS.find((c) => c.id === id)?.label ?? "-";

/** แสดง ETH ไม่เกิน 6 ตำแหน่ง และตัดศูนย์ท้าย */
export function formatEth(wei: bigint | string | number, maxDecimals = 6): string {
  const value = typeof wei === "bigint" ? wei : BigInt(wei);
  const [int, frac = ""] = formatEther(value).split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  return trimmed ? `${int}.${trimmed}` : int;
}

export const shortAddress = (a?: string | null) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "");

export function ratingOf(sumOrSeller: { rating_sum: number; rating_count: number } | null | undefined) {
  if (!sumOrSeller || sumOrSeller.rating_count === 0) return { avg: 0, count: 0 };
  return { avg: sumOrSeller.rating_sum / sumOrSeller.rating_count, count: sumOrSeller.rating_count };
}

export function formatThaiDate(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

/** ข้อความผิดพลาดจาก wagmi/viem → ข้อความภาษาไทยที่อ่านง่าย */
export function friendlyError(err: unknown): string {
  const e = err as { shortMessage?: string; message?: string; name?: string };
  const raw = `${e?.name ?? ""} ${e?.shortMessage ?? ""} ${e?.message ?? ""}`;
  if (/User rejected|User denied|rejected the request/i.test(raw)) return "คุณยกเลิกรายการใน MetaMask";
  if (/insufficient funds/i.test(raw)) return "ETH ในกระเป๋าไม่พอ (รวมค่า gas)";
  let custom: string | undefined;
  if (err instanceof BaseError) {
    const revert = err.walk((x) => x instanceof ContractFunctionRevertedError);
    if (revert instanceof ContractFunctionRevertedError) custom = revert.data?.errorName;
  }
  custom ??= raw.match(/reverted with the following reason:\s*\n?(\w+)/)?.[1];
  const map: Record<string, string> = {
    NotProductSeller: "คุณไม่ใช่เจ้าของสินค้านี้",
    NotOrderSeller: "คุณไม่ใช่ผู้ขายของคำสั่งซื้อนี้",
    NotOrderBuyer: "คุณไม่ใช่ผู้ซื้อของคำสั่งซื้อนี้",
    InvalidStatus: "สถานะคำสั่งซื้อเปลี่ยนไปแล้ว ลองโหลดหน้าใหม่",
    AlreadyReviewed: "รีวิวคำสั่งซื้อนี้ไปแล้ว",
    InvalidTitle: "ชื่อสินค้าต้องมี 1–100 ตัวอักษร (byte)",
    InvalidPrice: "ราคาต้องมากกว่า 0",
    InvalidStock: "จำนวนสต็อกต้องมากกว่า 0",
    InvalidTracking: "เลขพัสดุต้องมี 1–64 ตัวอักษร",
    CartTooLarge: "ตะกร้ามีสินค้าเกิน 20 รายการ",
    AccessControlUnauthorizedAccount: "บัญชีนี้ไม่มีสิทธิ์ทำรายการนี้ (เฉพาะ Admin)",
    AccessControlBadConfirmation: "สละสิทธิ์ได้เฉพาะของตัวเอง",
    InvalidAddress: "address ไม่ถูกต้อง",
    CannotBuyOwnProduct: "ซื้อสินค้าของตัวเองไม่ได้",
    InsufficientStock: "สินค้าในสต็อกไม่พอ",
    ProductUnavailable: "สินค้านี้ไม่เปิดขายแล้ว",
    IncorrectPayment: "ยอดเงินไม่ตรงกับราคาล่าสุด ลองโหลดหน้าใหม่",
    EnforcedPause: "ระบบปิดปรับปรุงชั่วคราว",
    SellerIsBanned: "บัญชีนี้ถูกระงับการขาย",
    DeadlinePassed: "เลยกำหนดเวลาแล้ว",
    DeadlineNotReached: "ยังไม่ถึงกำหนดเวลา",
    NothingToWithdraw: "ไม่มียอดเงินให้ถอน",
  };
  if (custom && map[custom]) return map[custom];
  return e?.shortMessage ?? e?.message ?? "เกิดข้อผิดพลาด";
}
