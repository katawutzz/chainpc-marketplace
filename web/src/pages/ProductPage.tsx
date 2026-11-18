import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { ConditionBadge, EmptyState, EthAmount, ProductImage, Spinner, Stars, VerifiedBadge } from "../components/ui";
import { useOnChainProduct, useProductListing } from "../hooks/useMarket";
import { explorer } from "../lib/chain";
import { categoryOf, conditionLabel, formatEth, formatThaiDate, ratingOf, shortAddress } from "../lib/format";
import { checkDetailsIntegrity } from "../lib/hash";
import { productImageUrl } from "../lib/supabase";
import { MAX_CART_ITEMS, useCart } from "../store/cart";

export function ProductPage() {
  const id = Number(useParams().id);
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: listing, isLoading } = useProductListing(id);
  const { data: chain, isLoading: chainLoading, error: chainError } = useOnChainProduct(id);
  const addToCart = useCart((s) => s.add);
  const cartItems = useCart((s) => s.items);
  const [qty, setQty] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [added, setAdded] = useState(false);

  const images = listing?.details?.images ?? [];
  const specs = useMemo(
    () => Object.entries((listing?.details?.specs ?? {}) as Record<string, string>),
    [listing?.details?.specs],
  );

  if (isLoading || chainLoading) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-slate-500">
        <Spinner /> กำลังโหลดสินค้า…
      </div>
    );
  }

  // ไม่มีบน chain = ไม่มีสินค้านี้จริง
  if (!chain || chainError) {
    return (
      <EmptyState icon="🔍" title="ไม่พบสินค้านี้">
        <Link to="/" className="text-sky-700 hover:underline">
          กลับไปหน้าแรก
        </Link>
      </EmptyState>
    );
  }

  // ค่าจาก chain คือค่าจริง (Supabase อาจช้ากว่าเล็กน้อย)
  const title = chain.title;
  const category = categoryOf(chain.category);
  const price = chain.price;
  const stock = Number(chain.stock);
  const isOwn = !!address && address.toLowerCase() === chain.seller.toLowerCase();
  const banned = listing?.sellerInfo?.banned ?? false;
  const available = chain.active && !chain.hidden && !banned && stock > 0;
  const inCart = cartItems.find((i) => i.productId === id)?.quantity ?? 0;
  const maxQty = Math.max(0, stock - inCart);
  const rating = ratingOf(listing?.sellerInfo);
  const integrity = checkDetailsIntegrity(chain.detailsHash, listing?.details);
  const cartFull = cartItems.length >= MAX_CART_ITEMS && inCart === 0;

  const handleAdd = (goToCart: boolean) => {
    addToCart(
      {
        productId: id,
        quantity: qty,
        title,
        priceWei: price.toString(),
        seller: chain.seller.toLowerCase(),
        category: chain.category,
        image: images[0],
      },
      stock,
    );
    if (goToCart) navigate("/cart");
    else {
      setAdded(true);
      setTimeout(() => setAdded(false), 2500);
    }
  };

  return (
    <div className="space-y-4">
      <nav className="text-sm text-slate-500" aria-label="breadcrumb">
        <Link to="/" className="hover:text-sky-700 hover:underline">
          หน้าแรก
        </Link>
        <span className="mx-1.5">›</span>
        <Link to={`/?cat=${category.id}`} className="hover:text-sky-700 hover:underline">
          {category.label}
        </Link>
        <span className="mx-1.5">›</span>
        <span className="text-slate-700">{title}</span>
      </nav>

      <div className="grid gap-6 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_18rem]">
        {/* ── รูปภาพ ── */}
        <div>
          <div className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-100">
            {images.length ? (
              <img src={productImageUrl(images[imageIndex] ?? images[0])} alt={title} className="aspect-square w-full object-contain" />
            ) : (
              <ProductImage category={chain.category} className="aspect-square w-full" iconClass="text-8xl" />
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {images.map((img, i) => (
                <button
                  key={img}
                  onClick={() => setImageIndex(i)}
                  className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg ring-2 ${i === imageIndex ? "ring-mint-500" : "ring-transparent hover:ring-slate-300"}`}
                  aria-label={`รูปที่ ${i + 1}`}
                >
                  <img src={productImageUrl(img)} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── ข้อมูลสินค้า ── */}
        <div className="min-w-0 space-y-4">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <ConditionBadge condition={chain.condition} />
              <span className="text-sm text-slate-500">
                {category.icon} {category.label}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-snug text-slate-900">{title}</h1>
            <div className="mt-1">
              <Stars value={rating.avg} count={rating.count} />
            </div>
          </div>

          <div className="border-y border-slate-100 py-3">
            <EthAmount value={formatEth(price)} className="text-3xl font-bold text-slate-900" />
            <p className="mt-1 text-xs text-slate-500">ราคาอ่านจาก Smart Contract โดยตรง · ไม่รวมค่า gas</p>
          </div>

          <IntegrityNote status={integrity} />

          {specs.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold text-slate-800">สเปก</h2>
              <table className="w-full overflow-hidden rounded-lg text-sm ring-1 ring-slate-200">
                <tbody>
                  {specs.map(([k, v], i) => (
                    <tr key={k} className={i % 2 ? "bg-white" : "bg-slate-50"}>
                      <th className="w-2/5 px-3 py-2 text-left font-medium text-slate-600">{k}</th>
                      <td className="px-3 py-2 text-slate-900">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-semibold text-slate-800">รายละเอียด</h2>
            {listing?.details?.description ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{listing.details.description}</p>
            ) : (
              <p className="text-sm text-slate-400">ผู้ขายยังไม่ได้ใส่รายละเอียด</p>
            )}
          </section>

          <dl className="grid grid-cols-2 gap-2 text-sm">
            <Info label="สภาพ" value={conditionLabel(chain.condition)} />
            <Info label="รหัสสินค้า" value={`#${id}`} />
            <Info label="ลงขายเมื่อ" value={formatThaiDate(new Date(Number(chain.createdAt) * 1000).toISOString())} />
            <Info label="แก้ไขล่าสุด" value={formatThaiDate(new Date(Number(chain.updatedAt) * 1000).toISOString())} />
          </dl>
        </div>

        {/* ── กล่องซื้อ ── */}
        <aside className="space-y-4">
          <div className="rounded-xl p-4 ring-1 ring-slate-200">
            <EthAmount value={formatEth(price)} className="text-2xl font-bold" />
            <p className={`mt-2 font-semibold ${available ? "text-emerald-700" : "text-rose-600"}`}>
              {!chain.active
                ? "ผู้ขายปิดการขายแล้ว"
                : chain.hidden
                  ? "สินค้าถูกระงับโดย Admin"
                  : banned
                    ? "ผู้ขายถูกระงับ"
                    : stock > 0
                      ? `มีสินค้า ${stock} ชิ้น`
                      : "สินค้าหมด"}
            </p>

            {isOwn ? (
              <p className="mt-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-600">
                นี่คือสินค้าของคุณ —{" "}
                <Link to="/seller" className="text-sky-700 hover:underline">
                  จัดการในศูนย์ผู้ขาย
                </Link>
              </p>
            ) : available ? (
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  จำนวน
                  <select
                    value={qty}
                    onChange={(e) => setQty(Number(e.target.value))}
                    className="rounded-md border border-slate-300 bg-slate-50 px-2 py-1"
                    disabled={maxQty === 0}
                  >
                    {Array.from({ length: Math.min(Math.max(maxQty, 1), 10) }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                {inCart > 0 && <p className="text-xs text-slate-500">อยู่ในตะกร้าแล้ว {inCart} ชิ้น</p>}
                <button
                  onClick={() => handleAdd(false)}
                  disabled={maxQty === 0 || cartFull}
                  className="w-full rounded-full bg-amber-400 py-2.5 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {added ? "✓ เพิ่มลงตะกร้าแล้ว" : "เพิ่มลงตะกร้า"}
                </button>
                <button
                  onClick={() => handleAdd(true)}
                  disabled={maxQty === 0 || cartFull}
                  className="w-full rounded-full bg-mint-500 py-2.5 font-semibold text-white hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  ซื้อเลย
                </button>
                {cartFull && <p className="text-xs text-rose-600">ตะกร้าเต็ม (สูงสุด {MAX_CART_ITEMS} รายการ)</p>}
              </div>
            ) : null}

            <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-600">
              <li>🔒 เงินถูกล็อกใน Smart Contract จนกว่าคุณจะยืนยันรับของ</li>
              <li>↩️ ผู้ขายไม่ส่งของตามกำหนด → ขอเงินคืนได้</li>
              <li>⚖️ ของไม่ตรงปก → เปิดข้อพิพาทให้ Admin ตัดสิน</li>
            </ul>
          </div>

          <SellerBox
            seller={chain.seller}
            shopName={listing?.sellerProfile?.shop_name ?? listing?.sellerProfile?.display_name ?? null}
            verified={listing?.sellerInfo?.verified ?? false}
            rating={rating}
          />
        </aside>
      </div>
    </div>
  );
}

function IntegrityNote({ status }: { status: ReturnType<typeof checkDetailsIntegrity> }) {
  if (status === "none") return null;
  return status === "verified" ? (
    <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-emerald-200">
      ✔ รายละเอียดสินค้าตรงกับข้อมูลบน Blockchain (ตรวจด้วย keccak256)
    </p>
  ) : (
    <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-800 ring-1 ring-rose-200">
      ⚠️ รายละเอียดสินค้าไม่ตรงกับ hash บน Blockchain — ข้อมูลอาจถูกแก้ไขหรือยังอัปเดตไม่ครบ
    </p>
  );
}

function SellerBox({
  seller,
  shopName,
  verified,
  rating,
}: {
  seller: string;
  shopName: string | null;
  verified: boolean;
  rating: { avg: number; count: number };
}) {
  return (
    <div className="rounded-xl p-4 text-sm ring-1 ring-slate-200">
      <h2 className="mb-2 font-semibold text-slate-800">ข้อมูลผู้ขาย</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{shopName ?? "ร้านค้าไม่ระบุชื่อ"}</span>
        {verified && <VerifiedBadge />}
      </div>
      <div className="mt-1">
        <Stars value={rating.avg} count={rating.count} />
      </div>
      <a
        href={explorer.address(seller)}
        target="_blank"
        rel="noreferrer"
        className="mt-2 block font-mono text-xs text-sky-700 hover:underline"
      >
        {shortAddress(seller)} ↗
      </a>
      <Link to={`/shop/${seller.toLowerCase()}`} className="mt-2 inline-block text-sky-700 hover:underline">
        ดูสินค้าทั้งหมดของร้าน
      </Link>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{value}</dd>
    </div>
  );
}
