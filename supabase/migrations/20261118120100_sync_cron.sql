-- =====================================================================
-- ChainPC – เรียก Edge Function sync-chain ทุก 1 นาทีด้วย pg_cron + pg_net
-- (apply หลังจาก deploy ฟังก์ชัน sync-chain แล้ว)
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'chainpc-sync-chain',
  '* * * * *',
  $$
    select net.http_post(
      url     := 'https://fzyffuwqssjmxkwcjzne.supabase.co/functions/v1/sync-chain',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    );
  $$
);
