import { useAccount, useSwitchChain } from "wagmi";
import { hoodi } from "../lib/chain";
import { Spinner } from "./ui";

/** แจ้งเตือนเมื่อ MetaMask ไม่ได้อยู่บน Hoodi — กดเพื่อสลับ (หรือเพิ่มเครือข่ายให้อัตโนมัติ) */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending, error } = useSwitchChain();

  if (!isConnected || chainId === hoodi.id) return null;

  return (
    <div className="bg-amber-100 text-amber-900">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <span>
          ⚠️ MetaMask ของคุณไม่ได้อยู่บนเครือข่าย <b>Hoodi Testnet</b> (chain {chainId}) — ซื้อขายไม่ได้จนกว่าจะสลับเครือข่าย
        </span>
        <button
          onClick={() => switchChain({ chainId: hoodi.id })}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-md bg-amber-500 px-3 py-1 font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
        >
          {isPending && <Spinner className="h-3.5 w-3.5" />}
          สลับไป Hoodi
        </button>
        {error && <span className="text-rose-700">{error.message.split("\n")[0]}</span>}
      </div>
    </div>
  );
}
