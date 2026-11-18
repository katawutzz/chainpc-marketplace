import { TriangleAlert } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { hoodi } from "../lib/chain";
import { Button } from "./ui";

/** แจ้งเตือนเมื่อ MetaMask ไม่ได้อยู่บน Hoodi — กดเพื่อสลับ (หรือเพิ่มเครือข่ายให้อัตโนมัติ) */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!isConnected || chainId === hoodi.id) return null;

  return (
    <div className="border-b border-amber-200 bg-amber-50 text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <TriangleAlert className="h-4 w-4 shrink-0" />
        <span>
          MetaMask ของคุณไม่ได้อยู่บนเครือข่าย <b>Hoodi Testnet</b> — ซื้อขายไม่ได้จนกว่าจะสลับเครือข่าย
        </span>
        <Button size="sm" onClick={() => switchChain({ chainId: hoodi.id })} loading={isPending}>
          สลับไป Hoodi
        </Button>
        {error && <span className="text-rose-700">{error.message.split("\n")[0]}</span>}
      </div>
    </div>
  );
}
