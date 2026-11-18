import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { parseEventLogs } from "viem";
import { useAccount, useBalance } from "wagmi";
import { AddressPicker, type AddressRow } from "../components/AddressBook";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, EthAmount, Spinner } from "../components/ui";
import { useCartPrices } from "../hooks/useCartPrices";
import { hoodi, marketplace } from "../lib/chain";
import { formatEth } from "../lib/format";
import { attachShipping } from "../lib/shipping";
import { toast, useMarketplaceTx } from "../lib/tx";
import { useCart } from "../store/cart";

type Step = "idle" | "paying" | "saving" | "done";

export function CheckoutPage() {
  return (
    <RequireWallet signIn title="ชำระเงิน">
      <Checkout />
    </RequireWallet>
  );
}

function Checkout() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const { data: balance } = useBalance({ address, chainId: hoodi.id });
  const { items, clear } = useCart();
  const { lines, total, allAvailable, isLoading, refetch } = useCartPrices(items, address);
  const [shipTo, setShipTo] = useState<AddressRow | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const { send } = useMarketplaceTx();

  if (items.length === 0 && step === "idle") {
    return (
      <EmptyState icon="🛒" title="ไม่มีสินค้าในตะกร้า">
        <Link to="/" className="text-sky-700 hover:underline">
          เลือกซื้อสินค้า
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

    const orderIds = parseEventLogs({ abi: marketplace.abi, eventName: "OrderPlaced", logs: receipt.logs }).map((l) =>
      Number(l.args.orderId),
    );
    clear();
    setStep("saving");
    const saved = await attachShipping(orderIds, shipTo);
    if (!saved.ok) toast.error("ชำระเงินสำเร็จ แต่บันทึกที่อยู่ไม่สำเร็จ", saved.message);
    else toast.success("สั่งซื้อสำเร็จ", `สร้างคำสั่งซื้อ ${orderIds.length} รายการ`);
    setStep("done");
    navigate(`/orders?placed=${orderIds.join(",")}`);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <section className="space-y-6">
        <h1 className="text-2xl font-bold">ชำระเงิน</h1>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold">1. ที่อยู่จัดส่ง</h2>
          <AddressPicker selectedId={shipTo?.id ?? null} onSelect={setShipTo} />
        </div>

        <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold">2. ตรวจสอบรายการ</h2>
          <ul className="divide-y divide-slate-100 text-sm">
            {lines.map((l) => (
              <li key={l.productId} className="flex justify-between gap-3 py-2">
                <span className="min-w-0">
                  <span className="line-clamp-1">{l.title}</span>
                  <span className="text-xs text-slate-500">x{l.quantity}</span>
                  {l.problem && <span className="block text-xs font-semibold text-rose-600">⚠️ {l.problem}</span>}
                </span>
                <EthAmount value={formatEth(l.lineTotal)} className="font-medium" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <aside className="h-fit space-y-3 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:sticky lg:top-4">
        <h2 className="font-semibold">3. ชำระด้วย MetaMask</h2>
        <div className="flex items-baseline justify-between">
          <span className="text-slate-600">ยอดชำระ</span>
          {isLoading ? <Spinner /> : <EthAmount value={formatEth(total)} className="text-2xl font-bold" />}
        </div>
        {balance && (
          <p className={`text-xs ${notEnough ? "text-rose-600" : "text-slate-500"}`}>
            ยอดในกระเป๋า {formatEth(balance.value)} ETH {notEnough && "— ไม่พอ"}
          </p>
        )}
        <button
          onClick={pay}
          disabled={!shipTo || !allAvailable || notEnough || step !== "idle"}
          className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-mint-500 py-3 font-semibold text-white hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {step !== "idle" && <Spinner className="h-4 w-4" />}
          {step === "paying"
            ? "กำลังชำระเงิน…"
            : step === "saving"
              ? "กำลังบันทึกที่อยู่จัดส่ง…"
              : "🦊 ชำระเงินด้วย MetaMask"}
        </button>
        {!shipTo && <p className="text-xs text-slate-500">เลือกที่อยู่จัดส่งก่อน</p>}
        {step === "saving" && (
          <p className="text-xs text-slate-500">รอ Supabase sync คำสั่งซื้อจาก Blockchain (ประมาณ 15–30 วินาที) อย่าเพิ่งปิดหน้านี้</p>
        )}
        <ul className="space-y-1 border-t border-slate-100 pt-3 text-xs text-slate-600">
          <li>🔒 เงินถูกล็อกใน Smart Contract จนกว่าคุณจะยืนยันรับของ</li>
          <li>↩️ ผู้ขายไม่จัดส่งตามกำหนด → ขอเงินคืนได้</li>
          <li>⛽ มีค่า gas เล็กน้อย (Hoodi ETH)</li>
        </ul>
      </aside>
    </div>
  );
}
