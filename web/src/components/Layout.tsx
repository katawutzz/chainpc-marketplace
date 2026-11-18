import { Outlet, ScrollRestoration } from "react-router-dom";
import { explorer, marketplace } from "../lib/chain";
import { shortAddress } from "../lib/format";
import { CategoryBar } from "./CategoryBar";
import { Header } from "./Header";
import { NetworkBanner } from "./NetworkBanner";

export function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <CategoryBar />
      <NetworkBanner />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <Outlet />
      </main>
      <footer className="bg-navy-900 text-sm text-slate-300">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-5">
          <span>
            <b className="text-white">ChainPC</b> · ตลาดซื้อขายคอมพิวเตอร์ด้วย Smart Contract บน Ethereum Hoodi Testnet
          </span>
          <a
            href={explorer.address(marketplace.address)}
            target="_blank"
            rel="noreferrer"
            className="font-mono hover:text-mint-400"
          >
            Contract {shortAddress(marketplace.address)} ↗
          </a>
        </div>
      </footer>
      <ScrollRestoration />
    </div>
  );
}
