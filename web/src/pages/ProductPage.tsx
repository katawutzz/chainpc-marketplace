import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ChevronRight,
  ExternalLink,
  Lock,
  PackageSearch,
  RotateCcw,
  Scale,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Store,
} from "lucide-react";
import { useAccount } from "wagmi";
import { Button, EmptyState, PageLoader, Price, ProductImage, QuantityStepper, Stars, VerifiedBadge } from "../components/ui";
import { useListings, useOnChainProduct, useProductListing, useProductReviews } from "../hooks/useMarket";
import { explorer } from "../lib/chain";
import { categoryOf, conditionLabel, formatEth, formatThaiDate, ratingOf, shortAddress } from "../lib/format";
import { checkDetailsIntegrity } from "../lib/hash";
import { productImageUrl } from "../lib/supabase";
import { toast } from "../lib/tx";
import { MAX_CART_ITEMS, useCart } from "../store/cart";

export function ProductPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: listing, isLoading } = useProductListing(id);
  const { data: chain, isLoading: chainLoading, error: chainError } = useOnChainProduct(id);
  const { data: reviews } = useProductReviews(id);
  const { data: all } = useListings();
  const addToCart = useCart((s) => s.add);
  const cartItems = useCart((s) => s.items);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);

  const images = listing?.details?.images ?? [];
  const specs = useMemo(() => Object.entries((listing?.details?.specs ?? {}) as Record<string, string>), [listing?.details?.specs]);

  if (isLoading || chainLoading) return <PageLoader text="กำลังโหลดสินค้า…" />;
  if (!chain || chainError) {
    return (
      <EmptyState icon={PackageSearch} title="ไม่พบสินค้านี้">
        <Link to="/" className="text-brand-600 hover:underline">
          กลับไปหน้าแรก
        </Link>
      </EmptyState>
    );
  }

  // ค่าจาก chain คือค่าจริง (Supabase อาจช้ากว่าเล็กน้อย)
  const category = categoryOf(chain.category);
  const stock = Number(chain.stock);
  const isOwn = !!address && address.toLowerCase() === chain.seller.toLowerCase();
  const banned = listing?.sellerInfo?.banned ?? false;
  const available = chain.active && !chain.hidden && !banned && stock > 0;
  const inCart = cartItems.find((i) => i.productId === id)?.quantity ?? 0;
  const maxQty = Math.max(0, stock - inCart);
  const rating = ratingOf(listing?.sellerInfo);
  const integrity = checkDetailsIntegrity(chain.detailsHash, listing?.details);
  const cartFull = cartItems.length >= MAX_CART_ITEMS && inCart === 0;
  const shopName = listing?.sellerProfile?.shop_name ?? listing?.sellerProfile?.display_name ?? `ร้าน ${shortAddress(chain.seller)}`;
  const shopProducts = all?.filter((p) => p.seller === chain.seller.toLowerCase()).length ?? 0;
  const productRating = reviews?.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const unavailableText = !chain.active
    ? "ผู้ขายปิดการขายแล้ว"
    : chain.hidden
      ? "สินค้าถูกระงับโดย Admin"
      : banned
        ? "ผู้ขายถูกระงับ"
        : stock <= 0
          ? "สินค้าหมด"
          : null;

  const add = (go: boolean) => {
    addToCart(
      {
        productId: id,
        quantity: qty,
        title: chain.title,
        priceWei: chain.price.toString(),
        seller: chain.seller.toLowerCase(),
        category: chain.category,
        image: images[0],
      },
      stock,
    );
    if (go) navigate("/cart");
    else toast.success("เพิ่มสินค้าลงในรถเข็นแล้ว");
  };

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-slate-500" aria-label="breadcrumb">
        <Link to="/" className="text-sky-700 hover:underline">
          ChainPC
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link to={`/?cat=${category.id}`} className="text-sky-700 hover:underline">
          {category.label}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="line-clamp-1 text-slate-700">{chain.title}</span>
      </nav>

      {/* ── ส่วนบน: รูป + ข้อมูล + ซื้อ ── */}
      <section className="card grid gap-6 p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-5">
        <div>
          <div className="overflow-hidden bg-white">
            {images.length ? (
              <img src={productImageUrl(images[imageIndex] ?? images[0])} alt={chain.title} className="aspect-square w-full object-contain" />
            ) : (
              <ProductImage category={chain.category} className="aspect-square w-full" />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-2 grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button
                  key={img}
                  onMouseEnter={() => setImageIndex(i)}
                  onClick={() => setImageIndex(i)}
                  className={`aspect-square overflow-hidden border-2 ${i === imageIndex ? "border-brand-500" : "border-transparent"}`}
                  aria-label={`รูปที่ ${i + 1}`}
                >
                  <img src={productImageUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <h1 className="text-xl font-medium leading-snug text-slate-900">
            <span className="mr-2 inline-block align-[3px]">
              <span className={`rounded-sm px-1.5 py-px text-xs font-medium text-white ${chain.condition === 0 ? "bg-emerald-600" : "bg-amber-500"}`}>
                {conditionLabel(chain.condition)}
              </span>
            </span>
            {chain.title}
          </h1>

          <div className="mt-2 flex flex-wrap items-center divide-x divide-slate-300 text-sm">
            <span className="flex items-center gap-1.5 pr-4">
              <span className="border-b border-brand-500 text-brand-600">{reviews?.length ? productRating.toFixed(1) : "-"}</span>
              <Stars value={productRating} />
            </span>
            <span className="px-4">
              <span className="border-b border-slate-800">{reviews?.length ?? 0}</span> <span className="text-slate-500">คะแนน</span>
            </span>
            <span className="pl-4">
              <span>{listing?.sold ?? 0}</span> <span className="text-slate-500">ขายแล้ว</span>
            </span>
          </div>

          <div className="mt-4 bg-slate-50 px-5 py-4">
            <Price value={formatEth(chain.price)} size="xl" />
            <p className="mt-1 text-xs text-slate-500">ราคาอ่านจาก Smart Contract โดยตรง · ไม่รวมค่า gas</p>
          </div>

          <dl className="mt-5 space-y-4 px-1 text-sm">
            <Row label="การคุ้มครอง">
              <span className="flex flex-col gap-1 text-slate-700">
                <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-brand-500" /> เงินถูกล็อกใน Smart Contract จนกว่าคุณยืนยันรับของ</span>
                <span className="flex items-center gap-1.5"><RotateCcw className="h-4 w-4 text-brand-500" /> ผู้ขายไม่ส่งของตามกำหนด ขอเงินคืนได้</span>
                <span className="flex items-center gap-1.5"><Scale className="h-4 w-4 text-brand-500" /> ของไม่ตรงปก แจ้งปัญหาให้ Admin ตัดสิน</span>
              </span>
            </Row>
            {!isOwn && available && (
              <Row label="จำนวน">
                <span className="flex flex-wrap items-center gap-3">
                  <QuantityStepper value={Math.min(qty, Math.max(maxQty, 1))} max={Math.max(maxQty, 1)} onChange={setQty} disabled={maxQty === 0} />
                  <span className="text-slate-500">มีสินค้าทั้งหมด {stock} ชิ้น</span>
                  {inCart > 0 && <span className="text-xs text-brand-600">(อยู่ในรถเข็นแล้ว {inCart} ชิ้น)</span>}
                </span>
              </Row>
            )}
          </dl>

          <div className="mt-6 flex flex-wrap gap-3 px-1">
            {isOwn ? (
              <p className="flex items-center gap-2 rounded-sm bg-slate-100 px-4 py-3 text-sm text-slate-600">
                <Store className="h-4 w-4" /> นี่คือสินค้าของคุณ —
                <Link to="/seller?tab=products" className="text-brand-600 hover:underline">
                  จัดการในศูนย์ผู้ขาย
                </Link>
              </p>
            ) : unavailableText ? (
              <p className="rounded-sm bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{unavailableText}</p>
            ) : (
              <>
                <Button variant="outline" size="lg" icon={ShoppingCart} disabled={maxQty === 0 || cartFull} onClick={() => add(false)}>
                  เพิ่มไปยังรถเข็น
                </Button>
                <Button size="lg" className="min-w-44" disabled={maxQty === 0 || cartFull} onClick={() => add(true)}>
                  ซื้อสินค้า
                </Button>
                {cartFull && <p className="w-full text-xs text-rose-600">รถเข็นเต็ม (สูงสุด {MAX_CART_ITEMS} รายการ)</p>}
                {maxQty === 0 && inCart > 0 && <p className="w-full text-xs text-slate-500">เพิ่มครบตามจำนวนที่มีแล้ว</p>}
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── ร้านค้า ── */}
      <section className="card flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-brand-50 text-brand-500 ring-1 ring-brand-100">
            <Store className="h-7 w-7" />
          </span>
          <div>
            <p className="flex items-center gap-2 font-medium">
              {shopName} {listing?.sellerInfo?.verified && <VerifiedBadge />}
            </p>
            <a href={explorer.address(chain.seller)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-mono text-xs text-slate-500 hover:text-brand-600">
              {shortAddress(chain.seller)} <ExternalLink className="h-3 w-3" />
            </a>
            <Link to={`/shop/${chain.seller.toLowerCase()}`} className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-sm border border-slate-300 px-3 text-sm hover:bg-slate-50">
              <Store className="h-4 w-4" /> ดูร้านค้า
            </Link>
          </div>
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-x-8 gap-y-2 border-slate-200 text-sm sm:grid-cols-3 md:w-auto md:flex-1 md:border-l md:pl-8">
          <ShopStat label="คะแนนร้าน" value={rating.count ? `${rating.avg.toFixed(1)} / 5` : "-"} />
          <ShopStat label="จำนวนรีวิว" value={String(rating.count)} />
          <ShopStat label="สินค้า" value={String(shopProducts)} />
        </div>
      </section>

      {/* ── รายละเอียด ── */}
      <section className="card p-5">
        <h2 className="bg-slate-50 px-4 py-3 text-base font-medium">ข้อมูลจำเพาะของสินค้า</h2>
        <dl className="mt-4 space-y-3 px-4 text-sm">
          <SpecRow label="หมวดหมู่">
            <Link to={`/?cat=${category.id}`} className="text-sky-700 hover:underline">
              ChainPC &gt; {category.label}
            </Link>
          </SpecRow>
          <SpecRow label="สภาพ">{conditionLabel(chain.condition)}</SpecRow>
          {specs.map(([k, v]) => (
            <SpecRow key={k} label={k}>
              {v}
            </SpecRow>
          ))}
          <SpecRow label="คลังสินค้า">{stock}</SpecRow>
          <SpecRow label="ลงขายเมื่อ">{formatThaiDate(new Date(Number(chain.createdAt) * 1000).toISOString())}</SpecRow>
          <SpecRow label="รหัสสินค้าบน chain">#{id}</SpecRow>
        </dl>

        <h2 className="mt-6 bg-slate-50 px-4 py-3 text-base font-medium">รายละเอียดสินค้า</h2>
        <div className="mt-4 px-4 text-sm leading-relaxed text-slate-700">
          {listing?.details?.description ? <p className="whitespace-pre-line">{listing.details.description}</p> : <p className="text-slate-400">ผู้ขายยังไม่ได้ใส่รายละเอียด</p>}
          <IntegrityNote status={integrity} />
        </div>
      </section>

      {/* ── รีวิว ── */}
      <section className="card p-5">
        <h2 className="text-base font-medium">คะแนนของสินค้า</h2>
        <div className="mt-4 flex items-center gap-6 rounded-sm border border-brand-100 bg-brand-50/60 px-6 py-5">
          <div className="text-brand-600">
            <span className="text-3xl">{reviews?.length ? productRating.toFixed(1) : "0"}</span> <span className="text-lg">เต็ม 5</span>
            <div className="mt-1">
              <Stars value={productRating} size="md" />
            </div>
          </div>
          <p className="text-sm text-slate-600">รีวิวจากผู้ซื้อที่ได้รับสินค้าแล้วเท่านั้น · 1 รีวิวต่อคำสั่งซื้อ</p>
        </div>
        {!reviews?.length ? (
          <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีคะแนนสำหรับสินค้านี้</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {reviews.map((r) => (
              <li key={r.order_id} className="flex gap-3 py-4">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-medium text-slate-500">
                  {r.buyer.slice(2, 4).toUpperCase()}
                </span>
                <div className="min-w-0 text-sm">
                  <p className="font-mono text-xs text-slate-700">{shortAddress(r.buyer)}</p>
                  <Stars value={r.rating} />
                  <p className="text-xs text-slate-400">{formatThaiDate(r.created_at)} · ซื้อแล้ว</p>
                  {r.comment && <p className="mt-2 text-slate-800">{r.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-24 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function SpecRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4">
      <dt className="w-40 shrink-0 text-slate-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children}</dd>
    </div>
  );
}

function ShopStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-brand-600">{value}</span>
    </div>
  );
}

function IntegrityNote({ status }: { status: ReturnType<typeof checkDetailsIntegrity> }) {
  if (status === "none") return null;
  return status === "verified" ? (
    <p className="mt-4 flex items-center gap-2 rounded-sm bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
      <ShieldCheck className="h-4 w-4 shrink-0" /> รายละเอียดสินค้าตรงกับข้อมูลบน Blockchain (ตรวจด้วย keccak256)
    </p>
  ) : (
    <p className="mt-4 flex items-center gap-2 rounded-sm bg-rose-50 px-3 py-2 text-xs text-rose-800">
      <ShieldAlert className="h-4 w-4 shrink-0" /> รายละเอียดไม่ตรงกับ hash บน Blockchain — ข้อมูลอาจถูกแก้ไขหรือยังอัปเดตไม่ครบ
    </p>
  );
}
