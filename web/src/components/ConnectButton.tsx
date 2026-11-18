import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ExternalLink, LogOut, Package, ShieldCheck, Store, User, Wallet } from "lucide-react";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { useAuth } from "../hooks/useAuth";
import { useIsAdmin } from "../hooks/useMarket";
import { explorer, hoodi } from "../lib/chain";
import { formatEth, shortAddress } from "../lib/format";
import { Button, Spinner } from "./ui";

const hasMetaMask = () => typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);

/** ปุ่มกระเป๋าเงินบนแถบบนสุด (ตัวอักษรสีขาว) */
export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: hoodi.id, query: { refetchInterval: 20_000 } });
  const { isSignedIn, signIn, signOut, signingIn, error: authError } = useAuth();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!hasMetaMask()) {
    return (
      <a href="https://metamask.io/download/" target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:opacity-80">
        <Wallet className="h-4 w-4" /> ติดตั้ง MetaMask
      </a>
    );
  }

  if (!isConnected || !address) {
    return (
      <button onClick={() => connect({ connector: connectors[0] })} disabled={isPending} className="flex items-center gap-1 font-medium hover:opacity-80">
        {isPending ? <Spinner className="h-4 w-4 text-white" /> : <Wallet className="h-4 w-4" />}
        เชื่อมต่อ MetaMask
      </button>
    );
  }

  const initial = address.slice(2, 4).toUpperCase();

  return (
    <div className="relative" ref={ref} onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} onMouseEnter={() => setOpen(true)} className="flex items-center gap-1.5 hover:opacity-90" aria-expanded={open}>
        <span className="relative grid h-6 w-6 place-items-center rounded-full bg-white/90 text-[10px] font-bold text-brand-600">
          {initial}
          <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-brand-500 ${isSignedIn ? "bg-emerald-400" : "bg-amber-300"}`} />
        </span>
        <span className="font-mono">{shortAddress(address)}</span>
        <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 pt-2">
          <div className="w-72 origin-top-right animate-pop overflow-hidden rounded-sm bg-white text-sm text-slate-700 shadow-xl ring-1 ring-black/5">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="font-mono text-slate-900">{shortAddress(address)}</p>
              <p className="text-xs text-slate-500">
                Hoodi Testnet · <span className="text-brand-600">{balance ? `${formatEth(balance.value)} ETH` : "…"}</span>
              </p>
            </div>

            <div className="border-b border-slate-100 px-4 py-3">
              {isSignedIn ? (
                <p className="flex items-center gap-1.5 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" /> เข้าสู่ระบบแล้ว
                </p>
              ) : (
                <>
                  <p className="mb-2 text-xs text-slate-500">เซ็นข้อความใน MetaMask เพื่อเข้าสู่ระบบ (ไม่เสียค่า gas)</p>
                  <Button onClick={() => void signIn()} loading={signingIn} className="w-full" size="sm">
                    เข้าสู่ระบบด้วย MetaMask
                  </Button>
                  {authError && <p className="mt-2 text-xs text-rose-600">{authError}</p>}
                </>
              )}
            </div>

            <nav className="py-1" onClick={() => setOpen(false)}>
              <MenuLink to="/account" icon={User}>บัญชีของฉัน</MenuLink>
              <MenuLink to="/orders" icon={Package}>การซื้อของฉัน</MenuLink>
              <MenuLink to="/seller" icon={Store}>ศูนย์ผู้ขาย</MenuLink>
              {isAdmin && <MenuLink to="/admin" icon={ShieldCheck}>Admin Panel</MenuLink>}
              <a href={explorer.address(address)} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 hover:text-brand-600">
                <ExternalLink className="h-4 w-4" /> ดูบน Etherscan
              </a>
            </nav>

            <div className="border-t border-slate-100 py-1">
              {isSignedIn && (
                <button onClick={() => void signOut()} className="flex w-full items-center gap-2 px-4 py-2 hover:bg-slate-50">
                  <LogOut className="h-4 w-4" /> ออกจากระบบ
                </button>
              )}
              <button
                onClick={() => {
                  void signOut();
                  disconnect();
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-rose-600 hover:bg-rose-50"
              >
                <Wallet className="h-4 w-4" /> ตัดการเชื่อมต่อ MetaMask
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, icon: Icon, children }: { to: string; icon: typeof User; children: React.ReactNode }) {
  return (
    <Link to={to} className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 hover:text-brand-600">
      <Icon className="h-4 w-4" /> {children}
    </Link>
  );
}
