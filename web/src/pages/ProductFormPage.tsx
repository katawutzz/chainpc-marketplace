import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { formatEther, parseEther, parseEventLogs } from "viem";
import { useAccount } from "wagmi";
import { Ban, ImagePlus, Info, PackageSearch, Plus, Trash2, X } from "lucide-react";
import { RequireWallet } from "../components/RequireWallet";
import { SellerLayout } from "../components/SellerLayout";
import { Button, EmptyState, PageLoader } from "../components/ui";
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
      <SellerLayout>
        <ProductForm key={id ?? "new"} productId={id ? Number(id) : null} />
      </SellerLayout>
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
    if (!chainLoading && !chain) return <EmptyState icon={PackageSearch} title="ไม่พบสินค้านี้" />;
    return <PageLoader />;
  }
  if (isEdit && chain && chain.seller.toLowerCase() !== wallet) {
    return <EmptyState icon={Ban} title="คุณไม่ใช่เจ้าของสินค้านี้" />;
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

  return (
    <form onSubmit={submit} className="space-y-3">
      <section className="card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h1 className="text-lg">{isEdit ? `แก้ไขสินค้า #${productId}` : "เพิ่มสินค้าใหม่"}</h1>
          <p className="text-sm text-slate-500">ข้อมูลส่วนนี้บันทึกบน Blockchain</p>
        </div>
        <div className="space-y-5 px-6 py-6">
          <FormRow label="ชื่อสินค้า" required>
            <input required value={title} onChange={(e) => setTitle(e.target.value)} disabled={isEdit} placeholder="เช่น NVIDIA RTX 4070 Super 12GB" className="input" />
            <span className={`mt-1 block text-right text-xs ${titleBytes > 100 ? "text-rose-600" : "text-slate-400"}`}>{titleBytes}/100 bytes (ภาษาไทยใช้ 3 bytes ต่อตัว)</span>
          </FormRow>
          <FormRow label="หมวดหมู่" required>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {CATEGORIES.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  disabled={isEdit && category !== c.id}
                  onClick={() => !isEdit && onCategory(c.id)}
                  className={`flex flex-col items-center gap-1 rounded-sm border px-2 py-3 text-xs ${category === c.id ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-200 text-slate-600 hover:border-slate-400"} disabled:opacity-40`}
                >
                  <c.icon className="h-5 w-5" />
                  {c.label}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="สภาพสินค้า" required>
            <div className="flex gap-2">
              {CONDITIONS.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  disabled={isEdit && condition !== c.id}
                  onClick={() => !isEdit && setCondition(c.id)}
                  className={`h-9 rounded-sm border px-5 text-sm ${condition === c.id ? "border-brand-500 bg-brand-50 text-brand-600" : "border-slate-300 text-slate-700"} disabled:opacity-40`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label="ราคาต่อชิ้น" required>
            <div className="flex max-w-xs">
              <input required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.005" className="input rounded-r-none" />
              <span className="grid place-items-center rounded-r-sm border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500">ETH</span>
            </div>
          </FormRow>
          <FormRow label="คลังสินค้า" required>
            <input required type="number" min={isEdit ? 0 : 1} step={1} value={stock} onChange={(e) => setStock(e.target.value)} className="input max-w-xs" />
          </FormRow>
          {isEdit && (
            <p className="flex items-center gap-1.5 rounded-sm bg-slate-50 px-3 py-2 text-xs text-slate-500">
              <Info className="h-3.5 w-3.5 shrink-0" /> ชื่อ หมวดหมู่ และสภาพ แก้ไขไม่ได้หลังลงขาย (บันทึกถาวรบน Blockchain) — แก้ได้เฉพาะราคา คลัง และรายละเอียด
            </p>
          )}
        </div>
      </section>

      <section className="card">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-lg">รายละเอียดสินค้า</h2>
          <p className="text-sm text-slate-500">เก็บใน Supabase และบันทึก hash ไว้บน Blockchain เพื่อตรวจว่าไม่ถูกแก้ไข</p>
        </div>
        <div className="space-y-6 px-6 py-6">
          <FormRow label="รูปสินค้า">
            <div className="flex flex-wrap gap-3">
              {images.map((p) => (
                <Thumb key={p} src={productImageUrl(p)} onRemove={() => setImages(images.filter((x) => x !== p))} />
              ))}
              {previews.map((u, i) => (
                <Thumb key={u} src={u} onRemove={() => setNewFiles(newFiles.filter((_, j) => j !== i))} isNew />
              ))}
              {totalImages < MAX_IMAGES && (
                <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed border-brand-400 bg-brand-50/40 text-xs text-brand-600 hover:bg-brand-50">
                  <ImagePlus className="h-6 w-6" />
                  เพิ่มรูป ({totalImages}/{MAX_IMAGES})
                  <input type="file" accept={IMAGE_TYPES.join(",")} multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                </label>
              )}
            </div>
            <p className="mt-2 text-xs text-slate-400">JPG / PNG / WEBP ขนาดไม่เกิน 2 MB · รูปแรกจะเป็นรูปปก</p>
          </FormRow>

          <FormRow label="ข้อมูลจำเพาะ">
            <div className="space-y-2">
              {specs.map((s, i) => (
                <div key={i} className="flex gap-2">
                  <input value={s.key} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))} placeholder="หัวข้อ" className="input w-2/5" />
                  <input value={s.value} onChange={(e) => setSpecs(specs.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} placeholder="รายละเอียด" className="input flex-1" />
                  <button type="button" onClick={() => setSpecs(specs.filter((_, j) => j !== i))} className="px-2 text-slate-400 hover:text-rose-600" aria-label="ลบแถว">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <Button type="button" variant="secondary" size="sm" icon={Plus} className="mt-2" onClick={() => setSpecs([...specs, { key: "", value: "" }])}>
              เพิ่มข้อมูลจำเพาะ
            </Button>
          </FormRow>

          <FormRow label="คำอธิบายสินค้า">
            <textarea
              maxLength={5000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="สภาพสินค้า ประวัติการใช้งาน ประกัน ของแถม ฯลฯ"
              className="input h-40"
            />
            <span className="mt-1 block text-right text-xs text-slate-400">{description.length}/5000</span>
          </FormRow>
        </div>
      </section>

      <div className="card sticky bottom-0 flex flex-wrap items-center justify-end gap-3 px-6 py-4">
        {phase === "syncing" && <span className="mr-auto text-sm text-slate-500">รอ Supabase sync จาก Blockchain (~15–30 วินาที)</span>}
        <Link to="/seller?tab=products" className="inline-flex h-10 items-center rounded-sm border border-slate-300 px-5 text-sm hover:bg-slate-50">
          ยกเลิก
        </Link>
        <Button size="md" className="min-w-48" loading={busy} disabled={titleBytes === 0 || titleBytes > 100}>
          {phase === "uploading"
            ? "กำลังอัปโหลดรูป…"
            : phase === "tx"
              ? "รอยืนยันใน MetaMask…"
              : phase === "syncing"
                ? "กำลังบันทึกรายละเอียด…"
                : isEdit
                  ? "บันทึกและยืนยันใน MetaMask"
                  : "ลงขายและยืนยันใน MetaMask"}
        </Button>
      </div>
    </form>
  );
}

function FormRow({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
      <span className="text-sm text-slate-600 sm:w-32 sm:shrink-0 sm:pt-2 sm:text-right">
        {required && <span className="text-rose-500">* </span>}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Thumb({ src, onRemove, isNew }: { src: string; onRemove: () => void; isNew?: boolean }) {
  return (
    <div className="group relative h-24 w-24 overflow-hidden rounded-sm border border-slate-200">
      <img src={src} alt="" className="h-full w-full object-cover" />
      {isNew && <span className="absolute bottom-0 left-0 bg-brand-500 px-1 text-[10px] text-white">ใหม่</span>}
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-black/60 text-white hover:bg-rose-600"
        aria-label="ลบรูป"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
