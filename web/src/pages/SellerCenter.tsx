import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { OrderCard } from "../components/OrderCard";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, EthAmount, ProductImage, Spinner, Stars, VerifiedBadge } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { useOrders } from "../hooks/useOrders";
import { categoryOf, formatEth, ratingOf } from "../lib/format";
import { checkDetailsIntegrity } from "../lib/hash";
import { supabase } from "../lib/supabase";
import { toast, useMarketplaceTx } from "../lib/tx";

type Tab = "overview" | "products" | "orders";

export function SellerCenter() {
  return (
    <RequireWallet signIn title="ศูนย์ผู้ขาย">
      <Seller />
    </RequireWallet>
  );
}

function useSellerData(wallet: string) {
  return useQuery({
    queryKey: ["seller", wallet],
    refetchInterval: 15_000,
    queryFn: async () => {
      const [products, seller, profile] = await Promise.all([
        supabase.from("products").select("*, product_details(*)").eq("seller", wallet).order("id", { ascending: false }),
        supabase.from("sellers").select("*").eq("address", wallet).maybeSingle(),
        supabase.from("profiles").select("*").eq("address", wallet).maybeSingle(),
      ]);
      if (products.error) throw products.error;
      return { products: products.data, seller: seller.data, profile: profile.data };
    },
  });
}

function Seller() {
  const { address } = useAccount();
  const wallet = address!.toLowerCase();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const { data, isLoading } = useSellerData(wallet);
  const { data: orders } = useOrders("seller", wallet);

  const toShip = orders?.filter((o) => o.status === 1).length ?? 0;
  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "ภาพรวม" },
    { key: "products", label: `สินค้าของฉัน (${data?.products.length ?? 0})` },
    { key: "orders", label: `คำสั่งซื้อ${toShip ? ` · ต้องจัดส่ง ${toShip}` : ""}` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">🏪 ศูนย์ผู้ขาย</h1>
        <Link to="/seller/products/new" className="rounded-full bg-mint-500 px-4 py-2 font-semibold text-white hover:bg-mint-600">
          + ลงขายสินค้า
        </Link>
      </div>

      {data?.seller?.banned && (
        <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800 ring-1 ring-rose-200">
          ⛔ บัญชีนี้ถูก Admin ระงับการขาย — ลงขายใหม่ไม่ได้ และสินค้าเดิมจะไม่แสดงในตลาด (คำสั่งซื้อเดิมยังดำเนินต่อได้)
        </p>
      )}

      <nav className="flex gap-1 border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${tab === t.key ? "border-mint-500 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"}`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : tab === "overview" ? (
        <Overview wallet={wallet} data={data} orders={orders ?? []} />
      ) : tab === "products" ? (
        <MyProducts products={data.products} />
      ) : (
        <SellerOrders orders={orders} />
      )}
    </div>
  );
}

// ─────────────────────────── ภาพรวม ───────────────────────────

function Overview({
  wallet,
  data,
  orders,
}: {
  wallet: string;
  data: NonNullable<ReturnType<typeof useSellerData>["data"]>;
  orders: NonNullable<ReturnType<typeof useOrders>["data"]>;
}) {
  const rating = ratingOf(data.seller);
  const completed = orders.filter((o) => o.status === 4);
  const revenue = completed.reduce((s, o) => s + BigInt(o.total_wei) - (BigInt(o.total_wei) * BigInt(o.fee_bps)) / 10000n, 0n);
  const stats = [
    { label: "สินค้าที่เปิดขาย", value: String(data.products.filter((p) => p.active && !p.hidden).length) },
    { label: "รอจัดส่ง", value: String(orders.filter((o) => o.status === 1).length) },
    { label: "ขายสำเร็จ", value: String(completed.length) },
    { label: "รายได้สุทธิ", value: `${formatEth(revenue)} ETH` },
  ];

  return (
    <div className="space-y-4">
      <WithdrawCard />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold">ชื่อเสียงร้าน (บน Blockchain)</h2>
          <Stars value={rating.avg} count={rating.count} size="md" />
          <div className="mt-2 flex items-center gap-2 text-sm">
            {data.seller?.verified ? <VerifiedBadge /> : <span className="text-slate-500">ยังไม่ได้รับป้าย Verified จาก Admin</span>}
          </div>
          <Link to={`/shop/${wallet}`} className="mt-3 inline-block text-sm text-sky-700 hover:underline">
            ดูหน้าร้านของฉัน →
          </Link>
        </div>
        <ShopProfileForm wallet={wallet} profile={data.profile} />
      </div>
    </div>
  );
}

function ShopProfileForm({
  wallet,
  profile,
}: {
  wallet: string;
  profile: { shop_name: string | null; display_name: string | null } | null;
}) {
  const qc = useQueryClient();
  const [shopName, setShopName] = useState(profile?.shop_name ?? "");
  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setShopName(profile?.shop_name ?? "");
    setDisplayName(profile?.display_name ?? "");
  }, [profile?.shop_name, profile?.display_name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ address: wallet, shop_name: shopName.trim() || null, display_name: displayName.trim() || null });
    setSaving(false);
    if (error) toast.error("บันทึกโปรไฟล์ไม่สำเร็จ", error.message);
    else {
      toast.success("บันทึกโปรไฟล์ร้านแล้ว");
      void qc.invalidateQueries();
    }
  };

  const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-mint-500";
  return (
    <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">โปรไฟล์ร้าน</h2>
      <input maxLength={60} placeholder="ชื่อร้าน เช่น ร้านคอมมือสองคุณภาพดี" value={shopName} onChange={(e) => setShopName(e.target.value)} className={input} />
      <input maxLength={50} placeholder="ชื่อที่แสดง" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={input} />
      <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
        {saving && <Spinner className="h-3.5 w-3.5" />}
        บันทึก
      </button>
    </form>
  );
}

// ─────────────────────────── สินค้าของฉัน ───────────────────────────

function MyProducts({ products }: { products: NonNullable<ReturnType<typeof useSellerData>["data"]>["products"] }) {
  const { send, pending } = useMarketplaceTx();
  const [busyId, setBusyId] = useState<number | null>(null);

  if (products.length === 0) {
    return (
      <EmptyState icon="📦" title="ยังไม่มีสินค้า">
        <Link to="/seller/products/new" className="text-sky-700 hover:underline">
          ลงขายสินค้าชิ้นแรก
        </Link>
      </EmptyState>
    );
  }

  const toggle = async (id: number, active: boolean) => {
    setBusyId(id);
    await send(active ? `ปิดการขายสินค้า #${id}` : `เปิดการขายสินค้า #${id}`, {
      functionName: "setProductActive",
      args: [BigInt(id), !active],
    });
    setBusyId(null);
  };

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <ul className="divide-y divide-slate-100">
        {products.map((p) => {
          const details = Array.isArray(p.product_details) ? p.product_details[0] : p.product_details;
          const integrity = checkDetailsIntegrity(p.details_hash, details);
          return (
            <li key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <ProductImage images={details?.images} category={p.category} className="h-16 w-16 rounded-lg" iconClass="text-3xl" />
              <div className="min-w-0 flex-1">
                <Link to={`/product/${p.id}`} className="line-clamp-1 font-medium hover:text-sky-700">
                  #{p.id} {p.title}
                </Link>
                <p className="text-sm text-slate-500">
                  {categoryOf(p.category).label} · สต็อก {p.stock} ·{" "}
                  <EthAmount value={formatEth(p.price_wei)} className="font-semibold text-slate-800" />
                </p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs">
                  {p.hidden && <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700">ถูกซ่อนโดย Admin</span>}
                  {!p.active && <span className="rounded bg-slate-200 px-1.5 py-0.5 text-slate-700">ปิดการขาย</span>}
                  {p.active && !p.hidden && <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-emerald-700">เปิดขายอยู่</span>}
                  {integrity === "mismatch" && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">⚠️ รายละเอียดยังไม่ครบ — กดแก้ไขเพื่อบันทึกใหม่</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Link to={`/seller/products/${p.id}/edit`} className="rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50">
                  แก้ไข
                </Link>
                <button
                  onClick={() => void toggle(p.id, p.active)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50"
                >
                  {busyId === p.id && <Spinner className="h-3.5 w-3.5" />}
                  {p.active ? "ปิดการขาย" : "เปิดการขาย"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─────────────────────────── คำสั่งซื้อ ───────────────────────────

function SellerOrders({ orders }: { orders: ReturnType<typeof useOrders>["data"] }) {
  const [onlyActive, setOnlyActive] = useState(true);
  if (!orders) return <Spinner />;
  const shown = onlyActive ? orders.filter((o) => o.status <= 3) : orders;
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="accent-mint-600" checked={onlyActive} onChange={(e) => setOnlyActive(e.target.checked)} />
        แสดงเฉพาะที่ต้องดำเนินการ
      </label>
      {shown.length === 0 ? (
        <EmptyState icon="📭" title="ไม่มีคำสั่งซื้อ" />
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} role="seller" />)
      )}
    </div>
  );
}
