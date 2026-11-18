import { explorer } from "../lib/chain";
import { useToasts, type ToastKind } from "../lib/tx";
import { Spinner } from "./ui";

const styles: Record<ToastKind, string> = {
  pending: "bg-white ring-sky-200",
  success: "bg-emerald-50 ring-emerald-200",
  error: "bg-rose-50 ring-rose-200",
  info: "bg-white ring-slate-200",
};

const icons: Record<Exclude<ToastKind, "pending">, string> = { success: "✅", error: "⛔", info: "ℹ️" };

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:left-auto sm:w-96" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`pointer-events-auto w-full rounded-xl p-3 shadow-lg ring-1 ${styles[t.kind]}`}>
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-lg">{t.kind === "pending" ? <Spinner className="h-4 w-4 text-sky-600" /> : icons[t.kind]}</span>
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-semibold text-slate-900">{t.title}</p>
              {t.message && <p className="text-slate-600">{t.message}</p>}
              {t.txHash && (
                <a href={explorer.tx(t.txHash)} target="_blank" rel="noreferrer" className="text-xs text-sky-700 hover:underline">
                  ดูธุรกรรมบน Etherscan ↗
                </a>
              )}
            </div>
            {t.kind !== "pending" && (
              <button onClick={() => dismiss(t.id)} className="text-slate-400 hover:text-slate-700" aria-label="ปิด">
                ✕
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
