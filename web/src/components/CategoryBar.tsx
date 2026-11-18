import { Link, useLocation, useSearchParams } from "react-router-dom";
import { CATEGORIES } from "../lib/format";

export function CategoryBar() {
  const [params] = useSearchParams();
  const { pathname } = useLocation();
  const active = pathname === "/" ? params.get("cat") : null;

  return (
    <div className="bg-navy-800 text-sm text-white">
      <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 [scrollbar-width:none]">
        <Link
          to="/"
          className={`shrink-0 rounded px-2.5 py-1 hover:bg-white/10 ${pathname === "/" && !active ? "bg-white/15 font-semibold" : ""}`}
        >
          ☰ ทั้งหมด
        </Link>
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to={`/?cat=${c.id}`}
            className={`shrink-0 rounded px-2.5 py-1 hover:bg-white/10 ${active === String(c.id) ? "bg-white/15 font-semibold" : ""}`}
          >
            <span aria-hidden>{c.icon}</span> {c.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
