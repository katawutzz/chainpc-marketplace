import { Link, useNavigate } from "react-router-dom";
import { ShoppingCart, Store, TriangleAlert } from "lucide-react";
import { useAccount } from "wagmi";
import { Button, EmptyState, Price, ProductImage, QuantityStepper, Spinner } from "../components/ui";
import { useCartPrices, type CartLine } from "../hooks/useCartPrices";
import { categoryOf, formatEth, shortAddress } from "../lib/format";
import { isSelected, useCart } from "../store/cart";

export function CartPage() {
  const { items, setQuantity, remove, removeMany, toggle, setSelected } = useCart();
  const { address } = useAccount();
  const navigate = useNavigate();
  const { lines, isLoading } = useCartPrices(items, address);

  if (items.length === 0) {
    return (
      <EmptyState icon={ShoppingCart} title="ยังไม่มีสินค้าในรถเข็น">
        <Link to="/" className="mt-2 inline-block rounded-sm bg-brand-500 px-8 py-2.5 text-white hover:bg-brand-600">
          ไปช้อปกันเลย
        </Link>
      </EmptyState>
    );
  }

  const selected = lines.filter((l) => isSelected(l));
  const total = selected.reduce((s, l) => s + l.lineTotal, 0n);
  const canCheckout = selected.length > 0 && selected.every((l) => l.available);
  const allSelected = selected.length === lines.length;

  // จัดกลุ่มตามร้าน (แต่ละรายการจะเป็นคำสั่งซื้อย่อยแยกกันบน chain)
  const bySeller = new Map<string, CartLine[]>();
  for (const l of lines) bySeller.set(l.seller, [...(bySeller.get(l.seller) ?? []), l]);
  const ids = (group: CartLine[]) => group.map((l) => l.productId);

  return (
    <div className="space-y-3 pb-24">
      <div className="card hidden grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] items-center gap-4 px-5 py-4 text-sm text-slate-500 md:grid">
        <label className="flex items-center gap-4 text-slate-800">
          <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={allSelected} onChange={(e) => setSelected(ids(lines), e.target.checked)} />
          สินค้า
        </label>
        <span className="text-center">ราคาต่อชิ้น</span>
        <span className="text-center">จำนวน</span>
        <span className="text-center">ราคารวม</span>
        <span className="text-center">แอคชั่น</span>
      </div>

      {[...bySeller.entries()].map(([seller, group]) => {
        const groupSelected = group.every((l) => isSelected(l));
        return (
          <section key={seller} className="card">
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={groupSelected} onChange={(e) => setSelected(ids(group), e.target.checked)} />
              <Store className="h-4 w-4 text-slate-600" />
              <Link to={`/shop/${seller}`} className="font-medium hover:text-brand-600">
                ร้าน <span className="font-mono">{shortAddress(seller)}</span>
              </Link>
            </header>
            <ul className="divide-y divide-slate-100">
              {group.map((l) => {
                const unit = l.livePrice ?? BigInt(l.priceWei);
                return (
                  <li key={l.productId} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 px-5 py-5 md:grid-cols-[minmax(0,2fr)_1fr_1fr_1fr_80px] md:items-center">
                    <div className="col-span-2 flex items-start gap-4 md:col-span-1">
                      <input type="checkbox" className="mt-8 h-4 w-4 accent-brand-500" checked={isSelected(l)} onChange={() => toggle(l.productId)} aria-label="เลือกสินค้า" />
                      <Link to={`/product/${l.productId}`} className="shrink-0">
                        <ProductImage images={l.image ? [l.image] : []} category={l.category} className="h-20 w-20 border border-slate-100" />
                      </Link>
                      <div className="min-w-0">
                        <Link to={`/product/${l.productId}`} className="line-clamp-2 text-sm hover:text-brand-600">
                          {l.title}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">{categoryOf(l.category).label}</p>
                        {l.problem ? (
                          <p className="mt-1 flex items-center gap-1 text-xs font-medium text-rose-600">
                            <TriangleAlert className="h-3.5 w-3.5" /> {l.problem}
                          </p>
                        ) : l.priceChanged ? (
                          <p className="mt-1 text-xs text-amber-700">ราคาเปลี่ยนจาก {formatEth(l.priceWei)} เป็น {formatEth(l.livePrice!)} ETH</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="col-start-2 text-sm md:col-start-auto md:text-center">
                      <span className="mr-2 text-slate-500 md:hidden">ราคาต่อชิ้น</span>
                      {formatEth(unit)} ETH
                    </div>
                    <div className="col-start-2 md:col-start-auto md:text-center">
                      <QuantityStepper value={l.quantity} max={Math.max(l.liveStock, l.quantity, 1)} onChange={(n) => setQuantity(l.productId, n)} />
                    </div>
                    <div className="col-start-2 md:col-start-auto md:text-center">
                      <Price value={formatEth(l.lineTotal)} />
                    </div>
                    <div className="col-start-2 md:col-start-auto md:text-center">
                      <button onClick={() => remove(l.productId)} className="text-sm text-slate-700 hover:text-brand-600">
                        ลบ
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {/* ── แถบชำระเงินด้านล่าง ── */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={allSelected} onChange={(e) => setSelected(ids(lines), e.target.checked)} />
            เลือกทั้งหมด ({lines.length})
          </label>
          <button
            onClick={() => removeMany(ids(selected))}
            disabled={selected.length === 0}
            className="text-sm text-slate-700 hover:text-brand-600 disabled:opacity-40"
          >
            ลบ
          </button>
          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm">
              รวม ({selected.length} สินค้า):{" "}
              {isLoading ? <Spinner className="inline h-4 w-4" /> : <Price value={formatEth(total)} size="lg" />}
            </span>
            <Button size="lg" className="w-48" disabled={!canCheckout} onClick={() => navigate("/checkout")}>
              สั่งสินค้า
            </Button>
          </div>
          {!canCheckout && selected.length > 0 && !isLoading && (
            <p className="w-full text-right text-xs text-rose-600">นำรายการที่มีปัญหาออก หรือยกเลิกการเลือกก่อนสั่งซื้อ</p>
          )}
        </div>
      </div>
    </div>
  );
}
