import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { useAccount, useReadContracts } from "wagmi";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, EthAmount, ProductImage, Spinner, Stars, VerifiedBadge } from "../components/ui";
import { useIsAdmin } from "../hooks/useMarket";
import { formatRemaining } from "../hooks/useNow";
import { explorer, marketplace } from "../lib/chain";
import { categoryOf, formatEth, formatThaiDate, ratingOf, shortAddress } from "../lib/format";
import { textHash } from "../lib/hash";
import { supabase, type Tables } from "../lib/supabase";
import { toast, useMarketplaceTx } from "../lib/tx";

type Tab = "disputes" | "products" | "sellers" | "settings";

export function AdminPage() {
  return (
    <RequireWallet signIn title="Admin Panel">
      <AdminGate />
    </RequireWallet>
  );
}

function AdminGate() {
  const isAdmin = useIsAdmin();
  if (!isAdmin) {
    return (
      <EmptyState icon="🛡️" title="เฉพาะ Admin">
        หน้านี้ใช้ได้เฉพาะ wallet ที่เป็น owner ของ Smart Contract เท่านั้น
      </EmptyState>
    );
  }
  return <Admin />;
}

/** ค่าตั้งค่าและสถิติจาก contract โดยตรง */
function useContractState() {
  const base = { address: marketplace.address, abi: marketplace.abi, chainId: marketplace.chainId } as const;
  const q = useReadContracts({
    contracts: [
      { ...base, functionName: "feeBps" },
      { ...base, functionName: "shipWindow" },
      { ...base, functionName: "confirmWindow" },
      { ...base, functionName: "paused" },
      { ...base, functionName: "totalEscrow" },
      { ...base, functionName: "accumulatedFees" },
      { ...base, functionName: "productCount" },
      { ...base, functionName: "orderCount" },
    ],
    query: { refetchInterval: 15_000 },
  });
  const r = (i: number): unknown => q.data?.[i]?.result;
  return {
    refetch: q.refetch,
    loaded: !!q.data,
    feeBps: Number(r(0) ?? 0),
    shipWindow: Number(r(1) ?? 0),
    confirmWindow: Number(r(2) ?? 0),
    paused: Boolean(r(3)),
    totalEscrow: (r(4) as bigint | undefined) ?? 0n,
    accumulatedFees: (r(5) as bigint | undefined) ?? 0n,
    productCount: Number(r(6) ?? 0),
    orderCount: Number(r(7) ?? 0),
  };
}

function Admin() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "disputes";
  const state = useContractState();
  const { data: disputeCount = 0 } = useQuery({
    queryKey: ["admin-dispute-count"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", 3);
      return count ?? 0;
    },
  });

  const stats = [
    { label: "สินค้าทั้งหมด", value: String(state.productCount) },
    { label: "คำสั่งซื้อทั้งหมด", value: String(state.orderCount) },
    { label: "เงินที่ล็อกใน Escrow", value: `${formatEth(state.totalEscrow)} ETH` },
    { label: "ค่าธรรมเนียมสะสม", value: `${formatEth(state.accumulatedFees)} ETH` },
  ];
  const tabs: { key: Tab; label: string }[] = [
    { key: "disputes", label: `🚩 แจ้งปัญหา${disputeCount ? ` (${disputeCount})` : ""}` },
    { key: "products", label: "📦 สินค้า" },
    { key: "sellers", label: "🏪 ผู้ขาย" },
    { key: "settings", label: "⚙️ ตั้งค่าระบบ" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">🛡️ Admin Panel</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${state.paused ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"}`}
        >
          {state.paused ? "⏸ ระบบหยุดชั่วคราว" : "● ระบบเปิดใช้งาน"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-xl font-bold">{state.loaded ? s.value : "…"}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        ทุกการกระทำของ Admin เป็นธุรกรรมบน Blockchain และปล่อย Event ที่ทุกคนตรวจสอบย้อนหลังได้บน{" "}
        <a href={explorer.address(marketplace.address)} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
          Etherscan ↗
        </a>
      </p>

      <nav className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`-mb-px shrink-0 border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? "border-mint-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "disputes" && <Disputes />}
      {tab === "products" && <Products />}
      {tab === "sellers" && <Sellers />}
      {tab === "settings" && <Settings state={state} />}
    </div>
  );
}

// ─────────────────────────── แจ้งปัญหา (ข้อพิพาท) ───────────────────────────

type DisputeOrder = Tables<"orders"> & {
  products: { title: string; category: number } | null;
  dispute_details: Tables<"dispute_details"> | null;
  order_shipping: Tables<"order_shipping"> | null;
};

function Disputes() {
  const [showResolved, setShowResolved] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-disputes", showResolved],
    refetchInterval: 15_000,
    queryFn: async (): Promise<DisputeOrder[]> => {
      let q = supabase
        .from("orders")
        .select("*, products(title, category), dispute_details(*), order_shipping(*)")
        .not("dispute_reason_hash", "is", null)
        .order("id", { ascending: false });
      if (!showResolved) q = q.eq("status", 3);
      const { data, error } = await q;
      if (error) throw error;
      const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? (v[0] ?? null) : v);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map((o) => ({
        ...o,
        products: one(o.products),
        dispute_details: one(o.dispute_details),
        order_shipping: one(o.order_shipping),
      }));
    },
  });

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-mint-600" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        แสดงเรื่องที่ตัดสินแล้วด้วย
      </label>
      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState icon="✅" title="ไม่มีเรื่องแจ้งปัญหาที่รอตัดสิน" />
      ) : (
        data.map((o) => <DisputeCard key={o.id} order={o} />)
      )}
    </div>
  );
}

function DisputeCard({ order }: { order: DisputeOrder }) {
  const { send, pending } = useMarketplaceTx();
  const qc = useQueryClient();
  const [note, setNote] = useState("");
  const d = order.dispute_details;
  const reasonVerified = d ? textHash(d.reason) === order.dispute_reason_hash : null;

  const { data: evidenceUrls } = useQuery({
    queryKey: ["evidence", order.id, d?.evidence],
    enabled: !!d?.evidence.length,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("dispute-evidence").createSignedUrls(d!.evidence, 3600);
      if (error) throw error;
      return data.map((x) => x.signedUrl).filter(Boolean) as string[];
    },
  });

  const resolve = async (refundBuyer: boolean) => {
    const label = refundBuyer ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย";
    if (!confirm(`ยืนยันตัดสินคำสั่งซื้อ #${order.id}: ${label}?\nการตัดสินนี้ย้อนกลับไม่ได้`)) return;
    const r = await send(`ตัดสิน #${order.id}: ${label}`, {
      functionName: "resolveDispute",
      args: [BigInt(order.id), refundBuyer, note.trim()],
    });
    if (r && note.trim() && d) {
      await supabase.from("dispute_details").update({ admin_note: note.trim() }).eq("order_id", order.id);
    }
    if (r) void qc.invalidateQueries();
  };

  const resolved = order.status !== 3;

  return (
    <article className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-sm">
        <span>
          คำสั่งซื้อ <b>#{order.id}</b> · {order.products?.title ?? `สินค้า #${order.product_id}`}
        </span>
        <EthAmount value={formatEth(order.total_wei)} className="font-bold" />
      </header>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2 text-sm">
          <p>
            ผู้ซื้อ{" "}
            <a href={explorer.address(order.buyer)} target="_blank" rel="noreferrer" className="font-mono text-sky-700 hover:underline">
              {shortAddress(order.buyer)}
            </a>{" "}
            · ผู้ขาย{" "}
            <Link to={`/shop/${order.seller}`} className="font-mono text-sky-700 hover:underline">
              {shortAddress(order.seller)}
            </Link>
          </p>
          <p>📦 เลขพัสดุ: <b className="font-mono">{order.tracking_no ?? "-"}</b> · จัดส่ง {formatThaiDate(order.shipped_at)}</p>
          {order.order_shipping && (
            <p className="rounded-lg bg-slate-50 p-2">
              🏠 {order.order_shipping.recipient_name} · {order.order_shipping.phone}
              <br />
              <span className="text-slate-600">{order.order_shipping.address}</span>
            </p>
          )}
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-semibold">🚩 ปัญหาที่ผู้ซื้อแจ้ง</p>
          {d ? (
            <>
              <p className="whitespace-pre-line rounded-lg bg-rose-50 p-2 text-rose-900">{d.reason}</p>
              <p className={`text-xs ${reasonVerified ? "text-emerald-700" : "text-rose-600"}`}>
                {reasonVerified ? "✔ ข้อความตรงกับ hash บน Blockchain" : "⚠️ ข้อความไม่ตรงกับ hash บน Blockchain"}
              </p>
              {evidenceUrls && evidenceUrls.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {evidenceUrls.map((u) => (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      <img src={u} alt="หลักฐาน" className="h-20 w-20 rounded-lg object-cover ring-1 ring-slate-200" />
                    </a>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-500">ผู้ซื้อยังไม่ได้ส่งรายละเอียด (มีเฉพาะ hash บน chain)</p>
          )}
        </div>
      </div>
      <footer className="border-t border-slate-100 px-4 py-3">
        {resolved ? (
          <p className="text-sm text-slate-600">
            ตัดสินแล้ว: <b>{order.resolution_refund ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย"}</b>
            {order.resolution_note && ` — ${order.resolution_note}`}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={280}
              placeholder="เหตุผลการตัดสิน (บันทึกบน Blockchain)"
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-1.5 text-sm outline-none focus:border-mint-500"
            />
            <button
              disabled={pending}
              onClick={() => void resolve(true)}
              className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-50"
            >
              ↩️ คืนเงินผู้ซื้อ
            </button>
            <button
              disabled={pending}
              onClick={() => void resolve(false)}
              className="rounded-full bg-mint-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-mint-600 disabled:opacity-50"
            >
              💰 จ่ายเงินผู้ขาย
            </button>
          </div>
        )}
      </footer>
    </article>
  );
}

// ─────────────────────────── สินค้า ───────────────────────────

function Products() {
  const { send, pending } = useMarketplaceTx();
  const [filter, setFilter] = useState<"all" | "hidden">("all");
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-products"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, product_details(images)").order("id", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = (data ?? []).filter(
    (p) => (filter === "all" || p.hidden) && (!q || `${p.title} ${p.seller} #${p.id}`.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อ / address ผู้ขาย / #id"
          className="min-w-0 flex-1 rounded-full border border-slate-300 bg-white px-4 py-1.5 text-sm outline-none focus:border-mint-500"
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as "all" | "hidden")} className="rounded-full border border-slate-300 bg-white px-3 text-sm">
          <option value="all">ทั้งหมด</option>
          <option value="hidden">เฉพาะที่ถูกซ่อน</option>
        </select>
      </div>
      {isLoading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <EmptyState icon="📦" title="ไม่มีสินค้า" />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {rows.map((p) => {
            const details = Array.isArray(p.product_details) ? p.product_details[0] : p.product_details;
            return (
              <li key={p.id} className="flex flex-wrap items-center gap-3 p-3">
                <ProductImage images={details?.images} category={p.category} className="h-12 w-12 rounded-lg" iconClass="text-2xl" />
                <div className="min-w-0 flex-1 text-sm">
                  <Link to={`/product/${p.id}`} className="line-clamp-1 font-medium hover:text-sky-700">
                    #{p.id} {p.title}
                  </Link>
                  <p className="text-xs text-slate-500">
                    {categoryOf(p.category).label} · {formatEth(p.price_wei)} ETH · สต็อก {p.stock} · ผู้ขาย{" "}
                    <span className="font-mono">{shortAddress(p.seller)}</span>
                    {!p.active && " · ผู้ขายปิดการขาย"}
                  </p>
                </div>
                {p.hidden && <span className="rounded bg-rose-100 px-2 py-0.5 text-xs text-rose-700">ถูกซ่อน</span>}
                <button
                  disabled={pending}
                  onClick={() =>
                    void send(p.hidden ? `เลิกซ่อนสินค้า #${p.id}` : `ซ่อนสินค้า #${p.id}`, {
                      functionName: "setProductHidden",
                      args: [BigInt(p.id), !p.hidden],
                    })
                  }
                  className={`rounded-full px-3 py-1 text-sm ring-1 disabled:opacity-50 ${p.hidden ? "ring-slate-300 hover:bg-slate-50" : "text-rose-700 ring-rose-300 hover:bg-rose-50"}`}
                >
                  {p.hidden ? "เลิกซ่อน" : "🚫 ซ่อนสินค้า"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-500">Admin ซ่อนสินค้าที่ผิดกฎได้ แต่แก้ไขหรือลบสินค้าของผู้ขายไม่ได้ — ประวัติทั้งหมดยังอยู่บน Blockchain</p>
    </div>
  );
}

// ─────────────────────────── ผู้ขาย ───────────────────────────

function Sellers() {
  const { send, pending } = useMarketplaceTx();
  const [lookup, setLookup] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["admin-sellers"],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [sellers, profiles, products] = await Promise.all([
        supabase.from("sellers").select("*"),
        supabase.from("profiles").select("address, shop_name, display_name"),
        supabase.from("products").select("seller"),
      ]);
      const names = new Map((profiles.data ?? []).map((p) => [p.address, p.shop_name ?? p.display_name]));
      const counts = new Map<string, number>();
      for (const p of products.data ?? []) counts.set(p.seller, (counts.get(p.seller) ?? 0) + 1);
      return (sellers.data ?? []).map((s) => ({ ...s, name: names.get(s.address) ?? null, products: counts.get(s.address) ?? 0 }));
    },
  });

  const setFlag = (addr: string, kind: "verified" | "banned", value: boolean) =>
    send(
      kind === "verified" ? `${value ? "ให้" : "ถอน"}ป้าย Verified ${shortAddress(addr)}` : `${value ? "แบน" : "ปลดแบน"} ${shortAddress(addr)}`,
      { functionName: kind === "verified" ? "setSellerVerified" : "setSellerBanned", args: [addr as Address, value] },
    );

  const submitLookup = (e: FormEvent) => {
    e.preventDefault();
    if (!isAddress(lookup.trim())) toast.error("address ไม่ถูกต้อง");
  };
  const lookupValid = isAddress(lookup.trim());

  return (
    <div className="space-y-3">
      <form onSubmit={submitLookup} className="flex flex-wrap gap-2 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <input
          value={lookup}
          onChange={(e) => setLookup(e.target.value)}
          placeholder="จัดการ address อื่น: 0x..."
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-1.5 font-mono text-sm outline-none focus:border-mint-500"
        />
        <button type="button" disabled={!lookupValid || pending} onClick={() => void setFlag(lookup.trim(), "verified", true)} className="rounded-full px-3 py-1 text-sm ring-1 ring-sky-300 hover:bg-sky-50 disabled:opacity-40">
          ✔ Verified
        </button>
        <button type="button" disabled={!lookupValid || pending} onClick={() => void setFlag(lookup.trim(), "banned", true)} className="rounded-full px-3 py-1 text-sm text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50 disabled:opacity-40">
          ⛔ แบน
        </button>
      </form>

      {isLoading ? (
        <Spinner />
      ) : !data?.length ? (
        <EmptyState icon="🏪" title="ยังไม่มีผู้ขาย" />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
          {data.map((s) => {
            const rating = ratingOf(s);
            return (
              <li key={s.address} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/shop/${s.address}`} className="font-medium hover:text-sky-700">
                      {s.name ?? shortAddress(s.address)}
                    </Link>
                    {s.verified && <VerifiedBadge />}
                    {s.banned && <span className="rounded bg-rose-100 px-1.5 text-xs text-rose-700">ถูกแบน</span>}
                  </div>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{s.address}</span> · สินค้า {s.products} รายการ
                  </p>
                  <Stars value={rating.avg} count={rating.count} />
                </div>
                <button disabled={pending} onClick={() => void setFlag(s.address, "verified", !s.verified)} className="rounded-full px-3 py-1 ring-1 ring-sky-300 hover:bg-sky-50 disabled:opacity-50">
                  {s.verified ? "ถอน Verified" : "✔ ให้ Verified"}
                </button>
                <button
                  disabled={pending}
                  onClick={() => {
                    if (s.banned || confirm(`แบนผู้ขาย ${shortAddress(s.address)}?\nสินค้าทั้งหมดจะไม่แสดงและลงขายใหม่ไม่ได้ (คำสั่งซื้อเดิมยังดำเนินต่อได้)`))
                      void setFlag(s.address, "banned", !s.banned);
                  }}
                  className={`rounded-full px-3 py-1 ring-1 disabled:opacity-50 ${s.banned ? "ring-slate-300 hover:bg-slate-50" : "text-rose-700 ring-rose-300 hover:bg-rose-50"}`}
                >
                  {s.banned ? "ปลดแบน" : "⛔ แบน"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─────────────────────────── ตั้งค่าระบบ ───────────────────────────

const UNITS = [
  { label: "นาที", seconds: 60 },
  { label: "ชั่วโมง", seconds: 3600 },
  { label: "วัน", seconds: 86400 },
];

function toUnit(seconds: number) {
  const unit = [...UNITS].reverse().find((u) => seconds % u.seconds === 0) ?? UNITS[0];
  return { value: String(seconds / unit.seconds), unit: unit.seconds };
}

function Settings({ state }: { state: ReturnType<typeof useContractState> }) {
  const { address } = useAccount();
  const { send, pending } = useMarketplaceTx();
  const [fee, setFee] = useState("");
  const [ship, setShip] = useState({ value: "", unit: 60 });
  const [confirmW, setConfirmW] = useState({ value: "", unit: 60 });
  const [feeTo, setFeeTo] = useState("");

  useEffect(() => {
    if (!state.loaded) return;
    setFee(String(state.feeBps / 100));
    setShip(toUnit(state.shipWindow));
    setConfirmW(toUnit(state.confirmWindow));
  }, [state.loaded, state.feeBps, state.shipWindow, state.confirmWindow]);

  if (!state.loaded) return <Spinner />;

  const feeBps = Math.round(Number(fee) * 100);
  const shipSec = Math.round(Number(ship.value) * ship.unit);
  const confirmSec = Math.round(Number(confirmW.value) * confirmW.unit);
  const card = "space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200";
  const input = "w-28 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-mint-500";
  const btn = "rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-white hover:bg-navy-800 disabled:opacity-50";

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className={card}>
        <h2 className="font-semibold">ค่าธรรมเนียมแพลตฟอร์ม</h2>
        <p className="text-sm text-slate-500">ปัจจุบัน {state.feeBps / 100}% · ตั้งได้ 0–10% · ไม่กระทบคำสั่งซื้อที่จ่ายแล้ว</p>
        <div className="flex items-center gap-2">
          <input type="number" min={0} max={10} step={0.01} value={fee} onChange={(e) => setFee(e.target.value)} className={input} />
          <span>%</span>
          <button
            className={btn}
            disabled={pending || !(feeBps >= 0 && feeBps <= 1000) || feeBps === state.feeBps}
            onClick={() => void send(`ตั้งค่าธรรมเนียม ${fee}%`, { functionName: "setFee", args: [feeBps] }).then(() => state.refetch())}
          >
            บันทึก
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="font-semibold">ระยะเวลา</h2>
        <p className="text-sm text-slate-500">
          ปัจจุบัน: ส่งของ {formatRemaining(state.shipWindow * 1000)} · ยืนยันรับของ {formatRemaining(state.confirmWindow * 1000)} (ใช้กับคำสั่งซื้อใหม่เท่านั้น)
        </p>
        {[
          { label: "ผู้ขายต้องส่งของภายใน", v: ship, set: setShip },
          { label: "ผู้ซื้อต้องยืนยันภายใน", v: confirmW, set: setConfirmW },
        ].map((row) => (
          <label key={row.label} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-40">{row.label}</span>
            <input type="number" min={1} value={row.v.value} onChange={(e) => row.set({ ...row.v, value: e.target.value })} className={input} />
            <select value={row.v.unit} onChange={(e) => row.set({ ...row.v, unit: Number(e.target.value) })} className="rounded-md border border-slate-300 px-2 py-1.5">
              {UNITS.map((u) => (
                <option key={u.seconds} value={u.seconds}>
                  {u.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <div className="flex flex-wrap gap-2">
          <button
            className={btn}
            disabled={pending || !(shipSec > 0 && confirmSec > 0) || (shipSec === state.shipWindow && confirmSec === state.confirmWindow)}
            onClick={() => void send("ตั้งระยะเวลา", { functionName: "setDeadlines", args: [shipSec, confirmSec] }).then(() => state.refetch())}
          >
            บันทึก
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
            onClick={() => {
              setShip({ value: "2", unit: 60 });
              setConfirmW({ value: "2", unit: 60 });
            }}
          >
            โหมดสาธิต (2 นาที)
          </button>
          <button
            type="button"
            className="rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50"
            onClick={() => {
              setShip({ value: "3", unit: 86400 });
              setConfirmW({ value: "7", unit: 86400 });
            }}
          >
            ค่าใช้งานจริง (3 / 7 วัน)
          </button>
        </div>
      </div>

      <div className={card}>
        <h2 className="font-semibold">ถอนค่าธรรมเนียม</h2>
        <p className="text-sm text-slate-500">
          สะสมอยู่ <b>{formatEth(state.accumulatedFees)} ETH</b> — ถอนได้เฉพาะค่าธรรมเนียม เงิน Escrow ของผู้ซื้อ ({formatEth(state.totalEscrow)} ETH) Admin แตะไม่ได้
        </p>
        <input
          value={feeTo}
          onChange={(e) => setFeeTo(e.target.value)}
          placeholder="address ปลายทาง (เว้นว่าง = กระเป๋าตัวเอง)"
          className="w-full rounded-md border border-slate-300 px-3 py-1.5 font-mono text-sm outline-none focus:border-mint-500"
        />
        <button
          className={btn}
          disabled={pending || state.accumulatedFees === 0n || (!!feeTo.trim() && !isAddress(feeTo.trim()))}
          onClick={async () => {
            const to = (feeTo.trim() || address) as Address;
            await send("ถอนค่าธรรมเนียม", { functionName: "withdrawFees", args: [to] });
            void state.refetch();
          }}
        >
          ถอนค่าธรรมเนียม
        </button>
      </div>

      <div className={card}>
        <h2 className="font-semibold">หยุดระบบชั่วคราว (Pause)</h2>
        <p className="text-sm text-slate-500">
          ใช้เมื่อพบปัญหา — ระหว่างหยุด <b>ลงขายและซื้อไม่ได้</b> แต่ผู้ใช้ยังยืนยันรับของ ขอคืนเงิน และถอนเงินได้ตามปกติ (เงินไม่ติดค้าง)
        </p>
        <button
          disabled={pending}
          onClick={() => {
            if (state.paused || confirm("หยุดระบบชั่วคราว? ผู้ใช้จะซื้อและลงขายไม่ได้จนกว่าจะเปิดอีกครั้ง"))
              void send(state.paused ? "เปิดระบบ" : "หยุดระบบชั่วคราว", { functionName: state.paused ? "unpause" : "pause", args: [] }).then(() =>
                state.refetch(),
              );
          }}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold disabled:opacity-50 ${state.paused ? "bg-mint-500 text-white hover:bg-mint-600" : "bg-rose-600 text-white hover:bg-rose-700"}`}
        >
          {state.paused ? "▶ เปิดระบบอีกครั้ง" : "⏸ หยุดระบบชั่วคราว"}
        </button>
      </div>
    </div>
  );
}
