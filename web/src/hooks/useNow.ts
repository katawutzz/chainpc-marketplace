import { useEffect, useState } from "react";

/** เวลาปัจจุบัน (ms) อัปเดตทุก intervalMs — ใช้แสดงเวลาที่เหลือก่อนครบกำหนด */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatRemaining(ms: number): string {
  if (ms <= 0) return "ครบกำหนดแล้ว";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d} วัน ${h} ชม.`;
  if (h > 0) return `${h} ชม. ${m} นาที`;
  if (m > 0) return `${m} นาที ${sec} วินาที`;
  return `${sec} วินาที`;
}
