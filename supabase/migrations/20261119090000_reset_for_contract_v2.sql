-- =====================================================================
-- ChainPC – ล้างข้อมูลของ contract เวอร์ชันเก่าก่อนใช้ contract v2 (หลาย Admin)
--
-- contract ใหม่เริ่มนับ productId / orderId จาก 1 ใหม่ จึงต้องล้างข้อมูลที่ผูกกับ
-- contract เดิม ไม่อย่างนั้นสินค้า #1 ใหม่จะไปปนกับรายละเอียด/รีวิวของสินค้า #1 เก่า
--
-- เก็บไว้: profiles (ชื่อร้าน), addresses (สมุดที่อยู่) — ไม่ผูกกับ contract
-- ล้าง:   ข้อมูลสินค้า/คำสั่งซื้อ/รีวิว/แจ้งเตือน และสถานะ sync (sync-chain จะอ่านใหม่จาก block ที่ deploy)
-- =====================================================================

truncate table
  public.notifications,
  public.reviews,
  public.dispute_details,
  public.order_shipping,
  public.product_details,
  public.orders,
  public.products,
  public.sellers,
  public.admins,
  public.sync_state;
