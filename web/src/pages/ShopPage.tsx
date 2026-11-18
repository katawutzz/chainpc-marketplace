import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, Spinner, Stars, VerifiedBadge } from "../components/ui";
import { useListings } from "../hooks/useMarket";
import { explorer } from "../lib/chain";
import { formatThaiDate, ratingOf, shortAddress } from "../lib/format";
import { supabase } from "../lib/supabase";

export function ShopPage() {
  const seller = (useParams().address ?? "").toLowerCase();
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

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-navy-900 text-3xl">🏪</div>
        <div className="min-w-0 flex-1">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold">
            {name} {shop?.info?.verified && <VerifiedBadge />}
          </h1>
          <Stars value={rating.avg} count={rating.count} size="md" />
          <a href={explorer.address(seller)} target="_blank" rel="noreferrer" className="block font-mono text-xs text-sky-700 hover:underline">
            {seller} ↗
          </a>
        </div>
        {shop?.info?.banned && <span className="rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700">ถูกระงับการขาย</span>}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">สินค้าของร้าน ({products.length})</h2>
        {isLoading ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState icon="📦" title="ร้านนี้ยังไม่มีสินค้าที่เปิดขาย" />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {products.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">รีวิวจากผู้ซื้อ</h2>
        <p className="-mt-2 mb-3 text-xs text-slate-500">รีวิวได้เฉพาะผู้ที่ซื้อสินค้าจากร้านนี้สำเร็จจริง · 1 รีวิวต่อคำสั่งซื้อ</p>
        {!shop?.reviews.length ? (
          <p className="text-sm text-slate-500">ยังไม่มีรีวิว</p>
        ) : (
          <ul className="space-y-3">
            {shop.reviews.map((r) => (
              <li key={r.order_id} className="rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Stars value={r.rating} />
                  <span className="text-xs text-slate-500">
                    {shortAddress(r.buyer)} · ✔ ซื้อจริง (คำสั่งซื้อ #{r.order_id}) · {formatThaiDate(r.created_at)}
                  </span>
                </div>
                {r.comment && <p className="mt-2 text-slate-700">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
