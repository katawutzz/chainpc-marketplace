import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Package, Star, Store } from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { PageLoader, Stars, VerifiedBadge } from "../components/ui";
import { useListings } from "../hooks/useMarket";
import { explorer } from "../lib/chain";
import { formatThaiDate, ratingOf, shortAddress } from "../lib/format";
import { supabase } from "../lib/supabase";

export function ShopPage() {
  const seller = (useParams().address ?? "").toLowerCase();
  const [tab, setTab] = useState<"products" | "reviews">("products");
  const { data: listings, isLoading } = useListings();
  const { data: shop } = useQuery({
    queryKey: ["shop", seller],
    queryFn: async () => {
      const [info, profile, reviews] = await Promise.all([
        supabase.from("sellers").select("*").eq("address", seller).maybeSingle(),
        supabase.from("profiles").select("*").eq("address", seller).maybeSingle(),
        supabase.from("reviews").select("*").eq("seller", seller).order("created_at", { ascending: false }).limit(50),
      ]);
      return { info: info.data, profile: profile.data, reviews: reviews.data ?? [] };
    },
  });

  const products = listings?.filter((p) => p.seller === seller) ?? [];
  const rating = ratingOf(shop?.info);
  const name = shop?.profile?.shop_name ?? shop?.profile?.display_name ?? `ร้าน ${shortAddress(seller)}`;
  const sold = products.reduce((s, p) => s + p.sold, 0);

  return (
    <div className="space-y-3">
      <section className="card grid gap-6 p-5 md:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-sm bg-gradient-to-br from-slate-800 to-slate-700 p-5 text-white">
          <div className="flex items-center gap-4">
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/15 ring-2 ring-white/30">
              <Store className="h-8 w-8" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-medium">{name}</h1>
              <div className="mt-1 flex items-center gap-2">
                {shop?.info?.verified && <VerifiedBadge />}
                {shop?.info?.banned && <span className="rounded-sm bg-rose-600 px-1.5 text-[11px]">ถูกระงับการขาย</span>}
              </div>
            </div>
          </div>
          <a href={explorer.address(seller)} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-1 font-mono text-xs text-white/70 hover:text-white">
            {seller} <ExternalLink className="h-3 w-3 shrink-0" />
          </a>
        </div>
        <dl className="grid grid-cols-1 content-center gap-x-10 gap-y-4 text-sm sm:grid-cols-2">
          <Stat icon={Package} label="สินค้า" value={String(products.length)} />
          <Stat icon={Star} label="คะแนน" value={rating.count ? `${rating.avg.toFixed(1)} (${rating.count} คะแนน)` : "ยังไม่มีคะแนน"} />
          <Stat icon={Store} label="ขายแล้ว" value={`${sold} ชิ้น`} />
          <Stat icon={Star} label="สถานะร้าน" value={shop?.info?.verified ? "Verified โดย Admin" : "ร้านทั่วไป"} />
        </dl>
      </section>

      <nav className="card flex">
        {(
          [
            ["products", `สินค้าทั้งหมด (${products.length})`],
            ["reviews", `คะแนนร้านค้า (${shop?.reviews.length ?? 0})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`border-b-2 px-6 py-4 text-sm ${tab === k ? "border-brand-500 text-brand-600" : "border-transparent text-slate-700 hover:text-brand-600"}`}
          >
            {label}
          </button>
        ))}
      </nav>

      {tab === "products" ? (
        isLoading ? (
          <PageLoader />
        ) : products.length === 0 ? (
          <div className="card flex flex-col items-center py-16 text-slate-500">
            <Package className="h-14 w-14 text-slate-300" strokeWidth={1.25} />
            <p className="mt-3 text-sm">ร้านนี้ยังไม่มีสินค้าที่เปิดขาย</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )
      ) : (
        <section className="card px-6 py-2">
          {!shop?.reviews.length ? (
            <p className="py-12 text-center text-sm text-slate-500">ยังไม่มีคะแนนสำหรับร้านนี้</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shop.reviews.map((r) => (
                <li key={r.order_id} className="flex gap-3 py-4 text-sm">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                    {r.buyer.slice(2, 4).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-slate-700">{shortAddress(r.buyer)}</p>
                    <Stars value={r.rating} />
                    <p className="text-xs text-slate-400">
                      {formatThaiDate(r.created_at)} · ซื้อจริง (คำสั่งซื้อ #{r.order_id})
                    </p>
                    {r.comment && <p className="mt-2 text-slate-800">{r.comment}</p>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Store; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-4 w-4 text-slate-500" />
      <dt className="text-slate-600">{label}:</dt>
      <dd className="text-brand-600">{value}</dd>
    </div>
  );
}
