import type { ReactNode } from "react";
import { categoryOf } from "../lib/format";
import { productImageUrl } from "../lib/supabase";

export function Stars({ value, count, size = "sm" }: { value: number; count?: number; size?: "sm" | "md" }) {
  const full = Math.round(value);
  return (
    <span className={`inline-flex items-center gap-1 ${size === "md" ? "text-base" : "text-sm"}`}>
      <span className="tracking-tight text-amber-500" aria-label={`${value.toFixed(1)} จาก 5 ดาว`}>
        {"★★★★★".slice(0, full)}
        <span className="text-slate-300">{"★★★★★".slice(full)}</span>
      </span>
      {count !== undefined && (
        <span className="text-slate-500">{count > 0 ? `${value.toFixed(1)} (${count})` : "ยังไม่มีรีวิว"}</span>
      )}
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700 ring-1 ring-sky-200"
      title="Admin ยืนยันผู้ขายรายนี้แล้ว"
    >
      ✔ Verified
    </span>
  );
}

export function ConditionBadge({ condition }: { condition: number }) {
  return condition === 0 ? (
    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
      มือหนึ่ง
    </span>
  ) : (
    <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-200">
      มือสอง
    </span>
  );
}

export function ProductImage({
  images,
  category,
  className = "",
  iconClass = "text-6xl",
}: {
  images?: string[] | null;
  category: number;
  className?: string;
  iconClass?: string;
}) {
  const first = images?.[0];
  if (first) {
    return <img src={productImageUrl(first)} alt="" loading="lazy" className={`object-contain ${className}`} />;
  }
  return (
    <div
      className={`flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 ${className}`}
      aria-hidden
    >
      <span className={iconClass}>{categoryOf(category).icon}</span>
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="text-5xl" aria-hidden>
        {icon}
      </div>
      <h3 className="mt-3 text-lg font-semibold text-slate-800">{title}</h3>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`}
      role="status"
      aria-label="กำลังโหลด"
    />
  );
}

export function EthAmount({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {value} <span className="text-[0.75em] font-medium text-slate-500">ETH</span>
    </span>
  );
}
