import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseEventLogs } from "viem";
import { Lock, MapPin, ShoppingCart, Store, Wallet } from "lucide-react";
import { useAccount, useBalance } from "wagmi";
import { AddressPicker, formatAddress, useAddresses, type AddressRow } from "../components/AddressBook";
import { RequireWallet } from "../components/RequireWallet";
import { Button, EmptyState, Price, ProductImage, Spinner } from "../components/ui";
import { useCartPrices, type CartLine } from "../hooks/useCartPrices";
import { hoodi, marketplace } from "../lib/chain";
import { formatEth, shortAddress } from "../lib/format";
import { attachShipping } from "../lib/shipping";
import { toast, useMarketplaceTx } from "../lib/tx";
import { isSelected, useCart } from "../store/cart";

type Step = "idle" | "paying" | "saving";

export function CheckoutPage() {
  return (
    <RequireWallet signIn title="ทำการสั่งซื้อ">
      <Checkout />
    </RequireWallet>
  );
}

function Checkout() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, chainId: hoodi.id });
  const allItems = useCart((s) => s.items);
  const removeMany = useCart((s) => s.removeMany);
  const items = allItems.filter(isSelected);
  const { lines, total, allAvailable, isLoading, refetch } = useCartPrices(items, address);
  const { data: addresses } = useAddresses(true);
  const [shipTo, setShipTo] = useState<AddressRow | null>(null);
  const [changing, setChanging] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const { send } = useMarketplaceTx();

  // เลือกที่อยู่ค่าเริ่มต้นให้อัตโนมัติ
  useEffect(() => {
    if (!shipTo && addresses?.length) setShipTo(addresses.find((a) => a.is_default) ?? addresses[0]);
  }, [addresses, shipTo]);

  if (items.length === 0 && step === "idle") {
    return (
      <EmptyState icon={ShoppingCart} title="ยังไม่ได้เลือกสินค้า">
        <Link to="/cart" className="text-brand-600 hover:underline">
          กลับไปที่รถเข็น
        </Link>
      </EmptyState>
    );
  }

  const notEnough = balance ? balance.value < total : false;

  const pay = async () => {
    if (!shipTo) return;
    // อ่านราคาล่าสุดอีกครั้งก่อนจ่าย (กันผู้ขายเปลี่ยนราคาระหว่างนี้)
    const fresh = await refetch();
    const latest = fresh.data;
    if (!latest || latest.some((r) => r.status !== "success")) {
      toast.error("อ่านราคาล่าสุดไม่สำเร็จ", "ลองใหม่อีกครั้ง");
      return;
    }
    const value = items.reduce((sum, item, i) => {
      const r = latest[i];
      return sum + (r.status === "success" ? r.result.price : 0n) * BigInt(item.quantity);
    }, 0n);

    setStep("paying");
    const receipt = await send(`ชำระเงิน ${formatEth(value)} ETH`, {
      functionName: "checkout",
      args: [items.map((i) => BigInt(i.productId)), items.map((i) => i.quantity)],
      value,
    });
    if (!receipt) {
      setStep("idle");
      return;
    }

    const orderIds = parseEventLogs({ abi: marketplace.abi, eventName: "OrderPlaced", logs: receipt.logs }).map((l) => Number(l.args.orderId));
    removeMany(items.map((i) => i.productId));
    setStep("saving");
    const saved = await attachShipping(orderIds, shipTo);
    if (!saved.ok) toast.error("ชำระเงินสำเร็จ แต่บันทึกที่อยู่ไม่สำเร็จ", saved.message);
    else toast.success("สั่งซื้อสำเร็จ", `สร้างคำสั่งซื้อ ${orderIds.length} รายการ`);
    navigate(`/orders?placed=${orderIds.join(",")}`);
  };

  const bySeller = new Map<string, CartLine[]>();
  for (const l of lines) bySeller.set(l.seller, [...(bySeller.get(l.seller) ?? []), l]);

  return (
    <div className="space-y-3">
      {/* ── ที่อยู่ ── */}
      <section className="card overflow-hidden">
        <div className="h-[3px] bg-[repeating-linear-gradient(45deg,#f2562a_0,#f2562a_33px,transparent_0,transparent_41px,#3b82f6_0,#3b82f6_74px,transparent_0,transparent_82px)]" />
        <div className="px-6 py-5">
          <h2 className="mb-3 flex items-center gap-2 text-lg text-brand-500">
            <MapPin className="h-5 w-5" /> ที่อยู่ในการจัดส่ง
          </h2>
          {shipTo && !changing ? (
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
              <span className="font-semibold">
                {shipTo.recipient_name} ({shipTo.phone})
              </span>
              <span className="text-slate-700">{formatAddress(shipTo)}</span>
              {shipTo.is_default && <span className="border border-brand-500 px-1 text-[11px] text-brand-500">ค่าเริ่มต้น</span>}
              <button onClick={() => setChanging(true)} className="text-sky-700 hover:underline">
                เปลี่ยน
              </button>
            </div>
          ) : (
            <AddressPicker
              selectedId={shipTo?.id ?? null}
              onSelect={(a) => {
                setShipTo(a);
                setChanging(false);
              }}
            />
          )}
        </div>
      </section>

      {/* ── สินค้า ── */}
      <section className="card">
        <div className="hidden grid-cols-[minmax(0,3fr)_1fr_1fr_1fr] gap-4 px-6 pb-2 pt-5 text-sm text-slate-500 md:grid">
          <span className="text-base text-slate-800">สั่งซื้อสินค้าแล้ว</span>
          <span className="text-right">ราคาต่อหน่วย</span>
          <span className="text-right">จำนวน</span>
          <span className="text-right">รายการย่อย</span>
        </div>
        {[...bySeller.entries()].map(([seller, group]) => (
          <div key={seller} className="border-t border-dashed border-slate-200 px-6 py-4">
            <p className="mb-3 flex items-center gap-2 text-sm">
              <Store className="h-4 w-4" /> ร้าน <span className="font-mono">{shortAddress(seller)}</span>
            </p>
            {group.map((l) => (
              <div key={l.productId} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-2 text-sm md:grid-cols-[minmax(0,3fr)_1fr_1fr_1fr]">
                <div className="flex min-w-0 items-center gap-3">
                  <ProductImage images={l.image ? [l.image] : []} category={l.category} className="h-12 w-12 shrink-0 border border-slate-100" />
                  <span className="line-clamp-1">{l.title}</span>
                </div>
                <span className="hidden text-right md:block">{formatEth(l.livePrice ?? BigInt(l.priceWei))}</span>
                <span className="hidden text-right md:block">{l.quantity}</span>
                <span className="text-right">
                  {formatEth(l.lineTotal)} <span className="text-xs text-slate-500">ETH</span>
                </span>
                {l.problem && <span className="col-span-full text-xs text-rose-600">{l.problem}</span>}
              </div>
            ))}
            <p className="mt-2 rounded-sm bg-sky-50/60 px-3 py-2 text-xs text-slate-600">
              แต่ละสินค้าจะเป็นคำสั่งซื้อแยกกันบน Smart Contract และเงินจะถูกล็อกจนกว่าคุณยืนยันรับของ
            </p>
          </div>
        ))}
      </section>

      {/* ── การชำระเงิน ── */}
      <section className="card">
        <div className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-5">
          <h2 className="text-lg">วิธีการชำระเงิน</h2>
          <span className="flex items-center gap-2 rounded-sm border border-brand-500 px-3 py-1.5 text-sm text-brand-600">
            <Wallet className="h-4 w-4" /> MetaMask · ETH (Hoodi)
          </span>
          {balance && (
            <span className={`text-sm ${notEnough ? "text-rose-600" : "text-slate-500"}`}>
              ยอดในกระเป๋า {formatEth(balance.value)} ETH{notEnough && " — ไม่พอ"}
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 bg-orange-50/30 px-6 py-5 text-sm">
          <div className="flex w-full max-w-sm justify-between text-slate-600">
            <span>รวมการสั่งซื้อ</span>
            <span>{formatEth(total)} ETH</span>
          </div>
          <div className="flex w-full max-w-sm justify-between text-slate-600">
            <span>ค่าจัดส่ง</span>
            <span>ตกลงกับผู้ขาย</span>
          </div>
          <div className="flex w-full max-w-sm items-center justify-between">
            <span className="text-slate-600">ยอดชำระเงินทั้งหมด</span>
            {isLoading ? <Spinner /> : <Price value={formatEth(total)} size="xl" />}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-dashed border-slate-200 px-6 py-5">
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Lock className="h-4 w-4 text-brand-500" />
            {step === "saving" ? "กำลังบันทึกที่อยู่จัดส่ง (รอ sync จาก Blockchain ~15–30 วินาที) อย่าเพิ่งปิดหน้านี้" : "เมื่อกดสั่งสินค้า MetaMask จะเด้งขึ้นมาให้ยืนยันการชำระเงินครั้งเดียว"}
          </p>
          <Button size="lg" className="w-52" onClick={pay} loading={step !== "idle"} disabled={!shipTo || !allAvailable || notEnough}>
            {step === "paying" ? "กำลังชำระเงิน…" : step === "saving" ? "กำลังบันทึก…" : "สั่งสินค้า"}
          </Button>
        </div>
      </section>
    </div>
  );
}
