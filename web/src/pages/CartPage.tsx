import { Link, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { EmptyState, EthAmount, ProductImage, Spinner } from "../components/ui";
import { useCartPrices } from "../hooks/useCartPrices";
import { categoryOf, formatEth, shortAddress } from "../lib/format";
import { useCart } from "../store/cart";

export function CartPage() {
  const { items, setQuantity, remove } = useCart();
  const { address } = useAccount();
  const navigate = useNavigate();
  const { lines, total, allAvailable, isLoading } = useCartPrices(items, address);

  if (items.length === 0) {
    return (
      <EmptyState icon="🛒" title="ตะกร้าของคุณว่างอยู่">
        <Link to="/" className="text-sky-700 hover:underline">
          เลือกซื้อสินค้า
        </Link>
      </EmptyState>
    );
  }

  // จัดกลุ่มตามร้าน (แต่ละรายการจะเป็นคำสั่งซื้อย่อยแยกกันบน chain)
  const bySeller = new Map<string, typeof lines>();
  for (const l of lines) bySeller.set(l.seller, [...(bySeller.get(l.seller) ?? []), l]);
  const count = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">ตะกร้าสินค้า</h1>
        {[...bySeller.entries()].map(([seller, group]) => (
          <div key={seller} className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="border-b border-slate-100 px-4 py-2 text-sm text-slate-500">
              🏪 ร้าน{" "}
              <Link to={`/shop/${seller}`} className="font-mono text-sky-700 hover:underline">
                {shortAddress(seller)}
              </Link>
            </div>
            <ul className="divide-y divide-slate-100">
              {group.map((l) => (
                <li key={l.productId} className="flex gap-4 p-4">
                  <Link to={`/product/${l.productId}`} className="shrink-0">
                    <ProductImage images={l.image ? [l.image] : []} category={l.category} className="h-24 w-24 rounded-lg" iconClass="text-4xl" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <Link to={`/product/${l.productId}`} className="line-clamp-2 font-medium hover:text-sky-700">
                      {l.title}
                    </Link>
                    <p className="text-xs text-slate-500">{categoryOf(l.category).label}</p>
                    {l.problem ? (
                      <p className="mt-1 text-sm font-semibold text-rose-600">⚠️ {l.problem}</p>
                    ) : l.priceChanged ? (
                      <p className="mt-1 text-sm text-amber-700">
                        ราคาเปลี่ยนจาก {formatEth(l.priceWei)} เป็น {formatEth(l.livePrice!)} ETH
                      </p>
                    ) : null}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                      <label className="flex items-center gap-1">
                        จำนวน
                        <select
                          value={l.quantity}
                          onChange={(e) => setQuantity(l.productId, Number(e.target.value))}
                          className="rounded-md border border-slate-300 bg-slate-50 px-2 py-0.5"
                        >
                          {Array.from({ length: Math.max(Math.min(l.liveStock, 10), l.quantity, 1) }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button onClick={() => remove(l.productId)} className="text-sky-700 hover:underline">
                        ลบ
                      </button>
                    </div>
                  </div>
                  <div className="text-right">
                    <EthAmount value={formatEth(l.lineTotal)} className="font-bold" />
                    {l.quantity > 1 && <p className="text-xs text-slate-500">ชิ้นละ {formatEth(l.livePrice ?? BigInt(l.priceWei))}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <aside className="h-fit space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
        <div className="flex items-baseline justify-between">
          <span className="text-slate-600">ยอดรวม ({count} ชิ้น)</span>
          {isLoading ? <Spinner /> : <EthAmount value={formatEth(total)} className="text-2xl font-bold" />}
        </div>
        <p className="text-xs text-slate-500">ราคาล่าสุดจาก Smart Contract · ไม่รวมค่า gas</p>
        <button
          onClick={() => navigate("/checkout")}
          disabled={!allAvailable}
          className="w-full rounded-full bg-amber-400 py-2.5 font-semibold text-slate-900 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ดำเนินการชำระเงิน
        </button>
        {!allAvailable && !isLoading && <p className="text-xs text-rose-600">ลบหรือแก้ไขรายการที่มีปัญหาก่อนชำระเงิน</p>}
        <ul className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <li>🔒 จ่ายครั้งเดียวทั้งตะกร้า — MetaMask เด้งครั้งเดียว</li>
          <li>📦 แต่ละสินค้าจะเป็นคำสั่งซื้อแยก เงินถูกล็อกใน Escrow</li>
        </ul>
      </aside>
    </div>
  );
}
