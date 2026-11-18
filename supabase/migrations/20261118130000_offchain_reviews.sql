-- =====================================================================
-- ChainPC – ย้ายรีวิวออกจาก Blockchain มาเก็บใน Supabase
--
-- เหตุผล: ผู้ใช้ไม่ต้องยืนยันธุรกรรมใน MetaMask / เสีย gas ตอนรีวิว
-- สิ่งที่เปลี่ยน:
--   * ตาราง reviews ผู้ซื้อเขียนเองได้ (เดิม sync จาก chain) — รวมคะแนน + ข้อความไว้ในตารางเดียว
--   * ลบ review_comments (ข้อความย้ายมาอยู่ใน reviews.comment)
--   * คะแนนผู้ขาย (sellers.rating_sum / rating_count) คำนวณด้วย trigger จากตาราง reviews
--     (sync-chain ไม่เขียนคอลัมน์นี้แล้ว)
-- กติกาที่ยังคงไว้ด้วย RLS:
--   * รีวิวได้เฉพาะผู้ซื้อของคำสั่งซื้อที่ "สำเร็จ" (status 4) และ 1 ครั้งต่อคำสั่งซื้อ (primary key)
--   * ผู้ใช้แก้ไข/ลบรีวิวไม่ได้ (ไม่มี policy update/delete)
-- รีวิวเดิมที่อยู่บน chain ถูกย้ายมาด้วย
-- =====================================================================

create table public.reviews_v2 (
  order_id   bigint primary key references public.orders (id) on delete cascade,
  seller     public.eth_address not null,
  buyer      public.eth_address not null default app_private.current_wallet(),
  rating     smallint not null check (rating between 1 and 5),
  comment    text check (char_length(comment) <= 1000),
  created_at timestamptz not null default now()
);

-- ย้ายรีวิวเดิม (คะแนนจาก chain + ข้อความจาก review_comments)
insert into public.reviews_v2 (order_id, seller, buyer, rating, comment, created_at)
select r.order_id, r.seller, r.buyer, r.rating, c.comment, r.created_at
from public.reviews r
left join public.review_comments c using (order_id);

drop table public.review_comments;
drop table public.reviews;
alter table public.reviews_v2 rename to reviews;
alter index public.reviews_v2_pkey rename to reviews_pkey;

comment on table public.reviews is
  'รีวิวผู้ขาย (เก็บใน Supabase) — ผู้ซื้อของคำสั่งซื้อที่สำเร็จรีวิวได้ 1 ครั้ง แก้ไข/ลบไม่ได้';
create index reviews_seller_idx on public.reviews (seller, created_at desc);

-- Grants + RLS
revoke all on public.reviews from anon, authenticated;
grant select on public.reviews to anon, authenticated;
grant insert (order_id, seller, rating, comment) on public.reviews to authenticated;
grant select, insert, update, delete on public.reviews to service_role;

alter table public.reviews enable row level security;

create policy "reviews: public read" on public.reviews
  for select to anon, authenticated using (true);

create policy "reviews: buyer of completed order" on public.reviews
  for insert to authenticated
  with check (
    buyer = (select app_private.current_wallet())
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.buyer = (select app_private.current_wallet())
        and o.seller = reviews.seller
        and o.status = 4
    )
  );

-- คะแนนผู้ขายอัปเดตอัตโนมัติเมื่อมีรีวิวใหม่
create or replace function app_private.bump_seller_rating()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.sellers (address, rating_sum, rating_count)
  values (new.seller, new.rating, 1)
  on conflict (address) do update
    set rating_sum = public.sellers.rating_sum + excluded.rating_sum,
        rating_count = public.sellers.rating_count + 1;
  return new;
end;
$$;
revoke execute on function app_private.bump_seller_rating() from public, anon, authenticated;

create trigger reviews_bump_seller_rating
  after insert on public.reviews
  for each row execute function app_private.bump_seller_rating();

-- คำนวณคะแนนผู้ขายใหม่จากตาราง reviews
update public.sellers s
set rating_sum   = coalesce((select sum(r.rating) from public.reviews r where r.seller = s.address), 0),
    rating_count = (select count(*) from public.reviews r where r.seller = s.address);
