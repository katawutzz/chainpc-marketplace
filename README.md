# ⛓ ChainPC – Decentralized PC Marketplace

เว็บซื้อขายคอมพิวเตอร์และอุปกรณ์ IT ที่ใช้ **Smart Contract บน Ethereum Hoodi Testnet** เป็นคนกลาง (Escrow)
ผู้ซื้อจ่าย ETH ผ่าน **MetaMask** เงินจะถูกล็อกไว้ใน contract จนกว่าผู้ซื้อยืนยันว่าได้รับของ

| | |
|---|---|
| Smart Contract (Hoodi) | [`0x544A1e1c5ed8c03125f91E7e00920A44891dfDb3`](https://hoodi.etherscan.io/address/0x544A1e1c5ed8c03125f91E7e00920A44891dfDb3) |
| Admin (owner) | `0x28f1019229E1dD0c5De7a2b30c93C7Ed5fa514c0` |
| Supabase project | `chainpc` (`fzyffuwqssjmxkwcjzne`) |
| ขอบเขตงานฉบับเต็ม | [docs/SCOPE.md](docs/SCOPE.md) |
| การทดสอบ | [docs/TESTING.md](docs/TESTING.md) |

---

## ปัญหาที่แก้

ซื้อของออนไลน์ โดยเฉพาะการ์ดจอหรือ CPU มือสองราคาสูง มักเจอ **โอนเงินแล้วไม่ได้ของ** หรือ **ส่งของแล้วไม่ได้เงิน**
ChainPC ใช้ Smart Contract เป็นคนกลางที่ **ไม่มีใครโกงได้ — แม้แต่ Admin ก็ดึงเงินของผู้ซื้อไปไม่ได้**

## ฟีเจอร์หลัก

- 🔒 **Escrow** — เงินล็อกใน contract → ผู้ขายแจ้งจัดส่ง → ผู้ซื้อยืนยันรับของ → เงินปลดให้ผู้ขาย
- ↩️ **คืนเงินอัตโนมัติ** — ผู้ขายไม่ส่งของตามกำหนด ผู้ซื้อขอเงินคืนได้เอง / ผู้ซื้อเงียบเกินกำหนด ผู้ขายรับเงินเองได้
- 🚩 **แจ้งปัญหา (Dispute)** — ของไม่ตรงปก แนบรูปหลักฐาน ให้ Admin ตัดสิน
- 🛒 **ตะกร้าหลายร้าน จ่ายครั้งเดียว** — MetaMask เด้งครั้งเดียว contract แยกเป็นคำสั่งซื้อย่อยให้
- 🦊 **Sign in with Ethereum** — เข้าสู่ระบบด้วยการเซ็นข้อความใน MetaMask (ไม่ต้องมีรหัสผ่าน ไม่เสีย gas)
- 🔐 **ข้อมูลส่วนตัวไม่อยู่บน chain** — ที่อยู่จัดส่งเก็บใน Supabase เห็นได้เฉพาะผู้ซื้อ ผู้ขาย และ Admin (เฉพาะเมื่อมีปัญหา)
- ✔ **ตรวจข้อมูลด้วย hash** — รายละเอียดสินค้าเก็บใน Supabase แต่ keccak256 อยู่บน chain ถ้าถูกแก้ หน้าเว็บตรวจเจอ
- ⭐ **รีวิวจากผู้ซื้อจริง** · ✔ **Verified Seller** · 🛡️ **Admin Panel** (ซ่อนสินค้า แบนผู้ขาย ตั้งค่าธรรมเนียม Pause)
- 💸 **Pull Payment** — ผู้ใช้กดถอนเงินเอง ป้องกันการโจมตีแบบ reentrancy

## สถาปัตยกรรม

```
                 ┌──────────────────────────────┐
                 │  React (Vite + TypeScript)   │
                 │  wagmi/viem      supabase-js │
                 └──────┬────────────────┬──────┘
     เซ็นธุรกรรม /        │                │  ข้อมูลประกอบ / รูป / ที่อยู่
     Sign-in message     ▼                ▼
                 ┌──────────────┐  ┌───────────────────────────┐
                 │   MetaMask   │  │         Supabase          │
                 └──────┬───────┘  │ Auth (SIWE) · Postgres+RLS│
                        ▼          │ Storage · Edge Function   │
          ┌──────────────────────┐ │   sync-chain (ทุก 1 นาที) │
          │  PCMarketplace.sol   │─┼─▶ อ่าน Events → upsert     │
          │  (Hoodi Testnet)     │ └───────────────────────────┘
          └──────────────────────┘
       แหล่งข้อมูลจริงเรื่องเงิน            สำเนาสำหรับค้นหา + ข้อมูลส่วนตัว
```

| เก็บบน Blockchain | เก็บใน Supabase |
|---|---|
| ราคา สต็อก สถานะสินค้า | รายละเอียด สเปก รูป |
| คำสั่งซื้อ Escrow สถานะ เลขพัสดุ | ที่อยู่จัดส่ง ชื่อ เบอร์โทร (ข้อมูลส่วนตัว) |
| การตัดสินของ Admin | เหตุผลและรูปหลักฐานการแจ้งปัญหา |
| hash ของรายละเอียด / เหตุผลแจ้งปัญหา | รีวิว โปรไฟล์ร้าน การแจ้งเตือน |

## เทคโนโลยี

| ส่วน | เทคโนโลยี |
|---|---|
| Smart Contract | Solidity 0.8.28 · OpenZeppelin (Ownable, Pausable, ReentrancyGuard) · Hardhat |
| Frontend | React 19 · Vite · TypeScript · Tailwind CSS 4 · wagmi 2 / viem · TanStack Query · Zustand |
| Backend | Supabase (PostgreSQL + RLS, Auth Web3, Storage, Edge Functions, pg_cron) |
| Wallet / Network | MetaMask · Ethereum Hoodi Testnet (chainId 560048) |

## โครงสร้างโปรเจกต์

```
chainpc-marketplace/
├── contracts/            Smart Contract + Hardhat
│   ├── contracts/PCMarketplace.sol
│   ├── test/PCMarketplace.test.ts      52 เทสต์
│   ├── scripts/                        deploy / seed / verify / import-deployment / export-web
│   ├── deployments/hoodi.json          address + block ที่ deploy
│   └── remix/PCMarketplace.flat.sol    ไฟล์รวมสำหรับ deploy ผ่าน Remix + MetaMask
├── supabase/             migrations (ตาราง/RLS/Storage/cron) + Edge Function sync-chain
├── web/                  React app
│   ├── src/pages/        หน้าแรก สินค้า ตะกร้า ชำระเงิน คำสั่งซื้อ ศูนย์ผู้ขาย บัญชี Admin
│   ├── src/contracts/    ABI + address (สร้างอัตโนมัติ)
│   └── scripts/healthcheck.mjs
└── docs/                 SCOPE.md · TESTING.md
```

---

## เริ่มใช้งาน

### สิ่งที่ต้องมี
- Node.js 20 ขึ้นไป
- Chrome + **MetaMask** ที่เพิ่มเครือข่าย Hoodi แล้ว
  | Network | RPC | Chain ID | Symbol | Explorer |
  |---|---|---|---|---|
  | Hoodi | `https://ethereum-hoodi-rpc.publicnode.com` | `560048` | ETH | `https://hoodi.etherscan.io` |
- Hoodi ETH จาก faucet เช่น `hoodi-faucet.pk910.de` หรือ Google Cloud Web3 Faucet

### รันเว็บ

```bash
cd web
npm install
cp .env.example .env.local   # ใส่ VITE_SUPABASE_PUBLISHABLE_KEY (Supabase → Settings → API Keys)
npm run dev                  # http://localhost:5173
```

> บน Windows PowerShell ถ้าเจอ "running scripts is disabled" ให้ใช้ `npm.cmd` / `npx.cmd` แทน

### Smart Contract

```bash
cd contracts
npm install
npm test                 # 52 เทสต์
npm run coverage
```

**Deploy ใหม่ (ทางที่แนะนำ: Remix + MetaMask — ไม่ต้องใช้ private key)**
1. เปิด `contracts/remix/PCMarketplace.flat.sol` ใน [Remix](https://remix.ethereum.org) → Compile 0.8.28, Optimizer 200, EVM `paris`
2. Deploy ด้วย **Injected Provider – MetaMask** ค่า constructor: `feeBps, shipWindowSec, confirmWindowSec` เช่น `200, 120, 120` (สาธิต) หรือ `200, 259200, 604800` (ใช้งานจริง)
3. นำเข้าโปรเจกต์: `CONTRACT_ADDRESS=0x... npm run import:hoodi` (ตรวจ owner/ค่าตั้งค่า/bytecode แล้วอัปเดต ABI ให้เว็บและ Edge Function)

> หรือใช้ `npm run deploy:hoodi` ถ้าใส่ `DEPLOYER_PRIVATE_KEY` ของบัญชีทดสอบใน `contracts/.env`

### Supabase
ดูรายละเอียดใน [supabase/README.md](supabase/README.md)

```bash
npx supabase@3.2.0 login
npx supabase@3.2.0 link --project-ref fzyffuwqssjmxkwcjzne
npx supabase@3.2.0 db push --remote
npx supabase@3.2.0 functions deploy sync-chain --use-api
```

Dashboard → Authentication → **Web3 Wallet → Ethereum: เปิด** และ Redirect URLs: `http://localhost:5173/**`

### ตรวจระบบก่อนพรีเซนต์

```bash
cd web && npm run healthcheck
```

---

## สคริปต์สาธิต (~7 นาที)

เตรียม MetaMask 3 บัญชี: **Admin** (Account 16), **ผู้ขาย**, **ผู้ซื้อ** · ตั้งเวลาเป็นโหมดสาธิต 2 นาทีใน Admin Panel

1. **ปัญหา + แนวคิด** — หน้าแรก: Escrow / คืนเงินอัตโนมัติ / มีคนกลางเมื่อมีปัญหา
2. **ผู้ขายลงสินค้า** — กรอกข้อมูล + รูป → MetaMask → ชี้ป้าย "✔ ตรงกับข้อมูลบน Blockchain" และอธิบายเรื่อง hash
3. **ผู้ซื้อซื้อ** — ใส่ตะกร้า 2 ร้าน → จ่ายครั้งเดียว → เปิด Etherscan ให้ดูว่าเงินเข้า contract ไม่ใช่เข้าผู้ขาย
4. **ข้อมูลส่วนตัว** — ผู้ขายเห็นที่อยู่จัดส่ง แต่คนอื่นเห็นไม่ได้ (รัน `npm run healthcheck` โชว์ 401)
5. **ส่งของ → ยืนยันรับของ** — เงินปลดให้ผู้ขาย หักค่าธรรมเนียม 2% → ผู้ขายกดถอน
6. **กรณีโกง** — ผู้ขายไม่ส่งของ รอ 2 นาที → ผู้ซื้อกดขอเงินคืนได้เอง
7. **แจ้งปัญหา** — ผู้ซื้อแจ้งของไม่ตรงปก + รูป → Admin ตัดสินใน Admin Panel
8. **ความโปร่งใส** — เปิด Events บน Etherscan ให้เห็นว่าทุกการกระทำ (รวมของ Admin) ตรวจสอบย้อนหลังได้

## ความปลอดภัย

- `ReentrancyGuard` + Checks-Effects-Interactions + **Pull Payment** สำหรับทุกการจ่ายเงิน
- Admin ถอนได้เฉพาะค่าธรรมเนียม · ค่าธรรมเนียมสูงสุด 10% · ราคา/ค่าธรรมเนียม/เวลา **บันทึกลงคำสั่งซื้อตอนจ่าย** แก้ย้อนหลังไม่ได้
- Pause หยุดเฉพาะการซื้อ/ลงขาย ผู้ใช้ยังถอนเงินและขอคืนเงินได้ (เงินไม่ติดค้าง)
- Supabase: RLS ทุกตาราง · ตารางที่สะท้อนข้อมูลจาก chain เขียนได้เฉพาะ Edge Function · ผ่าน Security Advisor
- ไม่มี private key / secret key ใน repo (`.env*` อยู่ใน `.gitignore`)

## ข้อจำกัด

- ใช้บน **testnet** เท่านั้น (ไม่ได้ audit สำหรับเงินจริง)
- ไม่ได้เชื่อมระบบขนส่งจริง (ผู้ขายกรอกเลขพัสดุเอง)
- รีวิวเก็บใน Supabase — ผู้ดูแลฐานข้อมูลแก้ไขได้ (เลือกความสะดวกของผู้ใช้แทนความถาวร ดู SCOPE ข้อ 8)
- ฟังก์ชัน `leaveReview` ยังอยู่ใน contract ที่ deploy แล้วแต่ไม่ได้ใช้
