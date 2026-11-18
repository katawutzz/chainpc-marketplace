import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseEther } from "viem";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Filter,
  Lock,
  PackageSearch,
  RotateCcw,
  Scale,
  Store,
  TriangleAlert,
} from "lucide-react";
import { ProductCard } from "../components/ProductCard";
import { Button, EmptyState, PageLoader, Stars } from "../components/ui";
import { useListings, type ProductListing } from "../hooks/useMarket";
import { CATEGORIES, CONDITIONS, categoryOf, ratingOf } from "../lib/format";

type SortKey = "newest" | "sold" | "price-asc" | "price-desc";

function safeParseEth(v: string): bigint | null {
  if (!v.trim()) return null;
  try {
    return parseEther(v.trim());
  } catch {
    return null;
  }
}

export function HomePage() {
  const [params] = useSearchParams();
  const q = (params.get("q") ?? "").trim();
  const cat = params.get("cat");
  const category = cat !== null && cat !== "" ? Number(cat) : null;
  const { data: listings, isLoading, error, refetch } = useListings();

  if (isLoading) return <PageLoader text="กำลังโหลดสินค้า…" />;
  if (error) {
    return (
      <EmptyState icon={TriangleAlert} title="โหลดสินค้าไม่สำเร็จ">
        <p>{(error as Error).message}</p>
        <Button className="mt-4" size="sm" onClick={() => void refetch()}>
          ลองใหม่
        </Button>
      </EmptyState>
    );
  }

  if (q || category !== null) return <SearchResults listings={listings ?? []} q={q} category={category} />;
  return <Home listings={listings ?? []} />;
}

// ─────────────────────────── หน้าแรก ───────────────────────────

function Home({ listings }: { listings: ProductListing[] }) {
  const [visible, setVisible] = useState(24);
  return (
    <div className="space-y-5">
      <Banners />
      <TrustStrip />
      <CategoryGrid listings={listings} />

      <section>
        <div className="border-b-4 border-brand-500 bg-white px-4 py-3.5 text-center">
          <h2 className="font-medium uppercase tracking-wide text-brand-500">สินค้าแนะนำประจำวัน</h2>
        </div>
        {listings.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={Store} title="ยังไม่มีสินค้าในตลาด">
              เป็นคนแรกที่ลงขาย —{" "}
              <Link to="/seller/products/new" className="text-brand-600 hover:underline">
                ลงขายสินค้า
              </Link>
            </EmptyState>
          </div>
        ) : (
          <>
            <ProductGrid products={listings.slice(0, visible)} cols="lg:grid-cols-6" />
            {visible < listings.length && (
              <div className="mt-5 text-center">
                <Button variant="secondary" className="w-72" onClick={() => setVisible((v) => v + 24)}>
                  ดูเพิ่มเติม
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

const SLIDES = [
  {
    bg: "from-brand-600 via-brand-500 to-amber-400",
    kicker: "ซื้อขายอย่างปลอดภัย",
    title: "เงินถูกล็อกใน Smart Contract",
    text: "ผู้ขายได้เงินเมื่อคุณยืนยันว่าได้รับของแล้วเท่านั้น",
    cta: { to: "/?cat=2", label: "เลือกซื้อการ์ดจอ" },
  },
  {
    bg: "from-slate-900 via-slate-800 to-sky-800",
    kicker: "ของมือสองราคาดี",
    title: "การ์ดจอ · CPU · RAM · SSD",
    text: "อุปกรณ์คอมพิวเตอร์จากผู้ขายทั่วประเทศ จ่ายด้วย ETH ผ่าน MetaMask",
    cta: { to: "/?cat=1", label: "ดู CPU ทั้งหมด" },
  },
  {
    bg: "from-emerald-700 via-emerald-600 to-teal-500",
    kicker: "สำหรับผู้ขาย",
    title: "เปิดร้านฟรี ลงขายได้ทันที",
    text: "ค่าธรรมเนียมเพียง 2% เมื่อขายสำเร็จ ไม่มีค่าแรกเข้า",
    cta: { to: "/seller/products/new", label: "เริ่มขายสินค้า" },
  },
];

function Banners() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % SLIDES.length), 5000);
    return () => clearInterval(t);
  }, []);
  const s = SLIDES[i];

  return (
    <section className="grid gap-1 md:grid-cols-[2fr_1fr]">
      <div className={`group relative flex h-56 overflow-hidden rounded-sm bg-gradient-to-r text-white transition-colors duration-500 sm:h-64 ${s.bg}`}>
        <div key={i} className="flex animate-page flex-col justify-center gap-2 p-6 sm:p-10">
          <p className="text-sm font-medium text-white/80">{s.kicker}</p>
          <h2 className="text-2xl font-semibold leading-tight sm:text-3xl">{s.title}</h2>
          <p className="max-w-md text-sm text-white/85">{s.text}</p>
          <Link to={s.cta.to} className="mt-2 w-fit rounded-sm bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-100">
            {s.cta.label}
          </Link>
        </div>
        <button
          onClick={() => setI((i - 1 + SLIDES.length) % SLIDES.length)}
          className="absolute left-0 top-1/2 hidden h-14 w-8 -translate-y-1/2 place-items-center bg-black/20 group-hover:grid"
          aria-label="สไลด์ก่อนหน้า"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          onClick={() => setI((i + 1) % SLIDES.length)}
          className="absolute right-0 top-1/2 hidden h-14 w-8 -translate-y-1/2 place-items-center bg-black/20 group-hover:grid"
          aria-label="สไลด์ถัดไป"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2">
          {SLIDES.map((_, n) => (
            <button
              key={n}
              onClick={() => setI(n)}
              className={`h-2 rounded-full transition-all duration-300 ${n === i ? "w-5 bg-white" : "w-2 bg-white/50"}`}
              aria-label={`สไลด์ที่ ${n + 1}`}
            />
          ))}
        </div>
      </div>
      <div className="hidden grid-rows-2 gap-1 md:grid">
        <Link to="/?cat=6" className="flex flex-col justify-center rounded-sm bg-gradient-to-br from-sky-600 to-indigo-700 p-5 text-white hover:opacity-95">
          <p className="text-xs text-white/80">หมวดแนะนำ</p>
          <p className="text-lg font-semibold">จอมอนิเตอร์เกมมิ่ง</p>
          <p className="text-xs text-white/80">144Hz ขึ้นไป</p>
        </Link>
        <Link to="/?cat=0" className="flex flex-col justify-center rounded-sm bg-gradient-to-br from-rose-600 to-brand-500 p-5 text-white hover:opacity-95">
          <p className="text-xs text-white/80">พร้อมใช้งาน</p>
          <p className="text-lg font-semibold">PC ประกอบทั้งเครื่อง</p>
          <p className="text-xs text-white/80">เสียบปลั๊กแล้วเล่นได้เลย</p>
        </Link>
      </div>
    </section>
  );
}

function TrustStrip() {
  const items = [
    { icon: Lock, title: "เงินปลอดภัยใน Escrow", text: "ล็อกจนกว่าคุณจะได้ของ" },
    { icon: RotateCcw, title: "คืนเงินอัตโนมัติ", text: "ผู้ขายไม่ส่งตามกำหนด" },
    { icon: Scale, title: "มีคนกลางเมื่อมีปัญหา", text: "Admin ช่วยตัดสิน" },
    { icon: BadgeCheck, title: "ตรวจสอบได้ทุกธุรกรรม", text: "บน Etherscan" },
  ];
  return (
    <section className="card grid grid-cols-2 gap-y-4 px-2 py-4 md:grid-cols-4">
      {items.map((it) => (
        <div key={it.title} className="flex items-center gap-3 px-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-500">
            <it.icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-sm font-medium text-slate-800">{it.title}</span>
            <span className="block text-xs text-slate-500">{it.text}</span>
          </span>
        </div>
      ))}
    </section>
  );
}

function CategoryGrid({ listings }: { listings: ProductListing[] }) {
  const counts = new Map<number, number>();
  for (const p of listings) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  return (
    <section className="card overflow-hidden">
      <div className="px-5 py-4">
        <h2 className="font-medium uppercase tracking-wide text-slate-500">หมวดหมู่</h2>
      </div>
      <div className="grid grid-cols-3 border-l border-t border-slate-100 sm:grid-cols-5 lg:grid-cols-9">
        {CATEGORIES.map((c) => (
          <Link
            key={c.id}
            to={`/?cat=${c.id}`}
            className="flex flex-col items-center gap-2 border-b border-r border-slate-100 px-2 py-5 text-center transition hover:z-10 hover:shadow-[0_0_8px_rgba(0,0,0,0.1)]"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-brand-50 to-orange-100 text-brand-500">
              <c.icon className="h-8 w-8" strokeWidth={1.5} />
            </span>
            <span className="text-[13px] leading-tight text-slate-700">{c.label}</span>
            <span className="text-[11px] text-slate-400">{counts.get(c.id) ?? 0} รายการ</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function ProductGrid({ products, cols = "lg:grid-cols-5" }: { products: ProductListing[]; cols?: string }) {
  return (
    <div className={`mt-2.5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 ${cols}`}>
      {products.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </div>
  );
}

// ─────────────────────────── ผลการค้นหา / หมวดหมู่ ───────────────────────────

function SearchResults({ listings, q, category }: { listings: ProductListing[]; q: string; category: number | null }) {
  const [params, setParams] = useSearchParams();
  const [conditions, setConditions] = useState<number[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceApplied, setPriceApplied] = useState<{ min: bigint | null; max: bigint | null }>({ min: null, max: null });
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");

  const results = useMemo(() => {
    const term = q.toLowerCase();
    const filtered = listings.filter((p) => {
      if (category !== null && p.category !== category) return false;
      if (term && !`${p.title} ${p.details?.description ?? ""}`.toLowerCase().includes(term)) return false;
      if (conditions.length && !conditions.includes(p.condition)) return false;
      const price = BigInt(p.price_wei);
      if (priceApplied.min !== null && price < priceApplied.min) return false;
      if (priceApplied.max !== null && price > priceApplied.max) return false;
      if (minRating && ratingOf(p.sellerInfo).avg < minRating) return false;
      if (verifiedOnly && !p.sellerInfo?.verified) return false;
      if (inStockOnly && p.stock <= 0) return false;
      return true;
    });
    const cmp: Record<SortKey, (a: ProductListing, b: ProductListing) => number> = {
      newest: (a, b) => b.id - a.id,
      sold: (a, b) => b.sold - a.sold || b.id - a.id,
      "price-asc": (a, b) => (BigInt(a.price_wei) < BigInt(b.price_wei) ? -1 : 1),
      "price-desc": (a, b) => (BigInt(a.price_wei) > BigInt(b.price_wei) ? -1 : 1),
    };
    return [...filtered].sort(cmp[sort]);
  }, [listings, category, q, conditions, priceApplied, minRating, verifiedOnly, inStockOnly, sort]);

  const setCategory = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("cat");
    else next.set("cat", String(id));
    setParams(next);
  };
  const clearAll = () => {
    setConditions([]);
    setMinPrice("");
    setMaxPrice("");
    setPriceApplied({ min: null, max: null });
    setMinRating(0);
    setVerifiedOnly(false);
    setInStockOnly(false);
  };

  const sortBtn = (key: SortKey, label: string) => (
    <button
      onClick={() => setSort(key)}
      className={`h-8 rounded-sm px-4 text-sm ${sort === key ? "bg-brand-500 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-5 md:flex-row">
      {/* ── ตัวกรอง ── */}
      <aside className="space-y-5 text-sm md:w-48 md:shrink-0">
        <div>
          <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-800">
            <Filter className="h-4 w-4" /> ตัวกรองการค้นหา
          </h3>
        </div>
        <FilterGroup title="ตามหมวดหมู่">
          <FilterOption active={category === null} onClick={() => setCategory(null)}>
            ทั้งหมด
          </FilterOption>
          {CATEGORIES.map((c) => (
            <FilterOption key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
              {c.label}
            </FilterOption>
          ))}
        </FilterGroup>
        <FilterGroup title="สภาพสินค้า">
          {CONDITIONS.map((c) => (
            <Check key={c.id} checked={conditions.includes(c.id)} onChange={(v) => setConditions((p) => (v ? [...p, c.id] : p.filter((x) => x !== c.id)))}>
              {c.label}
            </Check>
          ))}
        </FilterGroup>
        <FilterGroup title="ช่วงราคา (ETH)">
          <div className="flex items-center gap-2">
            <input inputMode="decimal" placeholder="ต่ำสุด" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} className="input h-8 px-2 text-xs" />
            <span className="text-slate-400">–</span>
            <input inputMode="decimal" placeholder="สูงสุด" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} className="input h-8 px-2 text-xs" />
          </div>
          <Button size="sm" className="mt-2 w-full" onClick={() => setPriceApplied({ min: safeParseEth(minPrice), max: safeParseEth(maxPrice) })}>
            ใช้ช่วงราคา
          </Button>
        </FilterGroup>
        <FilterGroup title="คะแนนร้านค้า">
          {[5, 4, 3].map((r) => (
            <button key={r} onClick={() => setMinRating(minRating === r ? 0 : r)} className={`flex items-center gap-1 py-0.5 ${minRating === r ? "font-medium text-brand-600" : ""}`}>
              <Stars value={r} /> {r < 5 && "ขึ้นไป"}
            </button>
          ))}
        </FilterGroup>
        <FilterGroup title="บริการ">
          <Check checked={verifiedOnly} onChange={setVerifiedOnly}>
            ร้าน Verified
          </Check>
          <Check checked={inStockOnly} onChange={setInStockOnly}>
            มีสินค้าพร้อมส่ง
          </Check>
        </FilterGroup>
        <Button variant="primary" className="w-full" onClick={clearAll}>
          ล้างทั้งหมด
        </Button>
      </aside>

      {/* ── ผลลัพธ์ ── */}
      <section className="min-w-0 flex-1">
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <PackageSearch className="h-4 w-4" />
          {q ? (
            <>
              ผลการค้นหาสำหรับ '<span className="text-brand-600">{q}</span>'
            </>
          ) : (
            <>
              หมวดหมู่ <span className="text-brand-600">{categoryOf(category ?? 0).label}</span>
            </>
          )}
          <span className="text-slate-400">· {results.length} รายการ</span>
        </p>

        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-slate-200/70 px-4 py-2.5 text-sm">
          <span className="mr-1 text-slate-600">เรียงโดย</span>
          {sortBtn("newest", "ล่าสุด")}
          {sortBtn("sold", "ขายดี")}
          <select
            value={sort.startsWith("price") ? sort : ""}
            onChange={(e) => e.target.value && setSort(e.target.value as SortKey)}
            className={`h-8 min-w-40 rounded-sm px-3 text-sm outline-none ${sort.startsWith("price") ? "text-brand-600" : "text-slate-700"}`}
          >
            <option value="">ราคา</option>
            <option value="price-asc">ราคา: จากน้อยไปมาก</option>
            <option value="price-desc">ราคา: จากมากไปน้อย</option>
          </select>
        </div>

        {results.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon={PackageSearch} title="ไม่พบสินค้าที่ตรงกับเงื่อนไข">
              ลองใช้คำค้นหาอื่น หรือล้างตัวกรอง
            </EmptyState>
          </div>
        ) : (
          <ProductGrid products={results} />
        )}
      </section>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="border-b border-slate-200 pb-4">
      <legend className="mb-2 text-sm text-slate-800">{title}</legend>
      <div className="space-y-1 text-slate-700">{children}</div>
    </fieldset>
  );
}

function FilterOption({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`block w-full py-0.5 text-left hover:text-brand-600 ${active ? "font-medium text-brand-600" : ""}`} aria-pressed={active}>
      {children}
    </button>
  );
}

function Check({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 py-0.5">
      <input type="checkbox" className="h-4 w-4 accent-brand-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  );
}
