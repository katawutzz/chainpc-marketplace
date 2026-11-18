-- =====================================================================
-- ChainPC – สิทธิ์ของ service_role (ใช้โดย Edge Function sync-chain)
-- โปรเจกต์ไม่ได้เปิด "Grant API access to new tables automatically"
-- จึงต้อง grant ให้ service_role เองอย่างชัดเจน
-- =====================================================================

grant usage on schema public to service_role;

grant select, insert, update, delete on
  public.admins, public.products, public.sellers, public.orders, public.reviews,
  public.sync_state, public.profiles, public.product_details, public.addresses,
  public.order_shipping, public.review_comments, public.dispute_details,
  public.notifications
to service_role;

grant usage, select on all sequences in schema public to service_role;
grant usage on all sequences in schema public to authenticated;
