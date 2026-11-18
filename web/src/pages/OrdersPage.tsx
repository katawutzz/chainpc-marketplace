import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ClipboardList } from "lucide-react";
import { useAccount } from "wagmi";
import { OrderCard } from "../components/OrderCard";
import { RequireWallet } from "../components/RequireWallet";
import { UserLayout } from "../components/UserLayout";
import { PageLoader, Spinner } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { useOrders } from "../hooks/useOrders";

const TABS = [
  { key: "all", label: "ทั้งหมด", match: () => true },
  { key: "ship", label: "ที่ต้องจัดส่ง", match: (s: number) => s === 1 },
  { key: "receive", label: "ที่ต้องได้รับ", match: (s: number) => s === 2 },
  { key: "done", label: "สำเร็จแล้ว", match: (s: number) => s === 4 },
  { key: "problem", label: "แจ้งปัญหา", match: (s: number) => s === 3 },
  { key: "refund", label: "คืนเงิน", match: (s: number) => s === 5 },
] as const;

export function OrdersPage() {
  return (
    <RequireWallet signIn title="การซื้อของฉัน">
      <UserLayout>
        <Orders />
      </UserLayout>
    </RequireWallet>
  );
}

function Orders() {
  const { address } = useAccount();
  const [params] = useSearchParams();
  const placed = (params.get("placed") ?? "").split(",").filter(Boolean).map(Number);
  const { data: orders, isLoading } = useOrders("buyer", address);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const waitingForSync = placed.length > 0 && !placed.every((id) => orders?.some((o) => o.id === id));

  useEffect(() => {
    if (placed.length && !waitingForSync) document.getElementById(`order-${placed[0]}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitingForSync]);

  const shown = orders?.filter((o) => TABS.find((t) => t.key === tab)!.match(o.status)) ?? [];

  return (
    <div className="space-y-3">
      <nav className="card flex overflow-x-auto">
        {TABS.map((t) => {
          const count = orders?.filter((o) => t.match(o.status)).length ?? 0;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`min-w-28 flex-1 shrink-0 border-b-2 px-3 py-4 text-sm ${tab === t.key ? "border-brand-500 text-brand-600" : "border-transparent text-slate-700 hover:text-brand-600"}`}
            >
              {t.label}
              {t.key !== "all" && count > 0 && <span className="ml-1 text-brand-500">({count})</span>}
            </button>
          );
        })}
      </nav>

      <WithdrawCard compact />

      {waitingForSync && (
        <p className="card flex items-center gap-2 px-4 py-3 text-sm text-sky-800">
          <Spinner className="h-4 w-4" /> กำลังดึงคำสั่งซื้อใหม่จาก Blockchain…
        </p>
      )}

      {isLoading ? (
        <PageLoader />
      ) : shown.length === 0 ? (
        <div className="card flex flex-col items-center py-20 text-slate-500">
          <ClipboardList className="h-16 w-16 text-slate-300" strokeWidth={1.25} />
          <p className="mt-3 text-sm">ยังไม่มีคำสั่งซื้อ</p>
        </div>
      ) : (
        shown.map((o) => <OrderCard key={o.id} order={o} role="buyer" highlight={placed.includes(o.id)} />)
      )}
    </div>
  );
}
