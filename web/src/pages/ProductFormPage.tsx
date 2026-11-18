import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, Spinner } from "../components/ui";
import { useOnChainProduct, useProductListing } from "../hooks/useMarket";
import { marketplace } from "../lib/chain";
import { CATEGORIES, CONDITIONS } from "../lib/format";
import { detailsHash } from "../lib/hash";
import { productImageUrl, supabase } from "../lib/supabase";
import { toast, useMarketplaceTx, waitForSynced } from "../lib/tx";

const MAX_IMAGES = 5;
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** หัวข้อสเปกแนะนำตามหมวดหมู่ */
const SPEC_TEMPLATES: Record<number, string[]> = {
  0: ["CPU", "GPU", "RAM", "Storage", "Mainboard", "PSU", "เคส"],
  1: ["Socket", "จำนวนคอร์/เธรด", "Base / Boost Clock", "TDP", "ประกัน"],
  2: ["ชิปเซ็ต", "VRAM", "ความยาวการ์ด", "หัวไฟ", "ประกัน"],
  3: ["ประเภท", "ความจุ", "ความเร็ว", "จำนวนแถว", "ประกัน"],
  4: ["ความจุ", "Interface", "ความเร็วอ่าน/เขียน", "ประกัน"],
  5: ["Socket", "ชิปเซ็ต", "Form Factor", "รองรับ RAM", "ประกัน"],
  6: ["ขนาดจอ", "ความละเอียด", "Refresh Rate", "พาเนล", "ประกัน"],
  7: ["รุ่น", "การเชื่อมต่อ", "สวิตช์ / เซ็นเซอร์", "ประกัน"],
  8: ["การเชื่อมต่อ", "ไมโครโฟน", "รองรับแพลตฟอร์ม", "ประกัน"],
};

type SpecRow = { key: string; value: string };
type Phase = "idle" | "uploading" | "tx" | "syncing";

export function ProductFormPage() {
  const { id } = useParams();
  return (
    <RequireWallet signIn title={id ? "แก้ไขสินค้า" : "ลงขายสินค้า"}>
      <ProductForm productId={id ? Number(id) : null} />
    </RequireWallet>
  );
}

function ProductForm({ productId }: { productId: number | null }) {
  const isEdit = productId !== null;
  const navigate = useNavigate();
  const { address } = useAccount();
  const wallet = address!.toLowerCase();
  const { data: chain, isLoading: chainLoading } = useOnChainProduct(productId ?? 0);
  const { data: listing, isLoading: listingLoading } = useProductListing(productId ?? 0);
  const { send } = useMarketplaceTx();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState(2);
  const [condition, setCondition] = useState(1);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("1");
  const [description, setDescription] = useState("");
  const [specs, setSpecs] = useState<SpecRow[]>(SPEC_TEMPLATES[2].map((key) => ({ key, value: "" })));
  const [images, setImages] = useState<string[]>([]); // path ที่อัปโหลดแล้ว
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [loaded, setLoaded] = useState(!isEdit);

  // โหลดค่าเดิมตอนแก้ไข
  useEffect(() => {
    if (!isEdit || loaded || !chain || listingLoading) return;
    setTitle(chain.title);
    setCategory(chain.category);
    setCondition(chain.condition);
    setPrice(formatEther(chain.price));
    setStock(String(chain.stock));
    const d = listing?.details;
    setDescription(d?.description ?? "");
    const existing = Object.entries((d?.specs ?? {}) as Record<string, string>).map(([key, value]) => ({ key, value }));
    setSpecs(existing.length ? existing : SPEC_TEMPLATES[chain.category].map((key) => ({ key, value: "" })));
    setImages(d?.images ?? []);
    setLoaded(true);
  }, [isEdit, loaded, chain, listing, listingLoading]);

  const previews = useMemo(() => newFiles.map((f) => URL.createObjectURL(f)), [newFiles]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  if (isEdit && (chainLoading || listingLoading || !loaded)) {
    if (!chainLoading && !chain) return <EmptyState icon="🔍" title="ไม่พบสินค้านี้" />;
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isEdit && chain && chain.seller.toLowerCase() !== wallet) {
    return <EmptyState icon="⛔" title="คุณไม่ใช่เจ้าของสินค้านี้" />;
  }

  const titleBytes = new TextEncoder().encode(title).length;
  const totalImages = images.length + newFiles.length;

  const onCategory = (c: number) => {
    setCategory(c);
    if (specs.every((s) => !s.value.trim())) setSpecs(SPEC_TEMPLATES[c].map((key) => ({ key, value: "" })));
  };

  const addFiles = (list: FileList | null) => {
    const files = [...(list ?? [])];
    const ok = files.filter((f) => IMAGE_TYPES.includes(f.type) && f.size <= MAX_IMAGE_BYTES);
    if (ok.length < files.length) toast.error("บางไฟล์ถูกข้าม", "รองรับเฉพาะ JPG/PNG/WEBP ขนาดไม่เกิน 2 MB");
    setNewFiles((prev) => [...prev, ...ok].slice(0, MAX_IMAGES - images.length));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    let priceWei: bigint;
    try {
      priceWei = parseEther(price.trim());
    } catch {
      toast.error("ราคาไม่ถูกต้อง", "ใส่เป็นตัวเลข ETH เช่น 0.005");
      return;
    }
    const stockNum = Number(stock);
    if (priceWei <= 0n || !Number.isInteger(stockNum) || stockNum < (isEdit ? 0 : 1)) {
      toast.error("ข้อมูลไม่ถูกต้อง", "ราคาต้องมากกว่า 0 และสต็อกต้องเป็นจำนวนเต็ม");
      return;
    }

    // 1) อัปโหลดรูปใหม่ → path ใน bucket product-images/{wallet}/...
    setPhase("uploading");
    const uploaded: string[] = [];
    for (const f of newFiles) {
      const ext = f.type.split("/")[1] === "jpeg" ? "jpg" : f.type.split("/")[1];
      const path = `${wallet}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(path, f, { contentType: f.type });
      if (error) {
        toast.error("อัปโหลดรูปไม่สำเร็จ", error.message);
        setPhase("idle");
        return;
      }
      uploaded.push(path);
    }
    const allImages = [...images, ...uploaded];
    const specObj = Object.fromEntries(specs.filter((s) => s.key.trim() && s.value.trim()).map((s) => [s.key.trim(), s.value.trim()]));
    const details = { description: description.trim(), specs: specObj, images: allImages };
    const hash = detailsHash(details);

    // 2) ธุรกรรมบน chain
    let id = productId;
    if (!isEdit) {
      setPhase("tx");
      const receipt = await send("ลงขายสินค้า", {
        functionName: "listProduct",
        args: [title.trim(), category, condition, priceWei, stockNum, hash],
      });
      if (!receipt) {
        setPhase("idle");
        return;
      }
      id = Number(parseEventLogs({ abi: marketplace.abi, eventName: "ProductListed", logs: receipt.logs })[0].args.productId);
    } else if (chain && (chain.price !== priceWei || Number(chain.stock) !== stockNum || chain.detailsHash !== hash)) {
      setPhase("tx");
      const receipt = await send(`แก้ไขสินค้า #${id}`, {
        functionName: "updateProduct",
        args: [BigInt(id!), priceWei, stockNum, hash],
      });
      if (!receipt) {
        setPhase("idle");
        return;
      }
    }

    // 3) รอ Supabase sync สินค้า (RLS ต้องเห็นว่าเราเป็นผู้ขาย) แล้วบันทึกรายละเอียด
    setPhase("syncing");
    const synced = await waitForSynced(async () => {
      const { data } = await supabase.from("products").select("seller").eq("id", id!).maybeSingle();
      return data?.seller === wallet;
    });
    const { error } = synced
      ? await supabase.from("product_details").upsert({ product_id: id!, ...details })
      : { error: { message: "สินค้ายัง sync ไม่เสร็จ" } };
    setPhase("idle");
    if (error) {
      toast.error("บันทึกรายละเอียดไม่สำเร็จ", `${error.message} — เปิดหน้าแก้ไขแล้วกดบันทึกอีกครั้งได้`);
      navigate("/seller?tab=products");
      return;
    }
    toast.success(isEdit ? "บันทึกการแก้ไขแล้ว" : "ลงขายสินค้าแล้ว", `สินค้า #${id}`);
    navigate(`/product/${id}`);
  };

  const busy = phase !== "idle";
  const input = "w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-mint-500 disabled:bg-slate-100 disabled:text-slate-500";

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link to="/seller?tab=products" className="text-sm text-sky-700 hover:underline">
          ← ศูนย์ผู้ขาย
        </Link>
        <h1 className="mt-1 text-2xl font-bold">{isEdit ? `แก้ไขสินค้า #${productId}` : "ลงขายสินค้า"}</h1>
      </div>

      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="font-semibold">ข้อมูลบน Blockchain</h2>
        <label className="block text-sm">
          ชื่อสินค้า
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isEdit}
            placeholder="เช่น NVIDIA RTX 4070 Super 12GB"
            className={`mt-1 ${input}`}
          />
          <span className={`text-xs ${titleBytes > 100 ? "text-rose-600" : "text-slate-500"}`}>{titleBytes}/100 bytes (ภาษาไทยใช้ 3 bytes ต่อตัว)</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            หมวดหมู่
            <select value={category} onChange={(e) => onCategory(Number(e.target.value))} disabled={isEdit} className={`mt-1 ${input}`}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="text-sm">
            <legend>สภาพ</legend>
            <div className="mt-2 flex gap-4">
              {CONDITIONS.map((c) => (
                <label key={c.id} className="flex items-center gap-2">
                  <input type="radio" className="accent-mint-600" checked={condition === c.id} onChange={() => setCondition(c.id)} disabled={isEdit} />
                  {c.label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-sm">
            ราคาต่อชิ้น (ETH)
            <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.005" className={`mt-1 ${input}`} />
          </label>
          <label className="block text-sm">
            จำนวนสต็อก
            <input required type="number" min={isEdit ? 0 : 1} step={1} value={stock} onChange={(e) => setStock(e.target.value)} className={`mt-1 ${input}`} />
          </label>
        </div>
        {isEdit && <p className="text-xs text-slate-500">ชื่อ หมวดหมู่ และสภาพ แก้ไขไม่ได้หลังลงขาย (บันทึกถาวรบน Blockchain) — แก้ได้เฉพาะราคา สต็อก และรายละเอียด</p>}
      </section>

      <section className="space-y-4 rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div>
          <h2 className="font-semibold">รายละเอียด (เก็บใน Supabase · บน chain เก็บ hash)</h2>
          <p className="text-xs text-slate-500">ถ้ามีใครแก้ข้อมูลส่วนนี้ใน database หน้าเว็บจะตรวจเจอจาก hash ที่ไม่ตรงกัน</p>
        </div>

        <div>
          <p className="mb-2 text-sm">
            รูปสินค้า ({totalImages}/{MAX_IMAGES}) · JPG/PNG/WEBP ≤ 2 MB
          </p>
          <div className="flex flex-wrap gap-3">
            {images.map((p) => (
              <Thumb key={p} src={productImageUrl(p)} onRemove={() => setImages(images.filter((x) => x !== p))} />
            ))}
            {previews.map((u, i) => (
              <Thumb key={u} src={u} onRemove={() => setNewFiles(newFiles.filter((_, j) => j !== i))} isNew />
            ))}
            {totalImages < MAX_IMAGES && (
              <label className="grid h-24 w-24 cursor-pointer place-items-center rounded-lg border-2 border-dashed border-slate-300 text-3xl text-slate-400 hover:border-mint-500 hover:text-mint-500">
                +
                <input type="file" accept={IMAGE_TYPES.join(",")} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </label>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm">สเปก</p>
          <div className="space-y-2">
            {specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={s.key}
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))}
                  placeholder="หัวข้อ"
                  className="w-2/5 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-mint-500"
                />
                <input
                  value={s.value}
                  onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                  placeholder="รายละเอียด"
                  className="flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm outline-none focus:border-mint-500"
                />
                <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="px-2 text-slate-400 hover:text-rose-600" aria-label="ลบแถว">
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => setSpecs([...specs, { key: "", value: "" }])} className="mt-2 text-sm text-sky-700 hover:underline">
            + เพิ่มสเปก
          </button>
        </div>

        <label className="block text-sm">
          คำอธิบาย
          <textarea
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="สภาพสินค้า ประวัติการใช้งาน ประกัน ของแถม ฯลฯ"
            className="mt-1 h-32 w-full rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-mint-500"
          />
        </label>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy || titleBytes === 0 || titleBytes > 100}
          className="inline-flex items-center gap-2 rounded-full bg-mint-500 px-6 py-2.5 font-semibold text-white hover:bg-mint-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy && <Spinner className="h-4 w-4" />}
          {phase === "uploading"
            ? "กำลังอัปโหลดรูป…"
            : phase === "tx"
              ? "รอยืนยันใน MetaMask…"
              : phase === "syncing"
                ? "กำลังบันทึกรายละเอียด…"
                : isEdit
                  ? "🦊 บันทึกการแก้ไข"
                  : "🦊 ลงขายด้วย MetaMask"}
        </button>
        {phase === "syncing" && <span className="text-sm text-slate-500">รอ Supabase sync จาก Blockchain (~15–30 วินาที)</span>}
      </div>
    </form>
  );
}

function Thumb({ src, onRemove, isNew }: { src: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div className="relative h-24 w-24 overflow-hidden rounded-lg ring-1 ring-slate-200">
      <img src={src} alt="" className="h-full w-full object-cover" />
      {isNew && <span className="absolute bottom-1 left-1 rounded bg-mint-500 px-1 text-[10px] text-white">ใหม่</span>}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-xs text-white hover:bg-rose-600"
        aria-label="ลบรูป"
      >
        ✕
      </button>
    </div>
  );
}
