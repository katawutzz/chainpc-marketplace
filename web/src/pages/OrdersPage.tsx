import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { OrderCard } from "../components/OrderCard";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, Spinner } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { useOrders } from "../hooks/useOrders";

const FILTERS = [
  { key: "all", label: "ทั้งหมด", match: () => true },
  { key: "active", label: "กำลังดำเนินการ", match: (s: number) => s === 1 || s === 2 || s === 3 },
  { key: "done", label: "สำเร็จ", match: (s: number) => s === 4 },
  { key: "refunded", label: "คืนเงิน", match: (s: number) => s === 5 },
] as const;

export function OrdersPage() {
  return (
    <RequireWallet signIn title="คำสั่งซื้อของฉัน">
      <Orders />
    </RequireWallet>
  );
}

function Orders() {
  const { address } = useAccount();
  const [params] = useSearchParams();
  const placed = (params.get("placed") ?? "").split(",").filter(Boolean).map(Number);
  const { data: orders, isLoading } = useOrders("buyer", address);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const waitingForSync = placed.length > 0 && !placed.every((id) => orders?.some((o) => o.id === id));

  useEffect(() => {
    if (placed.length && !waitingForSync) document.getElementById(`order-${placed[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForSync]);

  const shown = orders?.filter((o) => FILTERS.find((f) => f.key === filter)!.match(o.status)) ?? [];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">คำสั่งซื้อของฉัน</h1>
      <WithdrawCard compact />

      {waitingForSync && (
        <p className="flex items-center gap-2 rounded-lg bg-sky-50 p-3 text-sm text-sky-800 ring-1 ring-sky-200">
          <Spinner className="h-4 w-4" /> กำลังดึงคำสั่งซื้อใหม่จาก Blockchain…
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-sm ring-1 ${filter === f.key ? "bg-navy-900 text-white ring-navy-900" : "bg-white ring-slate-300 hover:bg-slate-50"}`}
          >
            {f.label}
            {orders && ` (${orders.filter((o) => f.match(o.status)).length})`}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : shown.length === 0 ? (
        <EmptyState icon="📦" title={orders?.length ? "ไม่มีคำสั่งซื้อในหมวดนี้" : "ยังไม่มีคำสั่งซื้อ"}>
          <Link to="/" className="text-sky-700 hover:underline">
            เลือกซื้อสินค้า
          </Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {shown.map((o) => (
            <OrderCard key={o.id} order={o} role="buyer" highlight={placed.includes(o.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
