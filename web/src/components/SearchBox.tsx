import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Clock, Search, X } from "lucide-react";
import { useListings, type ProductListing } from "../hooks/useMarket";
import { CATEGORIES, formatEth } from "../lib/format";
import { Price, ProductImage } from "./ui";

const RECENT_KEY = "chainpc-recent-searches";
const MAX_PRODUCTS = 6;

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 6)));
  } catch {
    /* ไม่มี localStorage ก็ไม่เป็นไร */
  }
}

type Item =
  | { kind: "query"; text: string }
  | { kind: "recent"; text: string }
  | { kind: "category"; id: number; label: string; count: number }
  | { kind: "product"; product: ProductListing };

/** ไฮไลต์ส่วนที่ตรงกับคำค้น */
function Highlight({ text, term }: { text: string; term: string }) {
  const i = term ? text.toLowerCase().indexOf(term.toLowerCase()) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <b className="font-semibold text-brand-600">{text.slice(i, i + term.length)}</b>
      {text.slice(i + term.length)}
    </>
  );
}

/** ช่องค้นหาพร้อมตัวอย่างผลลัพธ์ (สินค้า + หมวดหมู่ + คำค้นล่าสุด) */
export function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { data: listings } = useListings();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setQ(params.get("q") ?? ""), [params]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const term = q.trim();
  const items = useMemo<Item[]>(() => {
    if (!term) return recent.map((text) => ({ kind: "recent" as const, text }));
    const t = term.toLowerCase();
    const products = (listings ?? [])
      .filter((p) => p.title.toLowerCase().includes(t) || p.details?.description?.toLowerCase().includes(t))
      // ชื่อขึ้นต้นด้วยคำค้นมาก่อน แล้วตามด้วยที่ขายดี
      .sort((a, b) => Number(b.title.toLowerCase().startsWith(t)) - Number(a.title.toLowerCase().startsWith(t)) || b.sold - a.sold)
      .slice(0, MAX_PRODUCTS);
    const categories = CATEGORIES.filter((c) => c.label.toLowerCase().includes(t)).map((c) => ({
      kind: "category" as const,
      id: c.id,
      label: c.label,
      count: (listings ?? []).filter((p) => p.category === c.id).length,
    }));
    return [
      { kind: "query" as const, text: term },
      ...categories,
      ...products.map((product) => ({ kind: "product" as const, product })),
    ];
  }, [term, listings, recent]);

  const remember = (text: string) => {
    const next = [text, ...recent.filter((r) => r !== text)].slice(0, 6);
    setRecent(next);
    saveRecent(next);
  };

  const go = (item: Item) => {
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
    if (item.kind === "query" || item.kind === "recent") {
      remember(item.text);
      setQ(item.text);
      navigate({ pathname: "/", search: `?q=${encodeURIComponent(item.text)}` });
    } else if (item.kind === "category") {
      navigate(`/?cat=${item.id}`);
    } else {
      if (term) remember(term);
      navigate(`/product/${item.product.id}`);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (active >= 0 && items[active]) return go(items[active]);
    if (term) go({ kind: "query", text: term });
    else {
      setOpen(false);
      navigate("/");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const showPanel = open && items.length > 0;
  const productCount = items.filter((i) => i.kind === "product").length;

  return (
    <div ref={boxRef} className="relative">
      <form onSubmit={onSubmit} className="flex rounded-sm bg-white p-[3px] shadow-sm" role="search">
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="ค้นหาสินค้า เช่น การ์ดจอ RTX, Ryzen, SSD"
          className="min-w-0 flex-1 px-3 text-sm text-slate-900 outline-none"
          aria-label="ค้นหาสินค้า"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="search-suggestions"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {q && (
          <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} className="px-2 text-slate-400 hover:text-slate-600" aria-label="ล้างคำค้น">
            <X className="h-4 w-4" />
          </button>
        )}
        <button type="submit" className="grid h-9 w-16 place-items-center rounded-sm bg-brand-500 transition hover:bg-brand-600 active:scale-95" aria-label="ค้นหา">
          <Search className="h-4 w-4" />
        </button>
      </form>

      {showPanel && (
        <div id="search-suggestions" role="listbox" className="absolute inset-x-0 top-full z-50 mt-1 max-h-[70vh] origin-top animate-pop overflow-y-auto rounded-sm bg-white py-1 text-slate-800 shadow-xl ring-1 ring-black/5">
          {!term && (
            <div className="flex items-center justify-between px-4 pb-1 pt-2 text-xs text-slate-400">
              <span>ค้นหาล่าสุด</span>
              <button
                type="button"
                onClick={() => {
                  setRecent([]);
                  saveRecent([]);
                }}
                className="hover:text-brand-600"
              >
                ล้าง
              </button>
            </div>
          )}
          {items.map((item, i) => {
            const isActive = i === active;
            const base = `flex w-full items-center gap-3 px-4 text-left text-sm ${isActive ? "bg-slate-100" : "hover:bg-slate-50"}`;
            const firstProduct = item.kind === "product" && items[i - 1]?.kind !== "product";
            return (
              <div key={i}>
                {firstProduct && <p className="border-t border-slate-100 px-4 pb-1 pt-2 text-xs text-slate-400">สินค้า ({productCount})</p>}
                <button type="button" role="option" aria-selected={isActive} onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => go(item)} className={`${base} ${item.kind === "product" ? "py-2" : "py-2.5"}`}>
                  {item.kind === "recent" && (
                    <>
                      <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">{item.text}</span>
                    </>
                  )}
                  {item.kind === "query" && (
                    <>
                      <Search className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="truncate">
                        ค้นหา "<span className="text-brand-600">{item.text}</span>"
                      </span>
                    </>
                  )}
                  {item.kind === "category" && (
                    <>
                      <span className="rounded-sm bg-brand-50 px-1.5 py-0.5 text-[11px] text-brand-600">หมวดหมู่</span>
                      <span className="truncate">
                        <Highlight text={item.label} term={term} />
                      </span>
                      <span className="ml-auto text-xs text-slate-400">{item.count} รายการ</span>
                    </>
                  )}
                  {item.kind === "product" && (
                    <>
                      <ProductImage images={item.product.details?.images} category={item.product.category} className="h-10 w-10 shrink-0 border border-slate-100" iconClass="h-5 w-5" />
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-1">
                          <Highlight text={item.product.title} term={term} />
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.product.condition === 0 ? "มือหนึ่ง" : "มือสอง"} · ขายแล้ว {item.product.sold} · {item.product.stock > 0 ? `เหลือ ${item.product.stock}` : "สินค้าหมด"}
                        </span>
                      </span>
                      <Price value={formatEth(item.product.price_wei)} size="sm" />
                    </>
                  )}
                </button>
              </div>
            );
          })}
          {term && productCount === 0 && (
            <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-500">ไม่พบสินค้าที่ตรงกับ "{term}"</p>
          )}
        </div>
      )}
    </div>
  );
}
