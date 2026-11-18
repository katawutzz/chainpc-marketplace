import type { ButtonHTMLAttributes, ReactNode } from "react";
import { BadgeCheck, Loader2, Star, type LucideIcon } from "lucide-react";
import { categoryOf } from "../lib/format";
import { productImageUrl } from "../lib/supabase";

// ─────────────────────────── ปุ่ม ───────────────────────────

type Variant = "primary" | "outline" | "secondary" | "danger" | "ghost" | "dark";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "bg-brand-500 text-white hover:bg-brand-600 shadow-sm",
  outline: "border border-brand-500 bg-brand-50 text-brand-600 hover:bg-brand-100",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-rose-300 bg-white text-rose-600 hover:bg-rose-50",
  ghost: "text-slate-600 hover:bg-slate-100",
  dark: "bg-slate-800 text-white hover:bg-slate-700",
};
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-5 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  icon: Icon,
  className = "",
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={`inline-flex shrink-0 items-center justify-center rounded-sm font-medium transition duration-150 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${variantClass[variant]} ${sizeClass[size]} ${className}`}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {children}
    </button>
  );
}

// ─────────────────────────── ราคา / ดาว / ป้าย ───────────────────────────

/** ราคา ETH สีส้ม แบบเว็บช้อปปิ้ง */
export function Price({ value, size = "md", className = "" }: { value: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const s = { sm: "text-sm", md: "text-base", lg: "text-xl", xl: "text-3xl" }[size];
  return (
    <span className={`whitespace-nowrap font-medium text-brand-500 ${s} ${className}`}>
      {value}
      <span className="ml-1 text-[0.7em] font-normal">ETH</span>
    </span>
  );
}

/** ใช้แทน Price เมื่อไม่ต้องการสีส้ม */
export function EthAmount({ value, className = "" }: { value: string; className?: string }) {
  return (
    <span className={`whitespace-nowrap ${className}`}>
      {value} <span className="text-[0.75em] font-normal text-slate-500">ETH</span>
    </span>
  );
}

export function Stars({ value, count, size = "sm" }: { value: number; count?: number; size?: "sm" | "md" }) {
  const px = size === "md" ? "h-4 w-4" : "h-3 w-3";
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${value.toFixed(1)} จาก 5 ดาว`}>
      <span className="inline-flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={`${px} ${n <= Math.round(value) ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`}
          />
        ))}
      </span>
      {count !== undefined && (
        <span className={`text-slate-500 ${size === "md" ? "text-sm" : "text-xs"}`}>
          {count > 0 ? `${value.toFixed(1)} (${count})` : "ยังไม่มีคะแนน"}
        </span>
      )}
    </span>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-sm bg-sky-600 px-1.5 py-px text-[11px] font-medium text-white"
      title="Admin ยืนยันผู้ขายรายนี้แล้ว"
    >
      <BadgeCheck className="h-3 w-3" />
      {!compact && "Verified"}
    </span>
  );
}

export function ConditionBadge({ condition }: { condition: number }) {
  return condition === 0 ? (
    <span className="rounded-sm bg-emerald-600 px-1.5 py-px text-[11px] font-medium text-white">มือหนึ่ง</span>
  ) : (
    <span className="rounded-sm bg-amber-500 px-1.5 py-px text-[11px] font-medium text-white">มือสอง</span>
  );
}

// ─────────────────────────── รูป / สถานะว่าง / โหลด ───────────────────────────

export function ProductImage({
  images,
  category,
  className = "",
  iconClass = "h-1/3 w-1/3",
}: {
  images?: string[] | null;
  category: number;
  className?: string;
  iconClass?: string;
}) {
  const first = images?.[0];
  if (first) {
    return <img src={productImageUrl(first)} alt="" loading="lazy" className={`bg-white object-contain transition-transform duration-300 ${className}`} />;
  }
  const Icon = categoryOf(category).icon;
  return (
    <div className={`flex items-center justify-center bg-slate-100 text-slate-300 ${className}`} aria-hidden>
      <Icon className={iconClass} strokeWidth={1.25} />
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center px-6 py-16 text-center">
      <span className="grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-10 w-10" strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 text-base font-medium text-slate-800">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function Spinner({ className = "h-5 w-5" }: { className?: string }) {
  return <Loader2 className={`animate-spin text-brand-500 ${className}`} aria-label="กำลังโหลด" />;
}

export function PageLoader({ text = "กำลังโหลด…" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-24 text-sm text-slate-500">
      <Spinner /> {text}
    </div>
  );
}

/** หัวข้อส่วนแบบมีขีดส้มด้านล่าง */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
      <h2 className="text-base font-medium uppercase tracking-wide text-slate-500">{title}</h2>
      {action}
    </div>
  );
}

/** ปุ่ม - จำนวน + */
export function QuantityStepper({
  value,
  max,
  onChange,
  disabled,
}: {
  value: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const btn = "grid h-8 w-8 place-items-center border border-slate-300 text-slate-600 transition hover:bg-slate-50 active:bg-slate-100 disabled:opacity-40";
  return (
    <div className="inline-flex items-center">
      <button type="button" className={`${btn} rounded-l-sm`} disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} aria-label="ลดจำนวน">
        −
      </button>
      <input
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ""));
          if (n >= 1) onChange(Math.min(n, max));
        }}
        disabled={disabled}
        className="h-8 w-12 border-y border-slate-300 text-center text-sm outline-none"
        aria-label="จำนวน"
      />
      <button type="button" className={`${btn} rounded-r-sm`} disabled={disabled || value >= max} onClick={() => onChange(value + 1)} aria-label="เพิ่มจำนวน">
        +
      </button>
    </div>
  );
}

/** ป้ายสถานะสี */
export function Pill({ tone, children }: { tone: "info" | "warn" | "danger" | "ok" | "muted" | "brand"; children: ReactNode }) {
  const t = {
    info: "bg-sky-50 text-sky-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-700",
    ok: "bg-emerald-50 text-emerald-700",
    muted: "bg-slate-100 text-slate-600",
    brand: "bg-brand-50 text-brand-600",
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium ${t}`}>{children}</span>;
}
