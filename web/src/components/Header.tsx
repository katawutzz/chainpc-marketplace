import { Link, useNavigate } from "react-router-dom";
import { Bell, Cpu, Package, ShoppingCart, Store } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useUnreadNotifications } from "../hooks/useMarket";
import { useCartCount } from "../store/cart";
import { ConnectButton } from "./ConnectButton";
import { SearchBox } from "./SearchBox";

const SUGGESTIONS = ["RTX 4070", "Ryzen 7", "DDR5 32GB", "SSD 1TB", "จอ 165Hz", "คีย์บอร์ด"];

export function Header() {
  const navigate = useNavigate();
  const cartCount = useCartCount();
  const { isSignedIn, sessionWallet } = useAuth();
  const { data: unread = 0 } = useUnreadNotifications(sessionWallet, isSignedIn);

  const search = (term: string) => navigate({ pathname: "/", search: `?q=${encodeURIComponent(term)}` });

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-b from-brand-600 to-brand-500 text-white shadow-sm">
      {/* แถบบนสุด */}
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 pt-1.5 text-[13px]">
        <nav className="hidden items-center divide-x divide-white/40 md:flex">
          <Link to="/seller" className="flex items-center gap-1 pr-3 hover:opacity-80">
            <Store className="h-3.5 w-3.5" /> ศูนย์ผู้ขาย
          </Link>
          <Link to="/seller/products/new" className="px-3 hover:opacity-80">
            เริ่มขายสินค้า
          </Link>
          <span className="flex items-center gap-1.5 pl-3 text-white/90">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Ethereum Hoodi Testnet
          </span>
        </nav>
        <nav className="ml-auto flex items-center gap-4">
          <Link to="/account/notifications" className="relative flex items-center gap-1 hover:opacity-80">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">การแจ้งเตือน</span>
            {unread > 0 && (
              <span className="absolute -left-1.5 -top-1.5 min-w-4 rounded-full bg-white px-1 text-center text-[10px] font-bold leading-4 text-brand-600">
                {unread}
              </span>
            )}
          </Link>
          <Link to="/orders" className="hidden items-center gap-1 hover:opacity-80 sm:flex">
            <Package className="h-4 w-4" /> การซื้อของฉัน
          </Link>
          <ConnectButton />
        </nav>
      </div>

      {/* โลโก้ + ค้นหา + ตะกร้า */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-2 px-4 pb-3 pt-3 md:flex-nowrap md:pb-2">
        <Link to="/" className="flex shrink-0 items-center gap-2" aria-label="ChainPC หน้าแรก">
          <span className="grid h-10 w-10 place-items-center rounded-md bg-white text-brand-500">
            <Cpu className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <span className="text-[28px] font-semibold leading-none tracking-tight">ChainPC</span>
        </Link>

        <div className="order-last w-full md:order-none md:flex-1">
          <SearchBox />
          <div className="mt-1.5 hidden gap-3 overflow-hidden whitespace-nowrap text-xs text-white/90 md:flex">
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => search(s)} className="hover:text-white">
                {s}
              </button>
            ))}
          </div>
        </div>

        <Link to="/cart" className="relative ml-auto mr-2 shrink-0 md:ml-0" aria-label={`รถเข็น ${cartCount} รายการ`}>
          <ShoppingCart className="h-7 w-7" strokeWidth={1.75} />
          {cartCount > 0 && (
            // key = จำนวน → เด้งเบา ๆ ทุกครั้งที่เพิ่มของลงรถเข็น
            <span key={cartCount} className="absolute -right-3 -top-2 min-w-6 animate-bump rounded-full border-2 border-brand-500 bg-white px-1 text-center text-xs font-semibold leading-4 text-brand-600">
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
