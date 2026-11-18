import { HandCoins } from "lucide-react";
import { useAccount, useReadContract } from "wagmi";
import { marketplace } from "../lib/chain";
import { formatEth } from "../lib/format";
import { useMarketplaceTx } from "../lib/tx";
import { Button, Price } from "./ui";

/** ยอดเงินที่ถอนได้ (Pull Payment) + ปุ่มถอน */
export function WithdrawCard({ compact = false }: { compact?: boolean }) {
  const { address } = useAccount();
  const { data: pending, refetch } = useReadContract({
    address: marketplace.address,
    abi: marketplace.abi,
    functionName: "pendingWithdrawals",
    args: address ? [address] : undefined,
    chainId: marketplace.chainId,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });
  const { send, pending: sending } = useMarketplaceTx();

  if (!address || pending === undefined) return null;
  if (compact && pending === 0n) return null;

  const withdraw = async () => {
    const r = await send("ถอนเงิน", { functionName: "withdraw", args: [] });
    if (r) void refetch();
  };

  return (
    <div className="card flex flex-wrap items-center justify-between gap-4 border-l-4 border-brand-500 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full bg-brand-50 text-brand-500">
          <HandCoins className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm text-slate-500">ยอดเงินที่ถอนได้ (ค่าสินค้าที่ขายได้ / เงินคืน)</p>
          <Price value={formatEth(pending)} size="lg" />
        </div>
      </div>
      <Button onClick={withdraw} disabled={pending === 0n} loading={sending}>
        ถอนเข้า MetaMask
      </Button>
    </div>
  );
}
