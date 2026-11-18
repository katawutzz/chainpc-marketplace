import type { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export interface SideNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
  /** เทียบ query ?tab= ด้วย (ถ้า to มี ?tab=) */
  exact?: boolean;
}

/** เลย์เอาต์มีเมนูด้านซ้าย (บัญชีของฉัน / ศูนย์ผู้ขาย / Admin) */
export function SideNavLayout({
  header,
  items,
  children,
}: {
  header: ReactNode;
  items: SideNavItem[];
  children: ReactNode;
}) {
  const { pathname, search } = useLocation();
  const current = pathname + search;

  const isActive = (to: string) => {
    if (to.includes("?")) return current === to || (to.endsWith("?tab=overview") && current === to.split("?")[0]);
    return pathname === to;
  };

  return (
    <div className="flex flex-col gap-5 md:flex-row">
      <aside className="md:w-52 md:shrink-0">
        <div className="mb-3 border-b border-slate-200 pb-3">{header}</div>
        <nav className="flex gap-1 overflow-x-auto pb-1 md:flex-col md:overflow-visible">
          {items.map((it) => {
            const active = isActive(it.to);
            return (
              <NavLink
                key={it.to}
                to={it.to}
                className={`flex shrink-0 items-center gap-2.5 rounded-sm px-2 py-2 text-sm ${active ? "font-medium text-brand-600" : "text-slate-700 hover:text-brand-600"}`}
              >
                <it.icon className={`h-4 w-4 ${active ? "text-brand-500" : "text-slate-500"}`} />
                {it.label}
                {!!it.badge && <span className="ml-auto rounded-full bg-brand-500 px-1.5 text-[11px] text-white">{it.badge}</span>}
              </NavLink>
            );
          })}
        </nav>
      </aside>
      <section className="min-w-0 flex-1">{children}</section>
    </div>
  );
}

export function NavAvatar({ address, title, subtitle }: { address: string; title: string; subtitle?: ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-semibold text-brand-600 ring-1 ring-brand-100">
        {address.slice(2, 4).toUpperCase()}
      </span>
      <div className="min-w-0">
        <p className="truncate font-medium text-slate-900">{title}</p>
        {subtitle && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
      </div>
    </div>
  );
}
