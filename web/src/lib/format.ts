import { formatEther } from "viem";

/** หมวดหมู่ (ลำดับตรงกับ enum Category ใน contract) */
export const CATEGORIES = [
  { id: 0, label: "PC ประกอบ", icon: "🖥️" },
  { id: 1, label: "CPU", icon: "🧠" },
  { id: 2, label: "GPU / การ์ดจอ", icon: "🎮" },
  { id: 3, label: "RAM", icon: "🧩" },
  { id: 4, label: "SSD", icon: "💾" },
  { id: 5, label: "Mainboard", icon: "🔌" },
  { id: 6, label: "Monitor", icon: "🖵" },
  { id: 7, label: "Keyboard / Mouse", icon: "⌨️" },
  { id: 8, label: "Gaming Headset", icon: "🎧" },
] as const;

export const CONDITIONS = [
  { id: 0, label: "มือหนึ่ง" },
  { id: 1, label: "มือสอง" },
] as const;

export const ORDER_STATUS: Record<number, { label: string; tone: "info" | "warn" | "danger" | "ok" | "muted" }> = {
  1: { label: "ชำระเงินแล้ว · รอจัดส่ง", tone: "info" },
  2: { label: "จัดส่งแล้ว · รอยืนยัน", tone: "warn" },
  3: { label: "มีข้อพิพาท", tone: "danger" },
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
  const e = err as { shortMessage?: string; message?: string; name?: string; cause?: { data?: { errorName?: string } } };
  const raw = `${e?.name ?? ""} ${e?.shortMessage ?? ""} ${e?.message ?? ""}`;
  if (/User rejected|User denied|rejected the request/i.test(raw)) return "คุณยกเลิกรายการใน MetaMask";
  if (/insufficient funds/i.test(raw)) return "ETH ในกระเป๋าไม่พอ (รวมค่า gas)";
  const custom = e?.cause?.data?.errorName ?? raw.match(/reverted with the following reason:\s*\n?(\w+)/)?.[1];
  const map: Record<string, string> = {
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
