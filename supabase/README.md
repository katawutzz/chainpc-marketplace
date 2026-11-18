# Supabase – ChainPC

โปรเจกต์บน Supabase Cloud: **chainpc** (ref `fzyffuwqssjmxkwcjzne`)
URL: `https://fzyffuwqssjmxkwcjzne.supabase.co`

## โครงสร้าง

| ไฟล์ | หน้าที่ |
|---|---|
| `migrations/20261118120000_init_schema.sql` | ตาราง 13 ตาราง, RLS, Storage buckets (`product-images`, `dispute-evidence`) |
| `migrations/20261118120100_sync_cron.sql` | pg_cron เรียก `sync-chain` ทุก 1 นาที |
| `migrations/20261118120200_service_role_grants.sql` | สิทธิ์ของ service_role (ใช้โดย Edge Function) |
| `migrations/20261118120300_harden_helpers.sql` | ย้าย helper ไป schema `app_private` และ pg_net ไป `extensions` (ผ่าน Security Advisor) |
| `functions/sync-chain/index.ts` | อ่าน Events จาก contract บน Hoodi → upsert สถานะล่าสุดลงตาราง + สร้างแจ้งเตือน |
| `functions/_shared/pcMarketplace.ts` | ABI + address (สร้างอัตโนมัติจาก `contracts/` — ห้ามแก้ด้วยมือ) |
| `config.toml` | เปิด Web3 (Ethereum) auth และ `verify_jwt = false` ให้ `sync-chain` |

## หลักการ

- **Blockchain คือแหล่งข้อมูลจริง** ตาราง `products`, `orders`, `sellers`, `reviews`, `admins`
  เขียนได้เฉพาะ `sync-chain` (service role) ผู้ใช้ปลอมราคา/สถานะผ่าน API ไม่ได้
- **ข้อความยาวอยู่ใน Supabase, บน chain เก็บ hash** (`details_hash`, `comment_hash`, `dispute_reason_hash`)
  หน้าเว็บคำนวณ keccak256 แล้วเทียบเพื่อตรวจว่าข้อมูลไม่ถูกแก้
- **ที่อยู่จัดส่งไม่อยู่บน chain** (`order_shipping`) เห็นได้เฉพาะผู้ซื้อ ผู้ขายของคำสั่งซื้อนั้น
  และ Admin เฉพาะคำสั่งซื้อที่มีข้อพิพาท
- ผู้ใช้ล็อกอินด้วย **Sign in with Ethereum** (MetaMask) → `app_private.current_wallet()`
  ดึง wallet address จาก identity ไปใช้ใน RLS

## คำสั่งที่ใช้บ่อย (รันที่ root ของโปรเจกต์)

> บน Windows PowerShell ใช้ `npx.cmd` แทน `npx`

```bash
npx supabase@3.2.0 login
npx supabase@3.2.0 link --project-ref fzyffuwqssjmxkwcjzne
npx supabase@3.2.0 db push --remote              # apply migrations
npx supabase@3.2.0 functions deploy sync-chain --use-api
npx supabase@3.2.0 db advisors --remote          # ตรวจความปลอดภัย
```

เรียก sync ทันที (หน้าเว็บเรียกหลังทำธุรกรรมเสร็จ):

```bash
curl -X POST https://fzyffuwqssjmxkwcjzne.supabase.co/functions/v1/sync-chain -H "Content-Type: application/json" -d "{}"
```

## ถ้า deploy contract ใหม่

1. `cd contracts && CONTRACT_ADDRESS=0x... npm run import:hoodi` (อัปเดต `_shared/pcMarketplace.ts`)
2. `npx supabase@3.2.0 functions deploy sync-chain --use-api`
3. `sync-chain` จะเห็นว่า address เปลี่ยนแล้วเริ่มอ่านใหม่จาก block ที่ deploy
   (ข้อมูลของ contract เก่าในตารางควรลบทิ้งก่อน)

## ตั้งค่าใน Dashboard (ทำครั้งเดียว)

- Authentication → Sign In / Providers → **Web3 Wallet → Ethereum: เปิด**
- Authentication → URL Configuration → Redirect URLs: `http://localhost:5173/**`
  (และ URL ของเว็บจริงถ้า deploy ขึ้น Vercel/Netlify)
