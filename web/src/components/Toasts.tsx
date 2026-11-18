import { CircleCheck, CircleX, ExternalLink, Info, Loader2, X } from "lucide-react";
import { explorer } from "../lib/chain";
import { useToasts, type ToastKind } from "../lib/tx";

const icon: Record<ToastKind, React.ReactNode> = {
  pending: <Loader2 className="h-5 w-5 animate-spin text-brand-500" />,
  success: <CircleCheck className="h-5 w-5 text-emerald-500" />,
  error: <CircleX className="h-5 w-5 text-rose-500" />,
  info: <Info className="h-5 w-5 text-sky-500" />,
};

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto w-full animate-toast rounded-sm bg-white p-3 shadow-lg ring-1 ring-black/5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">{icon[t.kind]}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium text-slate-900">{t.title}</p>
              {t.message && <p className="text-slate-600">{t.message}</p>}
              {t.txHash && (
                <a href={explorer.tx(t.txHash)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline">
                  ดูธุรกรรมบน Etherscan <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            {t.kind !== "pending" && (
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="ปิด">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
