import { formatAddress, type AddressRow } from "../components/AddressBook";
import { supabase } from "./supabase";
import { waitForSynced } from "./tx";

/**
 * บันทึกที่อยู่จัดส่งให้คำสั่งซื้อ
 * RLS อนุญาตเฉพาะเมื่อ orders (ที่ sync จาก chain) มีแถวของผู้ซื้อคนนี้แล้ว จึงต้องรอ sync ก่อน
 */
export async function attachShipping(orderIds: number[], address: AddressRow): Promise<{ ok: boolean; message?: string }> {
  const synced = await waitForSynced(async () => {
    const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).in("id", orderIds);
    return count === orderIds.length;
  });
  if (!synced) return { ok: false, message: "ข้อมูลคำสั่งซื้อยัง sync ไม่เสร็จ — เพิ่มที่อยู่ภายหลังได้ในหน้าคำสั่งซื้อ" };

  const rows = orderIds.map((order_id) => ({
    order_id,
    recipient_name: address.recipient_name,
    phone: address.phone,
    address: formatAddress(address),
  }));
  const { error } = await supabase.from("order_shipping").upsert(rows, { onConflict: "order_id", ignoreDuplicates: true });
  return error ? { ok: false, message: error.message } : { ok: true };
}
