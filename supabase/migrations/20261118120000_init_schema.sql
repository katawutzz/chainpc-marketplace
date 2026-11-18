-- =====================================================================
-- ChainPC – Supabase schema (ระยะ 4)
--
-- หลักการ:
--   * Blockchain = แหล่งข้อมูลจริง (Source of Truth) เรื่องเงิน/สินค้า/คำสั่งซื้อ
--   * ตาราง "sync จาก chain" เขียนได้เฉพาะ Edge Function sync-chain (service role)
--   * ตาราง "ผู้ใช้เขียนได้" ควบคุมด้วย RLS โดยใช้ wallet address จาก Sign in with Ethereum
--   * ที่อยู่จัดส่ง = ข้อมูลส่วนตัว เห็นได้เฉพาะผู้ซื้อ ผู้ขายของคำสั่งซื้อนั้น
--     และ Admin (เฉพาะคำสั่งซื้อที่มีข้อพิพาท)
--
-- order status (ตรงกับ enum ใน contract):
--   1 Paid, 2 Shipped, 3 Disputed, 4 Completed, 5 Refunded
-- category: 0 BuiltPC, 1 CPU, 2 GPU, 3 RAM, 4 SSD, 5 Mainboard, 6 Monitor,
--           7 KeyboardMouse, 8 Headset
-- condition: 0 New, 1 Used
-- =====================================================================

-- ---------------------------------------------------------------------
-- Types & helpers
-- ---------------------------------------------------------------------

-- address แบบตัวพิมพ์เล็กเสมอ
create domain public.eth_address as text
  check (value ~ '^0x[0-9a-f]{40}$');

-- wallet address ของผู้ใช้ที่ล็อกอินอยู่ (จาก identity ของ Sign in with Web3)
create or replace function public.current_wallet()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select lower(
    (regexp_match(
      coalesce(i.provider_id, '') || ' ' || coalesce(i.identity_data::text, ''),
      '0x[0-9a-fA-F]{40}'
    ))[1]
  )
  from auth.identities i
  where i.user_id = auth.uid()
  order by (i.provider = 'web3') desc, i.created_at desc
  limit 1
$$;

comment on function public.current_wallet() is
  'wallet address (lowercase) ของผู้ใช้ที่ล็อกอินด้วย Sign in with Ethereum, null ถ้าไม่ได้ล็อกอิน';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- ตารางที่ sync จาก chain (เขียนได้เฉพาะ service role)
-- ---------------------------------------------------------------------

create table public.admins (
  address   public.eth_address primary key,
  synced_at timestamptz not null default now()
);
comment on table public.admins is 'owner ของ contract (sync จาก chain)';

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.address = public.current_wallet()
  )
$$;

create table public.products (
  id           bigint primary key,
  seller       public.eth_address not null,
  title        text not null,
  category     smallint not null check (category between 0 and 8),
  condition    smallint not null check (condition in (0, 1)),
  price_wei    numeric(78, 0) not null,
  stock        integer not null,
  active       boolean not null,
  hidden       boolean not null,
  details_hash text not null,
  created_at   timestamptz not null,
  updated_at   timestamptz not null,
  synced_at    timestamptz not null default now()
);
comment on table public.products is 'สำเนาสินค้าจาก contract (sync จาก chain)';
create index products_seller_idx on public.products (seller);
create index products_listing_idx on public.products (category, created_at desc) where active and not hidden;

create table public.sellers (
  address      public.eth_address primary key,
  verified     boolean not null default false,
  banned       boolean not null default false,
  rating_sum   bigint not null default 0,
  rating_count bigint not null default 0,
  synced_at    timestamptz not null default now()
);
comment on table public.sellers is 'สถานะผู้ขายจาก contract (sync จาก chain)';

create table public.orders (
  id                  bigint primary key,
  product_id          bigint not null references public.products (id),
  buyer               public.eth_address not null,
  seller              public.eth_address not null,
  quantity            integer not null,
  unit_price_wei      numeric(78, 0) not null,
  total_wei           numeric(78, 0) not null,
  fee_bps             integer not null,
  status              smallint not null check (status between 1 and 5),
  paid_at             timestamptz not null,
  ship_deadline       timestamptz not null,
  shipped_at          timestamptz,
  confirm_deadline    timestamptz,
  tracking_no         text,
  dispute_reason_hash text,
  reviewed            boolean not null default false,
  resolution_refund   boolean,
  resolution_note     text,
  synced_at           timestamptz not null default now()
);
comment on table public.orders is 'สำเนาคำสั่งซื้อจาก contract (sync จาก chain)';
create index orders_buyer_idx on public.orders (buyer, paid_at desc);
create index orders_seller_idx on public.orders (seller, paid_at desc);
create index orders_product_idx on public.orders (product_id);
create index orders_disputed_idx on public.orders (id) where status = 3;

create table public.reviews (
  order_id     bigint primary key references public.orders (id),
  seller       public.eth_address not null,
  buyer        public.eth_address not null,
  rating       smallint not null check (rating between 1 and 5),
  comment_hash text not null,
  created_at   timestamptz not null,
  tx_hash      text not null
);
comment on table public.reviews is 'คะแนนรีวิวจาก contract (sync จาก chain)';
create index reviews_seller_idx on public.reviews (seller, created_at desc);

create table public.sync_state (
  id               smallint primary key default 1 check (id = 1),
  chain_id         integer not null,
  contract_address public.eth_address not null,
  last_block       bigint not null,
  last_run_at      timestamptz not null default now()
);
comment on table public.sync_state is 'block ล่าสุดที่ Edge Function sync-chain อ่านแล้ว';

-- ---------------------------------------------------------------------
-- ตารางที่ผู้ใช้เขียนได้ (ควบคุมด้วย RLS)
-- ---------------------------------------------------------------------

create table public.profiles (
  address      public.eth_address primary key,
  display_name text check (char_length(display_name) <= 50),
  shop_name    text check (char_length(shop_name) <= 60),
  avatar_url   text check (char_length(avatar_url) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.product_details (
  product_id  bigint primary key references public.products (id) on delete cascade,
  description text not null default '' check (char_length(description) <= 5000),
  specs       jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  images      text[] not null default '{}' check (cardinality(images) <= 5),
  updated_at  timestamptz not null default now()
);
comment on table public.product_details is
  'รายละเอียด/สเปก/รูปสินค้า — keccak256 ของข้อมูลนี้ต้องตรงกับ products.details_hash';
create trigger product_details_updated_at before update on public.product_details
  for each row execute function public.set_updated_at();

create table public.addresses (
  id             uuid primary key default gen_random_uuid(),
  owner          public.eth_address not null default public.current_wallet(),
  recipient_name text not null check (char_length(recipient_name) between 1 and 100),
  phone          text not null check (char_length(phone) between 6 and 20),
  address_line   text not null check (char_length(address_line) between 1 and 300),
  district       text not null default '' check (char_length(district) <= 100),
  province       text not null default '' check (char_length(province) <= 100),
  postcode       text not null default '' check (char_length(postcode) <= 10),
  is_default     boolean not null default false,
  created_at     timestamptz not null default now()
);
comment on table public.addresses is 'สมุดที่อยู่ของผู้ใช้ (ข้อมูลส่วนตัว เจ้าของเห็นคนเดียว)';
create index addresses_owner_idx on public.addresses (owner);

create table public.order_shipping (
  order_id       bigint primary key references public.orders (id) on delete cascade,
  buyer          public.eth_address not null default public.current_wallet(),
  recipient_name text not null check (char_length(recipient_name) between 1 and 100),
  phone          text not null check (char_length(phone) between 6 and 20),
  address        text not null check (char_length(address) between 1 and 600),
  created_at     timestamptz not null default now()
);
comment on table public.order_shipping is
  'ที่อยู่จัดส่งของแต่ละคำสั่งซื้อ (ข้อมูลส่วนตัว — ห้ามเก็บบน chain)';
create index order_shipping_buyer_idx on public.order_shipping (buyer);

create table public.review_comments (
  order_id   bigint primary key references public.orders (id) on delete cascade,
  comment    text not null check (char_length(comment) between 1 and 1000),
  created_at timestamptz not null default now()
);
comment on table public.review_comments is
  'ข้อความรีวิว — keccak256 ต้องตรงกับ reviews.comment_hash';

create table public.dispute_details (
  order_id   bigint primary key references public.orders (id) on delete cascade,
  reason     text not null check (char_length(reason) between 1 and 2000),
  evidence   text[] not null default '{}' check (cardinality(evidence) <= 5),
  admin_note text check (char_length(admin_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.dispute_details is
  'เหตุผลและหลักฐานข้อพิพาท — keccak256(reason) ต้องตรงกับ orders.dispute_reason_hash';
create trigger dispute_details_updated_at before update on public.dispute_details
  for each row execute function public.set_updated_at();

create table public.notifications (
  id         bigint generated always as identity primary key,
  recipient  public.eth_address not null,
  type       text not null,
  order_id   bigint,
  product_id bigint,
  data       jsonb not null default '{}'::jsonb,
  read       boolean not null default false,
  tx_hash    text not null,
  log_index  integer not null,
  created_at timestamptz not null default now(),
  unique (tx_hash, log_index, recipient)
);
comment on table public.notifications is 'แจ้งเตือนภายในเว็บ (สร้างโดย sync-chain)';
create index notifications_recipient_idx on public.notifications (recipient, created_at desc);

-- ---------------------------------------------------------------------
-- Grants (ระบุชัดเจน ไม่พึ่งค่าอัตโนมัติ)
-- ---------------------------------------------------------------------

revoke all on
  public.admins, public.products, public.sellers, public.orders, public.reviews,
  public.sync_state, public.profiles, public.product_details, public.addresses,
  public.order_shipping, public.review_comments, public.dispute_details,
  public.notifications
from anon, authenticated;

-- อ่านได้ทุกคน
grant select on
  public.admins, public.products, public.sellers, public.orders, public.reviews,
  public.sync_state, public.profiles, public.product_details, public.review_comments
to anon, authenticated;

-- ผู้ใช้ที่ล็อกอิน
grant insert, update on public.profiles to authenticated;
grant insert, update on public.product_details to authenticated;
grant select, insert, update, delete on public.addresses to authenticated;
grant select, insert on public.order_shipping to authenticated;
grant insert on public.review_comments to authenticated;
grant select, insert on public.dispute_details to authenticated;
grant update (admin_note) on public.dispute_details to authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table public.admins          enable row level security;
alter table public.products        enable row level security;
alter table public.sellers         enable row level security;
alter table public.orders          enable row level security;
alter table public.reviews         enable row level security;
alter table public.sync_state      enable row level security;
alter table public.profiles        enable row level security;
alter table public.product_details enable row level security;
alter table public.addresses       enable row level security;
alter table public.order_shipping  enable row level security;
alter table public.review_comments enable row level security;
alter table public.dispute_details enable row level security;
alter table public.notifications   enable row level security;

-- ตาราง sync จาก chain: อ่านได้ทุกคน, ไม่มี policy สำหรับเขียน (service role เท่านั้น)
create policy "admins: public read"     on public.admins     for select to anon, authenticated using (true);
create policy "products: public read"   on public.products   for select to anon, authenticated using (true);
create policy "sellers: public read"    on public.sellers    for select to anon, authenticated using (true);
create policy "orders: public read"     on public.orders     for select to anon, authenticated using (true);
create policy "reviews: public read"    on public.reviews    for select to anon, authenticated using (true);
create policy "sync_state: public read" on public.sync_state for select to anon, authenticated using (true);

-- profiles
create policy "profiles: public read" on public.profiles
  for select to anon, authenticated using (true);
create policy "profiles: owner insert" on public.profiles
  for insert to authenticated
  with check (address = (select public.current_wallet()));
create policy "profiles: owner update" on public.profiles
  for update to authenticated
  using (address = (select public.current_wallet()))
  with check (address = (select public.current_wallet()));

-- product_details: เฉพาะผู้ขายเจ้าของสินค้า (ตาม products ที่ sync จาก chain)
create policy "product_details: public read" on public.product_details
  for select to anon, authenticated using (true);
create policy "product_details: seller insert" on public.product_details
  for insert to authenticated
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and p.seller = (select public.current_wallet())
  ));
create policy "product_details: seller update" on public.product_details
  for update to authenticated
  using (exists (
    select 1 from public.products p
    where p.id = product_id and p.seller = (select public.current_wallet())
  ))
  with check (exists (
    select 1 from public.products p
    where p.id = product_id and p.seller = (select public.current_wallet())
  ));

-- addresses: เจ้าของเท่านั้น
create policy "addresses: owner all" on public.addresses
  for all to authenticated
  using (owner = (select public.current_wallet()))
  with check (owner = (select public.current_wallet()));

-- order_shipping: ผู้ซื้อ / ผู้ขายของคำสั่งซื้อ / Admin เฉพาะคำสั่งซื้อที่มีข้อพิพาท
create policy "order_shipping: parties read" on public.order_shipping
  for select to authenticated
  using (
    buyer = (select public.current_wallet())
    or exists (
      select 1 from public.orders o
      where o.id = order_id and o.seller = (select public.current_wallet())
    )
    or (
      (select public.is_admin())
      and exists (
        select 1 from public.orders o
        where o.id = order_id and o.dispute_reason_hash is not null
      )
    )
  );
create policy "order_shipping: buyer insert" on public.order_shipping
  for insert to authenticated
  with check (
    buyer = (select public.current_wallet())
    and exists (
      select 1 from public.orders o
      where o.id = order_id and o.buyer = (select public.current_wallet())
    )
  );

-- review_comments: ผู้ซื้อของคำสั่งซื้อที่สำเร็จแล้ว
create policy "review_comments: public read" on public.review_comments
  for select to anon, authenticated using (true);
create policy "review_comments: buyer insert" on public.review_comments
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.buyer = (select public.current_wallet())
      and o.status = 4
  ));

-- dispute_details: ผู้ซื้อเปิด, คู่กรณีและ Admin อ่าน, Admin เขียนบันทึก
create policy "dispute_details: parties read" on public.dispute_details
  for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.buyer = (select public.current_wallet()) or o.seller = (select public.current_wallet()))
    )
    or (select public.is_admin())
  );
create policy "dispute_details: buyer insert" on public.dispute_details
  for insert to authenticated
  with check (exists (
    select 1 from public.orders o
    where o.id = order_id
      and o.buyer = (select public.current_wallet())
      and o.status in (2, 3)
  ));
create policy "dispute_details: admin update" on public.dispute_details
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- notifications: ผู้รับเท่านั้น (แก้ได้แค่คอลัมน์ read ตาม grant)
create policy "notifications: recipient read" on public.notifications
  for select to authenticated
  using (recipient = (select public.current_wallet()));
create policy "notifications: recipient mark read" on public.notifications
  for update to authenticated
  using (recipient = (select public.current_wallet()))
  with check (recipient = (select public.current_wallet()));

-- ---------------------------------------------------------------------
-- Storage
-- ---------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('product-images', 'product-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp']),
  ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- product-images: path = {wallet}/{ไฟล์}, ผู้ขายจัดการได้เฉพาะโฟลเดอร์ของตัวเอง (bucket เป็น public อ่านผ่าน URL ได้)
create policy "product-images: owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_wallet())
  );
create policy "product-images: owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_wallet())
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_wallet())
  );
create policy "product-images: owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = (select public.current_wallet())
  );

-- dispute-evidence: path = {orderId}/{ไฟล์}
create policy "dispute-evidence: buyer insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'dispute-evidence'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.buyer = (select public.current_wallet())
        and o.status in (2, 3)
    )
  );
create policy "dispute-evidence: parties read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'dispute-evidence'
    and (
      exists (
        select 1 from public.orders o
        where o.id::text = (storage.foldername(name))[1]
          and (o.buyer = (select public.current_wallet()) or o.seller = (select public.current_wallet()))
      )
      or (select public.is_admin())
    )
  );
