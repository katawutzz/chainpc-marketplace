import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { parseEther } from "viem";
import { ProductCard } from "../components/ProductCard";
import { EmptyState, Spinner } from "../components/ui";
import { useListings, type ProductListing } from "../hooks/useMarket";
import { CATEGORIES, CONDITIONS, categoryOf, ratingOf } from "../lib/format";

type SortKey = "newest" | "price-asc" | "price-desc" | "rating";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "ใหม่ล่าสุด" },
  { key: "price-asc", label: "ราคา: ต่ำ → สูง" },
  { key: "price-desc", label: "ราคา: สูง → ต่ำ" },
  { key: "rating", label: "คะแนนผู้ขาย" },
];

function safeParseEth(v: string): bigint | null {
  if (!v.trim()) return null;
  try {
    return parseEther(v.trim());
  } catch {
    return null;
  }
}

export function HomePage() {
  const [params, setParams] = useSearchParams();
  const q = (params.get("q") ?? "").trim().toLowerCase();
  const cat = params.get("cat");
  const category = cat !== null && cat !== "" ? Number(cat) : null;

  const [conditions, setConditions] = useState<number[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minRating, setMinRating] = useState(0);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortKey>("newest");
  const [showFilters, setShowFilters] = useState(false);

  const { data: listings, isLoading, error, refetch } = useListings();

  const results = useMemo(() => {
    if (!listings) return [];
    const min = safeParseEth(minPrice);
    const max = safeParseEth(maxPrice);
    const filtered = listings.filter((p) => {
      if (category !== null && p.category !== category) return false;
      if (q && !`${p.title} ${p.details?.description ?? ""}`.toLowerCase().includes(q)) return false;
      if (conditions.length && !conditions.includes(p.condition)) return false;
      const price = BigInt(p.price_wei);
      if (min !== null && price < min) return false;
      if (max !== null && price > max) return false;
      if (minRating && ratingOf(p.sellerInfo).avg < minRating) return false;
      if (verifiedOnly && !p.sellerInfo?.verified) return false;
      if (inStockOnly && p.stock <= 0) return false;
      return true;
    });
    const cmp: Record<SortKey, (a: ProductListing, b: ProductListing) => number> = {
      newest: (a, b) => b.id - a.id,
      "price-asc": (a, b) => (BigInt(a.price_wei) < BigInt(b.price_wei) ? -1 : 1),
      "price-desc": (a, b) => (BigInt(a.price_wei) > BigInt(b.price_wei) ? -1 : 1),
      rating: (a, b) => ratingOf(b.sellerInfo).avg - ratingOf(a.sellerInfo).avg,
    };
    return [...filtered].sort(cmp[sort]);
  }, [listings, category, q, conditions, minPrice, maxPrice, minRating, verifiedOnly, inStockOnly, sort]);

  const isBrowsingAll = !q && category === null;
  const activeFilterCount =
    conditions.length + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (minRating ? 1 : 0) + (verifiedOnly ? 1 : 0) + (inStockOnly ? 1 : 0);

  const resetFilters = () => {
    setConditions([]);
    setMinPrice("");
    setMaxPrice("");
    setMinRating(0);
    setVerifiedOnly(false);
    setInStockOnly(false);
  };

  const setCategory = (id: number | null) => {
    const next = new URLSearchParams(params);
    if (id === null) next.delete("cat");
    else next.set("cat", String(id));
    setParams(next);
  };

  return (
    <div className="space-y-6">
      {isBrowsingAll && <Hero />}

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* ── ตัวกรอง ── */}
        <aside className="lg:w-60 lg:shrink-0">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="mb-3 w-full rounded-lg bg-white px-4 py-2 text-left text-sm font-semibold shadow-sm ring-1 ring-slate-200 lg:hidden"
            aria-expanded={showFilters}
          >
            ⚙️ ตัวกรอง {activeFilterCount > 0 && `(${activeFilterCount})`} <span className="float-right">{showFilters ? "▴" : "▾"}</span>
          </button>
          <div className={`${showFilters ? "block" : "hidden"} space-y-5 rounded-xl bg-white p-4 text-sm shadow-sm ring-1 ring-slate-200 lg:block`}>
            <FilterGroup title="หมวดหมู่">
              <RadioRow checked={category === null} onChange={() => setCategory(null)} label="ทั้งหมด" />
              {CATEGORIES.map((c) => (
                <RadioRow
                  key={c.id}
                  checked={category === c.id}
                  onChange={() => setCategory(c.id)}
                  label={`${c.icon} ${c.label}`}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="สภาพสินค้า">
              {CONDITIONS.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 py-0.5">
                  <input
                    type="checkbox"
                    className="accent-mint-600"
                    checked={conditions.includes(c.id)}
                    onChange={(e) =>
                      setConditions((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))
                    }
                  />
                  {c.label}
                </label>
              ))}
            </FilterGroup>

            <FilterGroup title="ช่วงราคา (ETH)">
              <div className="flex items-center gap-2">
                <input
                  inputMode="decimal"
                  placeholder="ต่ำสุด"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-mint-500"
                />
                <span className="text-slate-400">–</span>
                <input
                  inputMode="decimal"
                  placeholder="สูงสุด"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-2 py-1 outline-none focus:border-mint-500"
                />
              </div>
            </FilterGroup>

            <FilterGroup title="คะแนนผู้ขาย">
              {[0, 4, 3].map((r) => (
                <RadioRow
                  key={r}
                  checked={minRating === r}
                  onChange={() => setMinRating(r)}
                  label={r === 0 ? "ทั้งหมด" : `${"★".repeat(r)}${"☆".repeat(5 - r)} ขึ้นไป`}
                />
              ))}
            </FilterGroup>

            <FilterGroup title="อื่น ๆ">
              <label className="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" className="accent-mint-600" checked={verifiedOnly} onChange={(e) => setVerifiedOnly(e.target.checked)} />
                เฉพาะผู้ขาย ✔ Verified
              </label>
              <label className="flex cursor-pointer items-center gap-2 py-0.5">
                <input type="checkbox" className="accent-mint-600" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                เฉพาะที่มีของ
              </label>
            </FilterGroup>

            {activeFilterCount > 0 && (
              <button onClick={resetFilters} className="text-sky-700 hover:underline">
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </aside>

        {/* ── ผลลัพธ์ ── */}
        <section className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {q ? `ผลการค้นหา "${params.get("q")}"` : category !== null ? categoryOf(category).label : "สินค้าทั้งหมด"}
              </h1>
              {listings && <p className="text-sm text-slate-500">{results.length} รายการ</p>}
            </div>
            <label className="flex items-center gap-2 text-sm">
              <span className="text-slate-500">เรียงตาม</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 outline-none focus:border-mint-500"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-3 py-20 text-slate-500">
              <Spinner /> กำลังโหลดสินค้า…
            </div>
          ) : error ? (
            <EmptyState icon="⚠️" title="โหลดสินค้าไม่สำเร็จ">
              {(error as Error).message}
              <button onClick={() => void refetch()} className="mt-3 block w-full text-sky-700 hover:underline">
                ลองใหม่
              </button>
            </EmptyState>
          ) : results.length === 0 ? (
            listings && listings.length === 0 ? (
              <EmptyState icon="🏪" title="ยังไม่มีสินค้าในตลาด">
                เป็นคนแรกที่ลงขาย! เชื่อม MetaMask แล้วไปที่{" "}
                <Link to="/seller" className="text-sky-700 hover:underline">
                  ศูนย์ผู้ขาย
                </Link>
              </EmptyState>
            ) : (
              <EmptyState icon="🔍" title="ไม่พบสินค้าที่ตรงกับเงื่อนไข">
                ลองเปลี่ยนคำค้นหาหรือล้างตัวกรอง
              </EmptyState>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
              {results.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Hero() {
  const points = [
    { icon: "🔒", title: "เงินล็อกใน Smart Contract", text: "ผู้ขายได้เงินเมื่อคุณยืนยันว่าได้รับของแล้วเท่านั้น" },
    { icon: "↩️", title: "คืนเงินอัตโนมัติ", text: "ผู้ขายไม่ส่งของตามกำหนด กดขอเงินคืนได้ทันที" },
    { icon: "⭐", title: "รีวิวที่แก้ไม่ได้", text: "คะแนนผู้ขายถูกบันทึกบนบล็อกเชน ไม่มีใครลบได้" },
  ];
  return (
    <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-navy-900 via-navy-800 to-sky-900 text-white shadow-sm">
      <div className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1.3fr_1fr] md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-mint-400">Decentralized PC Marketplace</p>
          <h2 className="mt-2 text-2xl font-bold leading-tight sm:text-3xl">
            ซื้อขายคอมพิวเตอร์และอุปกรณ์ IT
            <br className="hidden sm:block" /> อย่างปลอดภัยด้วย Smart Contract
          </h2>
          <p className="mt-3 max-w-xl text-slate-300">
            จ่ายด้วย ETH ผ่าน MetaMask บน Ethereum Hoodi Testnet — ทุกธุรกรรมโปร่งใส ตรวจสอบได้บน Etherscan
          </p>
        </div>
        <ul className="grid gap-3">
          {points.map((p) => (
            <li key={p.title} className="flex gap-3 rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <span className="text-2xl" aria-hidden>
                {p.icon}
              </span>
              <span>
                <span className="block font-semibold">{p.title}</span>
                <span className="block text-sm text-slate-300">{p.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-1.5 font-semibold text-slate-800">{title}</legend>
      <div className="space-y-0.5 text-slate-700">{children}</div>
    </fieldset>
  );
}

function RadioRow({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`block w-full rounded px-1.5 py-0.5 text-left hover:bg-slate-100 ${checked ? "font-semibold text-mint-600" : ""}`}
      aria-pressed={checked}
    >
      {label}
    </button>
  );
}
