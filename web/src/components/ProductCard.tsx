import { Link } from "react-router-dom";
import type { ProductListing } from "../hooks/useMarket";
import { categoryOf, formatEth, ratingOf } from "../lib/format";
import { ConditionBadge, EthAmount, ProductImage, Stars, VerifiedBadge } from "./ui";

export function ProductCard({ product }: { product: ProductListing }) {
  const rating = ratingOf(product.sellerInfo);
  const shop = product.sellerProfile?.shop_name;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md hover:ring-mint-400"
    >
      <div className="relative bg-white p-3">
        <ProductImage images={product.details?.images} category={product.category} className="aspect-square w-full" />
        <div className="absolute left-3 top-3">
          <ConditionBadge condition={product.condition} />
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 border-t border-slate-100 p-3">
        <span className="text-xs text-slate-500">{categoryOf(product.category).label}</span>
        <h3 className="line-clamp-2 min-h-[2.75rem] font-medium leading-snug text-slate-900 group-hover:text-sky-700">
          {product.title}
        </h3>
        <Stars value={rating.avg} count={rating.count} />
        <div className="mt-auto pt-1">
          <EthAmount value={formatEth(product.price_wei)} className="text-xl font-bold text-slate-900" />
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
          {product.stock > 0 ? (
            <span>เหลือ {product.stock} ชิ้น</span>
          ) : (
            <span className="font-semibold text-rose-600">สินค้าหมด</span>
          )}
          {shop && <span className="truncate">· {shop}</span>}
          {product.sellerInfo?.verified && <VerifiedBadge />}
        </div>
      </div>
    </Link>
  );
}
