import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ClipboardList, Package, Pencil, Plus, TriangleAlert } from "lucide-react";
import { useAccount } from "wagmi";
import { OrderCard } from "../components/OrderCard";
import { RequireWallet } from "../components/RequireWallet";
import { SellerLayout } from "../components/SellerLayout";
import { Button, PageLoader, Pill, Price, ProductImage, Stars, VerifiedBadge } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { useOrders } from "../hooks/useOrders";
import { categoryOf, formatEth, ratingOf } from "../lib/format";
import { checkDetailsIntegrity } from "../lib/hash";
import { supabase } from "../lib/supabase";
import { toast, useMarketplaceTx } from "../lib/tx";

type Tab = "overview" | "products" | "orders" | "shop";

export function SellerCenter() {
  return (
    <RequireWallet signIn title="ศูนย์ผู้ขาย">
      <SellerLayout>
        <Seller />
      </SellerLayout>
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

type SellerData = NonNullable<ReturnType<typeof useSellerData>["data"]>;
type Orders = NonNullable<ReturnType<typeof useOrders>["data"]>;

function Seller() {
  const { address } = useAccount();
  const wallet = address!.toLowerCase();
  const [params] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "overview";
  const { data, isLoading } = useSellerData(wallet);
  const { data: orders } = useOrders("seller", wallet);

  if (isLoading || !data) return <PageLoader />;

  return (
    <div className="space-y-3">
      {data.seller?.banned && (
        <p className="card flex items-center gap-2 border-l-4 border-rose-500 px-4 py-3 text-sm text-rose-800">
          <Ban className="h-4 w-4 shrink-0" /> บัญชีนี้ถูก Admin ระงับการขาย — ลงขายใหม่ไม่ได้ และสินค้าเดิมจะไม่แสดงในตลาด (คำสั่งซื้อเดิมยังดำเนินต่อได้)
        </p>
      )}
      {tab === "overview" && <Overview wallet={wallet} data={data} orders={orders ?? []} />}
      {tab === "products" && <MyProducts products={data.products} />}
      {tab === "orders" && <SellerOrders orders={orders} />}
      {tab === "shop" && <ShopProfileForm wallet={wallet} profile={data.profile} />}
    </div>
  );
}

// ─────────────────────────── ภาพรวม ───────────────────────────

function Overview({ wallet, data, orders }: { wallet: string; data: SellerData; orders: Orders }) {
  const rating = ratingOf(data.seller);
  const completed = orders.filter((o) => o.status === 4);
  const revenue = completed.reduce((s, o) => s + BigInt(o.total_wei) - (BigInt(o.total_wei) * BigInt(o.fee_bps)) / 10000n, 0n);
  const todo = [
    { label: "ที่ต้องจัดส่ง", value: orders.filter((o) => o.status === 1).length, to: "/seller?tab=orders" },
    { label: "รอผู้ซื้อยืนยัน", value: orders.filter((o) => o.status === 2).length, to: "/seller?tab=orders" },
    { label: "ผู้ซื้อแจ้งปัญหา", value: orders.filter((o) => o.status === 3).length, to: "/seller?tab=orders" },
    { label: "สินค้าที่เปิดขาย", value: data.products.filter((p) => p.active && !p.hidden).length, to: "/seller?tab=products" },
  ];

  return (
    <>
      <section className="card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h1 className="text-lg">สิ่งที่ต้องทำ</h1>
          <p className="text-sm text-slate-500">รายการที่คุณต้องดำเนินการ</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4">
          {todo.map((t) => (
            <Link key={t.label} to={t.to} className="border-b border-r border-slate-100 px-4 py-6 text-center hover:bg-slate-50">
              <p className="text-2xl text-sky-600">{t.value}</p>
              <p className="mt-1 text-sm text-slate-600">{t.label}</p>
            </Link>
          ))}
        </div>
      </section>

      <WithdrawCard />

      <section className="card grid gap-6 p-6 md:grid-cols-3">
        <div>
          <p className="text-sm text-slate-500">ขายสำเร็จ</p>
          <p className="mt-1 text-2xl">{completed.length} คำสั่งซื้อ</p>
        </div>
        <div>
          <p className="text-sm text-slate-500">รายได้สุทธิ (หลังหักค่าธรรมเนียม)</p>
          <Price value={formatEth(revenue)} size="lg" />
        </div>
        <div>
          <p className="text-sm text-slate-500">คะแนนร้าน</p>
          <div className="mt-1 flex items-center gap-2">
            <Stars value={rating.avg} count={rating.count} size="md" />
            {data.seller?.verified && <VerifiedBadge />}
          </div>
          <Link to={`/shop/${wallet}`} className="mt-1 inline-block text-sm text-sky-700 hover:underline">
            ดูหน้าร้านของฉัน
          </Link>
        </div>
      </section>
    </>
  );
}

// ─────────────────────────── ข้อมูลร้าน ───────────────────────────

function ShopProfileForm({ wallet, profile }: { wallet: string; profile: SellerData["profile"] }) {
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
    const { error } = await supabase.from("profiles").upsert({ address: wallet, shop_name: shopName.trim() || null, display_name: displayName.trim() || null });
    setSaving(false);
    if (error) toast.error("บันทึกข้อมูลร้านไม่สำเร็จ", error.message);
    else {
      toast.success("บันทึกข้อมูลร้านแล้ว");
      void qc.invalidateQueries();
    }
  };

  return (
    <form onSubmit={save} className="card">
      <div className="border-b border-slate-100 px-6 py-4">
        <h1 className="text-lg">ข้อมูลร้านค้า</h1>
        <p className="text-sm text-slate-500">ชื่อร้านจะแสดงบนหน้าสินค้าและหน้าร้าน</p>
      </div>
      <div className="max-w-xl space-y-4 px-6 py-6">
        <label className="block">
          <span className="label">ชื่อร้าน</span>
          <input maxLength={60} placeholder="เช่น ร้านคอมมือสองคุณภาพดี" value={shopName} onChange={(e) => setShopName(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">ชื่อที่แสดง</span>
          <input maxLength={50} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="input" />
        </label>
        <Button loading={saving} className="w-28">
          บันทึก
        </Button>
      </div>
    </form>
  );
}

// ─────────────────────────── สินค้าของฉัน ───────────────────────────

function MyProducts({ products }: { products: SellerData["products"] }) {
  const { send, pending } = useMarketplaceTx();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "active" | "inactive">("all");

  const toggle = async (id: number, active: boolean) => {
    setBusyId(id);
    await send(active ? `ปิดการขายสินค้า #${id}` : `เปิดการขายสินค้า #${id}`, { functionName: "setProductActive", args: [BigInt(id), !active] });
    setBusyId(null);
  };

  const shown = products.filter((p) => (filter === "all" ? true : filter === "active" ? p.active && !p.hidden : !p.active || p.hidden));

  return (
    <section className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-6 py-4">
        <div className="flex gap-1 text-sm">
          {(
            [
              ["all", `ทั้งหมด (${products.length})`],
              ["active", "กำลังขาย"],
              ["inactive", "ปิดการขาย / ถูกซ่อน"],
            ] as const
          ).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`rounded-sm px-3 py-1.5 ${filter === k ? "bg-brand-50 text-brand-600" : "text-slate-600 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
        <Link to="/seller/products/new" className="inline-flex h-10 items-center gap-2 rounded-sm bg-brand-500 px-4 text-sm text-white hover:bg-brand-600">
          <Plus className="h-4 w-4" /> เพิ่มสินค้าใหม่
        </Link>
      </div>

      {shown.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-slate-500">
          <Package className="h-14 w-14 text-slate-300" strokeWidth={1.25} />
          <p className="mt-3 text-sm">ยังไม่มีสินค้า</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-6 py-3 font-normal">ชื่อสินค้า</th>
                <th className="px-3 py-3 font-normal">ราคา</th>
                <th className="px-3 py-3 font-normal">คลัง</th>
                <th className="px-3 py-3 font-normal">สถานะ</th>
                <th className="px-6 py-3 text-right font-normal">ดำเนินการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((p) => {
                const details = Array.isArray(p.product_details) ? p.product_details[0] : p.product_details;
                const integrity = checkDetailsIntegrity(p.details_hash, details);
                return (
                  <tr key={p.id}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-3">
                        <ProductImage images={details?.images} category={p.category} className="h-14 w-14 shrink-0 border border-slate-100" />
                        <div className="min-w-0">
                          <Link to={`/product/${p.id}`} className="line-clamp-2 hover:text-brand-600">
                            {p.title}
                          </Link>
                          <p className="text-xs text-slate-400">
                            #{p.id} · {categoryOf(p.category).label}
                          </p>
                          {integrity === "mismatch" && (
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-700">
                              <TriangleAlert className="h-3.5 w-3.5" /> รายละเอียดยังไม่ครบ — กดแก้ไขเพื่อบันทึกใหม่
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{formatEth(p.price_wei)} ETH</td>
                    <td className="px-3 py-3">{p.stock}</td>
                    <td className="px-3 py-3">
                      {p.hidden ? <Pill tone="danger">ถูกซ่อนโดย Admin</Pill> : p.active ? <Pill tone="ok">กำลังขาย</Pill> : <Pill tone="muted">ปิดการขาย</Pill>}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        <Link to={`/seller/products/${p.id}/edit`} className="inline-flex h-8 items-center gap-1 rounded-sm border border-slate-300 px-3 hover:bg-slate-50">
                          <Pencil className="h-3.5 w-3.5" /> แก้ไข
                        </Link>
                        <Button size="sm" variant="secondary" loading={busyId === p.id} disabled={pending} onClick={() => void toggle(p.id, p.active)}>
                          {p.active ? "ปิดการขาย" : "เปิดการขาย"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────── คำสั่งซื้อ ───────────────────────────

const ORDER_TABS = [
  { key: "todo", label: "ที่ต้องดำเนินการ", match: (s: number) => s <= 3 },
  { key: "ship", label: "ที่ต้องจัดส่ง", match: (s: number) => s === 1 },
  { key: "shipped", label: "จัดส่งแล้ว", match: (s: number) => s === 2 },
  { key: "done", label: "สำเร็จ", match: (s: number) => s === 4 },
  { key: "refund", label: "คืนเงิน", match: (s: number) => s === 5 },
  { key: "all", label: "ทั้งหมด", match: () => true },
] as const;

function SellerOrders({ orders }: { orders: ReturnType<typeof useOrders>["data"] }) {
  const [tab, setTab] = useState<(typeof ORDER_TABS)[number]["key"]>("todo");
  if (!orders) return <PageLoader />;
  const match = ORDER_TABS.find((t) => t.key === tab)!.match;
  const shown = orders.filter((o) => match(o.status));

  return (
    <div className="space-y-3">
      <nav className="card flex overflow-x-auto">
        {ORDER_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`min-w-28 flex-1 shrink-0 border-b-2 px-3 py-4 text-sm ${tab === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-700 hover:text-brand-600"}`}
          >
            {t.label} <span className="text-slate-400">({orders.filter((o) => t.match(o.status)).length})</span>
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <div className="card flex flex-col items-center py-16 text-slate-500">
          <ClipboardList className="h-14 w-14 text-slate-300" strokeWidth={1.25} />
          <p className="mt-3 text-sm">ไม่มีคำสั่งซื้อ</p>
        </div>
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} role="seller" />)
      )}
    </div>
  );
}
