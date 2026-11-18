import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount, useBalance, useConnect, useDisconnect } from "wagmi";
import { useAuth } from "../hooks/useAuth";
import { useIsAdmin } from "../hooks/useMarket";
import { explorer, hoodi } from "../lib/chain";
import { formatEth, shortAddress } from "../lib/format";
import { Spinner } from "./ui";

const hasMetaMask = () => typeof window !== "undefined" && Boolean((window as { ethereum?: unknown }).ethereum);

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address, chainId: hoodi.id, query: { refetchInterval: 20_000 } });
  const { isSignedIn, signIn, signOut, signingIn, error: authError } = useAuth();
  const isAdmin = useIsAdmin();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!hasMetaMask()) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-300"
      >
        🦊 ติดตั้ง MetaMask
      </a>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="flex flex-col items-end">
        <button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-lg bg-mint-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-mint-600 disabled:opacity-60"
        >
          {isPending ? <Spinner className="h-4 w-4" /> : <span aria-hidden>🦊</span>}
          เชื่อมต่อ MetaMask
        </button>
        {connectError && <span className="mt-1 text-xs text-rose-300">{connectError.message.split("\n")[0]}</span>}
      </div>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/10"
        aria-expanded={open}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${isSignedIn ? "bg-mint-400" : "bg-amber-400"}`}
          title={isSignedIn ? "เข้าสู่ระบบแล้ว" : "ยังไม่ได้เข้าสู่ระบบ"}
        />
        <span className="leading-tight">
          <span className="block text-xs text-slate-300">
            {balance ? `${formatEth(balance.value, 4)} ETH` : "…"}
          </span>
          <span className="block font-mono text-sm font-semibold">{shortAddress(address)}</span>
        </span>
        <span className="text-xs text-slate-400">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl bg-white text-slate-800 shadow-xl ring-1 ring-black/10">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="font-mono text-sm">{shortAddress(address)}</div>
            <div className="text-xs text-slate-500">
              Hoodi Testnet · {balance ? `${formatEth(balance.value)} ETH` : "…"}
            </div>
          </div>

          <div className="px-4 py-3">
            {isSignedIn ? (
              <p className="text-sm text-emerald-700">✓ เข้าสู่ระบบแล้ว</p>
            ) : (
              <>
                <p className="mb-2 text-xs text-slate-500">
                  เซ็นข้อความใน MetaMask เพื่อเข้าสู่ระบบ (ไม่เสียค่า gas) — ต้องใช้ตอนกรอกที่อยู่ ลงขาย หรือรีวิว
                </p>
                <button
                  onClick={() => void signIn()}
                  disabled={signingIn}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-navy-900 px-3 py-2 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
                >
                  {signingIn && <Spinner className="h-4 w-4" />}
                  เข้าสู่ระบบด้วย MetaMask
                </button>
                {authError && <p className="mt-2 text-xs text-rose-600">{authError}</p>}
              </>
            )}
          </div>

          <nav className="border-t border-slate-100 py-1 text-sm" onClick={() => setOpen(false)}>
            <MenuLink to="/orders">📦 คำสั่งซื้อของฉัน</MenuLink>
            <MenuLink to="/seller">🏪 ศูนย์ผู้ขาย</MenuLink>
            <MenuLink to="/account">👤 บัญชีของฉัน</MenuLink>
            {isAdmin && <MenuLink to="/admin">🛡️ Admin Panel</MenuLink>}
            <a
              href={explorer.address(address)}
              target="_blank"
              rel="noreferrer"
              className="block px-4 py-2 hover:bg-slate-50"
            >
              🔎 ดูบน Etherscan ↗
            </a>
          </nav>

          <div className="border-t border-slate-100 py-1 text-sm">
            {isSignedIn && (
              <button onClick={() => void signOut()} className="block w-full px-4 py-2 text-left hover:bg-slate-50">
                ออกจากระบบ
              </button>
            )}
            <button
              onClick={() => {
                void signOut();
                disconnect();
                setOpen(false);
              }}
              className="block w-full px-4 py-2 text-left text-rose-600 hover:bg-rose-50"
            >
              ตัดการเชื่อมต่อ MetaMask
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="block px-4 py-2 hover:bg-slate-50">
      {children}
    </Link>
  );
}
