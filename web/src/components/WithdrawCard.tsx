import { useAccount, useReadContract } from "wagmi";
import { marketplace } from "../lib/chain";
import { formatEth } from "../lib/format";
import { useMarketplaceTx } from "../lib/tx";
import { EthAmount, Spinner } from "./ui";

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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-emerald-50 to-sky-50 p-4 ring-1 ring-emerald-200">
      <div>
        <p className="text-sm text-slate-600">ยอดเงินที่ถอนได้ (ค่าสินค้าที่ขายได้ / เงินคืน)</p>
        <EthAmount value={formatEth(pending)} className="text-2xl font-bold text-slate-900" />
      </div>
      <button
        onClick={withdraw}
        disabled={pending === 0n || sending}
        className="inline-flex items-center gap-2 rounded-full bg-mint-500 px-5 py-2 font-semibold text-white hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sending && <Spinner className="h-4 w-4" />}
        ถอนเข้า MetaMask
      </button>
    </div>
  );
}
