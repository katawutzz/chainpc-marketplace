-- =====================================================================
-- ChainPC – แก้คำเตือนจาก Supabase Security Advisor
--  1) ย้าย helper (SECURITY DEFINER) ออกจาก schema public ที่เปิดผ่าน API
--     → policy / default ที่อ้างถึงยังทำงานเหมือนเดิม (อ้างอิงด้วย OID)
--  2) ย้าย extension pg_net ออกจาก schema public
-- =====================================================================

create schema if not exists app_private;
revoke all on schema app_private from public;
grant usage on schema app_private to anon, authenticated, service_role;

alter function public.current_wallet() set schema app_private;
alter function public.is_admin() set schema app_private;

-- เขียน is_admin ใหม่ให้อ้าง current_wallet ใน schema ใหม่
create or replace function app_private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a where a.address = app_private.current_wallet()
  )
$$;

revoke execute on function app_private.current_wallet() from public;
revoke execute on function app_private.is_admin() from public;
grant execute on function app_private.current_wallet() to anon, authenticated, service_role;
grant execute on function app_private.is_admin() to anon, authenticated, service_role;

-- pg_net → schema extensions (ฟังก์ชัน net.http_post ที่ cron ใช้อยู่ใน schema net เหมือนเดิม)
drop extension if exists pg_net;
create extension if not exists pg_net with schema extensions;
