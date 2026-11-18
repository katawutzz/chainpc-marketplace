import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error("ยังไม่ได้ตั้งค่า VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY ใน web/.env.local");
}

export const supabase = createClient<Database>(url, key);

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type ProductRow = Tables<"products">;
export type ProductDetailsRow = Tables<"product_details">;
export type SellerRow = Tables<"sellers">;
export type ProfileRow = Tables<"profiles">;
export type OrderRow = Tables<"orders">;

/** ขอให้ Edge Function อ่านข้อมูลล่าสุดจาก chain ทันที (เรียกหลังธุรกรรมสำเร็จ) */
export async function triggerSync(): Promise<void> {
  try {
    await fetch(`${url}/functions/v1/sync-chain`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } catch (err) {
    console.warn("sync-chain failed", err);
  }
}

/** URL สาธารณะของรูปใน bucket product-images */
export function productImageUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}
