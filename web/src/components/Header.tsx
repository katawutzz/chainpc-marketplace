import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useUnreadNotifications } from "../hooks/useMarket";
import { CATEGORIES } from "../lib/format";
import { useCartCount } from "../store/cart";
import { ConnectButton } from "./ConnectButton";

export function Header() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [cat, setCat] = useState(params.get("cat") ?? "");
  const cartCount = useCartCount();
  const { isSignedIn, sessionWallet } = useAuth();
  const { data: unread = 0 } = useUnreadNotifications(sessionWallet, isSignedIn);

  useEffect(() => {
    setQ(params.get("q") ?? "");
    setCat(params.get("cat") ?? "");
  }, [params]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (cat) next.set("cat", cat);
    navigate({ pathname: "/", search: next.toString() });
  };

  return (
    <header className="bg-navy-900 text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5">
        <Link to="/" className="flex shrink-0 items-center gap-2 rounded px-1 py-1 hover:ring-1 hover:ring-white/40">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-mint-500 text-lg font-bold text-navy-900">
            ⛓
          </span>
          <span className="text-xl font-bold tracking-tight">
            Chain<span className="text-mint-400">PC</span>
          </span>
        </Link>

        <form
          onSubmit={onSearch}
          className="order-last flex w-full overflow-hidden rounded-lg ring-mint-400 focus-within:ring-2 md:order-none md:w-auto md:flex-1"
          role="search"
        >
          <select
            value={cat}
            onChange={(e) => setCat(e.target.value)}
            className="max-w-36 shrink-0 border-r border-slate-300 bg-slate-100 px-2 text-sm text-slate-700 outline-none"
            aria-label="หมวดหมู่"
          >
            <option value="">ทุกหมวดหมู่</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา เช่น RTX 4070, Ryzen 7, SSD 1TB"
            className="min-w-0 flex-1 bg-white px-3 py-2 text-slate-900 outline-none"
            aria-label="ค้นหาสินค้า"
          />
          <button type="submit" className="bg-mint-500 px-4 text-lg hover:bg-mint-400" aria-label="ค้นหา">
            🔍
          </button>
        </form>

        <nav className="ml-auto flex items-center gap-1 md:ml-0">
          <ConnectButton />

          <HeaderLink to="/orders" label="คำสั่งซื้อ" sub="ของฉัน" />

          <NavLink to="/account" className="relative rounded px-2 py-1.5 text-2xl hover:ring-1 hover:ring-white/40" aria-label="แจ้งเตือน">
            🔔
            {unread > 0 && (
              <span className="absolute -top-0.5 right-0 min-w-5 rounded-full bg-rose-500 px-1 text-center text-xs font-bold">
                {unread}
              </span>
            )}
          </NavLink>

          <NavLink
            to="/cart"
            className="relative flex items-end gap-1 rounded px-2 py-1.5 hover:ring-1 hover:ring-white/40"
            aria-label={`ตะกร้า ${cartCount} ชิ้น`}
          >
            <span className="text-2xl">🛒</span>
            <span className="hidden text-sm font-semibold sm:inline">ตะกร้า</span>
            <span className="absolute -top-0.5 left-6 min-w-5 rounded-full bg-mint-400 px-1 text-center text-xs font-bold text-navy-900">
              {cartCount}
            </span>
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function HeaderLink({ to, label, sub }: { to: string; label: string; sub: string }) {
  return (
    <NavLink to={to} className="hidden rounded px-2 py-1 leading-tight hover:ring-1 hover:ring-white/40 lg:block">
      <span className="block text-xs text-slate-300">{sub}</span>
      <span className="block text-sm font-semibold">{label}</span>
    </NavLink>
  );
}
