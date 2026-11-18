import { Link } from "react-router-dom";
import type { ProductListing } from "../hooks/useMarket";
import { formatEth, ratingOf } from "../lib/format";
import { Price, ProductImage, Stars, VerifiedBadge } from "./ui";

export function ProductCard({ product }: { product: ProductListing }) {
  const rating = ratingOf(product.sellerInfo);
  const soldOut = product.stock <= 0;

  return (
    <Link
      to={`/product/${product.id}`}
      className="group flex flex-col overflow-hidden rounded-sm border border-transparent bg-white shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition duration-200 hover:-translate-y-0.5 hover:border-brand-500 hover:shadow-md active:translate-y-0 active:scale-[0.99]"
    >
      <div className="relative overflow-hidden">
        <ProductImage images={product.details?.images} category={product.category} className="aspect-square w-full group-hover:scale-105" />
        <span
          className={`absolute left-0 top-2 rounded-r-sm px-1.5 py-px text-[11px] font-medium text-white ${product.condition === 0 ? "bg-emerald-600" : "bg-amber-500"}`}
        >
          {product.condition === 0 ? "มือหนึ่ง" : "มือสอง"}
        </span>
        {soldOut && (
          <div className="absolute inset-0 grid place-items-center bg-white/60">
            <span className="grid h-20 w-20 place-items-center rounded-full bg-black/60 text-sm font-medium text-white">สินค้าหมด</span>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-2">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] leading-5 text-slate-800">
          {product.sellerInfo?.verified && (
            <span className="mr-1 inline-block align-[1px]">
              <VerifiedBadge compact />
            </span>
          )}
          {product.title}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-1">
          <Price value={formatEth(product.price_wei)} />
        </div>
        <div className="flex items-center justify-between gap-1 text-[11px] text-slate-500">
          {rating.count > 0 ? <Stars value={rating.avg} /> : <span />}
          <span>ขายแล้ว {product.sold} ชิ้น</span>
        </div>
      </div>
    </Link>
  );
}
