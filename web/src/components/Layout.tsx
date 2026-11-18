import { Link, Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import { explorer, marketplace } from "../lib/chain";
import { shortAddress } from "../lib/format";
import { Header } from "./Header";
import { NetworkBanner } from "./NetworkBanner";
import { Toasts } from "./Toasts";

export function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <NetworkBanner />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">
        {/* key = path → เล่นอนิเมชันเฟดขึ้นทุกครั้งที่เปลี่ยนหน้า */}
        <div key={pathname} className="animate-page">
          <Outlet />
        </div>
      </main>
      <Footer />
      <Toasts />
      <ScrollRestoration />
    </div>
  );
}

function Footer() {
  const col = "space-y-2 text-sm text-slate-600";
  const link = "block hover:text-brand-600";
  return (
    <footer className="mt-10 border-t-4 border-brand-500 bg-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-4 py-10 md:grid-cols-4">
        <div className={col}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">บริการลูกค้า</h3>
          <Link to="/orders" className={link}>การซื้อของฉัน</Link>
          <Link to="/account" className={link}>บัญชีของฉัน</Link>
          <Link to="/account/notifications" className={link}>การแจ้งเตือน</Link>
          <Link to="/cart" className={link}>รถเข็นสินค้า</Link>
        </div>
        <div className={col}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">สำหรับผู้ขาย</h3>
          <Link to="/seller" className={link}>ศูนย์ผู้ขาย</Link>
          <Link to="/seller/products/new" className={link}>ลงขายสินค้า</Link>
          <Link to="/seller?tab=orders" className={link}>จัดการคำสั่งซื้อ</Link>
        </div>
        <div className={col}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">ซื้อขายอย่างปลอดภัย</h3>
          <p>เงินถูกล็อกใน Smart Contract จนกว่าผู้ซื้อยืนยันรับของ</p>
          <p>ผู้ขายไม่ส่งของตามกำหนด ขอเงินคืนได้ทันที</p>
          <p>ของไม่ตรงปก แจ้งปัญหาให้ Admin ตัดสิน</p>
        </div>
        <div className={col}>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-800">การชำระเงิน</h3>
          <p>MetaMask · ETH บน Ethereum Hoodi Testnet</p>
          <a href={explorer.address(marketplace.address)} target="_blank" rel="noreferrer" className={`${link} font-mono`}>
            Contract {shortAddress(marketplace.address)}
          </a>
        </div>
      </div>
      <div className="border-t border-slate-100 py-5 text-center text-xs text-slate-500">
        © 2569 ChainPC · ตลาดซื้อขายคอมพิวเตอร์ด้วย Smart Contract · โปรเจกต์เพื่อการศึกษาบน Testnet
      </div>
    </footer>
  );
}
