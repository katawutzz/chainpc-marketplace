import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, ExternalLink, Flag, MapPin, Scale, Star, Store, Truck } from "lucide-react";
import { formatRemaining, useNow } from "../hooks/useNow";
import type { OrderWithRelations } from "../hooks/useOrders";
import { explorer } from "../lib/chain";
import { formatEth, formatThaiDate, ORDER_STATUS, shortAddress } from "../lib/format";
import { textHash } from "../lib/hash";
import { attachShipping } from "../lib/shipping";
import { supabase } from "../lib/supabase";
import { toast, useMarketplaceTx } from "../lib/tx";
import { AddressPicker, type AddressRow } from "./AddressBook";
import { Button, Price, ProductImage, Spinner } from "./ui";

const statusColor: Record<number, string> = {
  1: "text-sky-600",
  2: "text-amber-600",
  3: "text-rose-600",
  4: "text-brand-500",
  5: "text-slate-500",
};

const STEPS = ["ชำระเงินแล้ว", "จัดส่งแล้ว", "ได้รับสินค้า"];

export function OrderCard({
  order,
  role,
  highlight = false,
}: {
  order: OrderWithRelations;
  role: "buyer" | "seller";
  highlight?: boolean;
}) {
  const now = useNow();
  const product = order.products;
  const shipDeadline = Date.parse(order.ship_deadline);
  const confirmDeadline = order.confirm_deadline ? Date.parse(order.confirm_deadline) : null;
  const fee = (BigInt(order.total_wei) * BigInt(order.fee_bps)) / 10000n;
  const stepIndex = order.status === 1 ? 0 : order.status === 2 || order.status === 3 ? 1 : 2;

  return (
    <article id={`order-${order.id}`} className={`card ${highlight ? "ring-2 ring-brand-500" : ""}`}>
      {/* ── หัว: ร้าน / คู่ค้า + สถานะ ── */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-sm">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4" />
          {role === "buyer" ? (
            <>
              <span className="font-medium">ร้าน <span className="font-mono">{shortAddress(order.seller)}</span></span>
              <Link to={`/shop/${order.seller}`} className="ml-2 rounded-sm border border-slate-300 px-2 py-0.5 text-xs hover:bg-slate-50">
                ดูร้านค้า
              </Link>
            </>
          ) : (
            <span className="font-medium">
              ผู้ซื้อ{" "}
              <a href={explorer.address(order.buyer)} target="_blank" rel="noreferrer" className="font-mono hover:text-brand-600">
                {shortAddress(order.buyer)}
              </a>
            </span>
          )}
          <span className="text-slate-400">· #{order.id}</span>
        </div>
        <div className="flex items-center gap-3 divide-x divide-slate-200">
          {order.tracking_no && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Truck className="h-4 w-4" /> {order.tracking_no}
            </span>
          )}
          <span className={`pl-3 font-medium uppercase ${statusColor[order.status]}`}>{ORDER_STATUS[order.status].label}</span>
        </div>
      </header>

      {/* ── สินค้า ── */}
      <Link to={`/product/${order.product_id}`} className="flex gap-3 border-b border-slate-100 px-5 py-4 hover:bg-slate-50/60">
        <ProductImage images={product?.product_details?.images} category={product?.category ?? 0} className="h-20 w-20 shrink-0 border border-slate-100" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[15px]">{product?.title ?? `สินค้า #${order.product_id}`}</p>
          <p className="mt-1 text-sm text-slate-500">x{order.quantity}</p>
          <p className="text-xs text-slate-400">สั่งเมื่อ {formatThaiDate(order.paid_at)}</p>
        </div>
        <div className="shrink-0 self-center text-sm text-brand-500">{formatEth(order.unit_price_wei)} ETH</div>
      </Link>

      {/* ── สถานะ / เวลา / ข้อมูลเพิ่ม ── */}
      <div className="space-y-2 px-5 py-3 text-sm">
        {order.status !== 5 && (
          <ol className="flex flex-wrap items-center gap-2 text-xs">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-semibold ${i <= stepIndex ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                  {i + 1}
                </span>
                <span className={i <= stepIndex ? "text-slate-800" : "text-slate-400"}>{s}</span>
                {i < STEPS.length - 1 && <span className={`h-px w-8 ${i < stepIndex ? "bg-emerald-500" : "bg-slate-300"}`} />}
              </li>
            ))}
          </ol>
        )}
        {order.status === 1 && <Deadline label="ผู้ขายต้องจัดส่งภายใน" remaining={shipDeadline - now} />}
        {order.status === 2 &&
          confirmDeadline &&
          (confirmDeadline - now > 0 ? (
            <Deadline label={role === "buyer" ? "กดยืนยันรับของ หรือแจ้งปัญหาได้ภายใน" : "ผู้ซื้อต้องยืนยันภายใน"} remaining={confirmDeadline - now} />
          ) : (
            <p className="flex items-center gap-1.5 text-amber-700">
              <Clock className="h-4 w-4" />
              {role === "buyer"
                ? 'หมดเวลาแจ้งปัญหาแล้ว — ยังกด "ได้รับสินค้าแล้ว" ได้ แต่ผู้ขายก็กดรับเงินเองได้เช่นกัน'
                : "ผู้ซื้อไม่ยืนยันภายในกำหนด — คุณกดรับเงินได้แล้ว"}
            </p>
          ))}
        {order.status === 3 && order.dispute_details && (
          <p className="flex items-start gap-1.5 rounded-sm bg-rose-50 p-2 text-rose-800">
            <Flag className="mt-0.5 h-4 w-4 shrink-0" /> ปัญหาที่ผู้ซื้อแจ้ง: {order.dispute_details.reason}
          </p>
        )}
        {order.resolution_note !== null && order.resolution_refund !== null && (
          <p className="flex items-start gap-1.5 rounded-sm bg-slate-50 p-2 text-slate-700">
            <Scale className="mt-0.5 h-4 w-4 shrink-0" /> Admin ตัดสิน: {order.resolution_refund ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย"}
            {order.resolution_note && ` — ${order.resolution_note}`}
          </p>
        )}
        {role === "seller" && <ShippingInfo order={order} />}
      </div>

      {/* ── ยอดรวม + ปุ่ม ── */}
      <footer className="border-t border-dashed border-slate-200 bg-orange-50/30 px-5 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2 text-sm">
          <span className="text-slate-600">ยอดคำสั่งซื้อทั้งหมด:</span>
          <Price value={formatEth(order.total_wei)} size="lg" />
          {role === "seller" && order.status === 4 && (
            <span className="w-full text-right text-xs text-slate-500">
              ได้รับ {formatEth(BigInt(order.total_wei) - fee)} ETH (หักค่าธรรมเนียม {order.fee_bps / 100}%)
            </span>
          )}
        </div>
        {role === "buyer" ? (
          <BuyerActions order={order} now={now} shipDeadline={shipDeadline} confirmDeadline={confirmDeadline} />
        ) : (
          <SellerActions order={order} now={now} shipDeadline={shipDeadline} confirmDeadline={confirmDeadline} />
        )}
      </footer>
    </article>
  );
}

function Deadline({ label, remaining }: { label: string; remaining: number }) {
  return (
    <p className={`flex items-center gap-1.5 ${remaining <= 0 ? "font-medium text-rose-600" : "text-slate-600"}`}>
      <Clock className="h-4 w-4" /> {label}: <b>{formatRemaining(remaining)}</b>
    </p>
  );
}

function ShippingInfo({ order }: { order: OrderWithRelations }) {
  if (!order.order_shipping) {
    return order.status === 1 ? <p className="text-amber-700">ผู้ซื้อยังไม่ได้ระบุที่อยู่จัดส่ง</p> : null;
  }
  const s = order.order_shipping;
  return (
    <div className="flex items-start gap-2 rounded-sm bg-slate-50 p-3">
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
      <div>
        <p className="font-medium">
          {s.recipient_name} <span className="font-normal text-slate-500">| {s.phone}</span>
        </p>
        <p className="text-slate-600">{s.address}</p>
      </div>
    </div>
  );
}

type ActionProps = { order: OrderWithRelations; now: number; shipDeadline: number; confirmDeadline: number | null };

const Actions = ({ children, note }: { children: React.ReactNode; note?: string }) => (
  <div className="flex flex-wrap items-center justify-end gap-2">
    {note && <span className="mr-auto text-xs text-slate-500">{note}</span>}
    {children}
  </div>
);

// ─────────────────────────── ผู้ซื้อ ───────────────────────────

function BuyerActions({ order, now, shipDeadline, confirmDeadline }: ActionProps) {
  const { send, pending } = useMarketplaceTx();
  const [panel, setPanel] = useState<"none" | "dispute" | "review" | "address">("none");
  const id = BigInt(order.id);

  if (order.status === 1) {
    const canRefund = now > shipDeadline;
    return (
      <div className="space-y-3">
        <Actions note={canRefund ? undefined : "รอผู้ขายจัดส่ง — ถ้าไม่ส่งตามกำหนด คุณขอเงินคืนได้"}>
          {!order.order_shipping && (
            <Button variant="secondary" icon={MapPin} onClick={() => setPanel(panel === "address" ? "none" : "address")}>
              ระบุที่อยู่จัดส่ง
            </Button>
          )}
          {canRefund && (
            <Button loading={pending} onClick={() => void send(`ขอคืนเงิน #${order.id}`, { functionName: "requestRefund", args: [id] })}>
              ขอคืนเงิน
            </Button>
          )}
        </Actions>
        {panel === "address" && <AttachAddress orderId={order.id} onDone={() => setPanel("none")} />}
      </div>
    );
  }

  if (order.status === 2) {
    const canDispute = confirmDeadline !== null && now <= confirmDeadline;
    return (
      <div className="space-y-3">
        <Actions note='กด "ได้รับสินค้าแล้ว" เมื่อตรวจของเรียบร้อย เงินจะถูกปลดให้ผู้ขายทันที'>
          {canDispute && (
            <Button variant="secondary" icon={Flag} onClick={() => setPanel(panel === "dispute" ? "none" : "dispute")}>
              แจ้งปัญหา
            </Button>
          )}
          <Button loading={pending} className="min-w-40" onClick={() => void send(`ยืนยันรับสินค้า #${order.id}`, { functionName: "confirmReceived", args: [id] })}>
            ได้รับสินค้าแล้ว
          </Button>
        </Actions>
        {panel === "dispute" && <DisputeForm order={order} onDone={() => setPanel("none")} />}
      </div>
    );
  }

  if (order.status === 3) return <Actions note="รอ Admin ตรวจสอบหลักฐานและตัดสิน (เงินยังล็อกอยู่)">{null}</Actions>;

  if (order.status === 4) {
    if (order.reviews) {
      return (
        <Actions note={`คุณให้ ${order.reviews.rating} ดาว${order.reviews.comment ? `: “${order.reviews.comment}”` : ""}`}>
          <Link to={`/product/${order.product_id}`} className="inline-flex h-10 items-center rounded-sm bg-brand-500 px-5 text-sm text-white hover:bg-brand-600">
            ซื้ออีกครั้ง
          </Link>
        </Actions>
      );
    }
    return panel === "review" ? (
      <ReviewForm order={order} onDone={() => setPanel("none")} />
    ) : (
      <Actions>
        <Button icon={Star} onClick={() => setPanel("review")}>
          ให้คะแนน
        </Button>
        <Link to={`/product/${order.product_id}`} className="inline-flex h-10 items-center rounded-sm border border-slate-300 bg-white px-5 text-sm hover:bg-slate-50">
          ซื้ออีกครั้ง
        </Link>
      </Actions>
    );
  }

  return <Actions note='คืนเงินเข้ายอดที่ถอนได้แล้ว — กด "ถอนเข้า MetaMask" ด้านบน'>{null}</Actions>;
}

function AttachAddress({ orderId, onDone }: { orderId: number; onDone: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const choose = async (a: AddressRow) => {
    setSaving(true);
    const r = await attachShipping([orderId], a);
    setSaving(false);
    if (r.ok) {
      toast.success("บันทึกที่อยู่จัดส่งแล้ว");
      await qc.invalidateQueries({ queryKey: ["orders"] });
      onDone();
    } else toast.error("บันทึกที่อยู่ไม่สำเร็จ", r.message);
  };
  return <div className="rounded-sm bg-white p-3">{saving ? <Spinner /> : <AddressPicker selectedId={null} onSelect={choose} />}</div>;
}

function DisputeForm({ order, onDone }: { order: OrderWithRelations; onDone: () => void }) {
  const { send, pending } = useMarketplaceTx();
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const text = reason.trim();
    const receipt = await send(`แจ้งปัญหาคำสั่งซื้อ #${order.id}`, {
      functionName: "openDispute",
      args: [BigInt(order.id), textHash(text)],
    });
    if (!receipt) return;

    const evidence: string[] = [];
    for (const f of files.slice(0, 5)) {
      const path = `${order.id}/${crypto.randomUUID()}.${f.name.split(".").pop() ?? "jpg"}`;
      const { error } = await supabase.storage.from("dispute-evidence").upload(path, f, { contentType: f.type });
      if (error) toast.error("อัปโหลดหลักฐานไม่สำเร็จ", error.message);
      else evidence.push(path);
    }
    const { error } = await supabase.from("dispute_details").insert({ order_id: order.id, reason: text, evidence });
    if (error) toast.error("บันทึกรายละเอียดปัญหาไม่สำเร็จ", error.message);
    await qc.invalidateQueries({ queryKey: ["orders"] });
    onDone();
  };

  return (
    <form onSubmit={submit} className="animate-pop space-y-3 rounded-sm border border-slate-200 bg-white p-4">
      <p className="font-medium">แจ้งปัญหาเกี่ยวกับสินค้า</p>
      <textarea
        required
        maxLength={2000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="อธิบายปัญหา เช่น ได้รับของไม่ตรงปก / ของเสีย / ไม่ได้รับของ"
        className="input h-24"
      />
      <label className="block text-sm text-slate-600">
        รูปหลักฐาน (ไม่เกิน 5 รูป, รูปละ ≤ 5 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles([...(e.target.files ?? [])].filter((f) => f.size <= 5 * 1024 * 1024).slice(0, 5))}
          className="mt-1 block text-xs"
        />
      </label>
      <p className="text-xs text-slate-500">เหตุผลจะถูกบันทึกเป็น hash บน Blockchain เพื่อยืนยันว่าไม่ถูกแก้ไขภายหลัง</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button loading={pending} disabled={!reason.trim()}>
          ส่งเรื่องให้ Admin
        </Button>
      </div>
    </form>
  );
}

/** รีวิวเก็บใน Supabase (ไม่ต้องยืนยันใน MetaMask) — RLS อนุญาตเฉพาะผู้ซื้อของคำสั่งซื้อที่สำเร็จ 1 ครั้ง */
function ReviewForm({ order, onDone }: { order: OrderWithRelations; onDone: () => void }) {
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("reviews").insert({ order_id: order.id, seller: order.seller, rating, comment: comment.trim() || null });
    setSaving(false);
    if (error) {
      toast.error("ส่งรีวิวไม่สำเร็จ", error.code === "23505" ? "คุณรีวิวคำสั่งซื้อนี้ไปแล้ว" : error.message);
      return;
    }
    toast.success("ขอบคุณสำหรับรีวิว");
    await qc.invalidateQueries();
    onDone();
  };

  const labels = ["", "แย่มาก", "แย่", "พอใช้", "ดี", "ดีมาก"];
  return (
    <form onSubmit={submit} className="animate-pop space-y-3 rounded-sm border border-slate-200 bg-white p-4">
      <p className="font-medium">ให้คะแนนสินค้า</p>
      <div className="flex items-center gap-1" role="radiogroup" aria-label="คะแนน">
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} role="radio" aria-checked={n === rating} aria-label={`${n} ดาว`}>
            <Star className={`h-7 w-7 ${n <= rating ? "fill-amber-400 text-amber-400" : "fill-slate-200 text-slate-200"}`} />
          </button>
        ))}
        <span className="ml-2 text-sm text-amber-600">{labels[rating]}</span>
      </div>
      <textarea maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="แบ่งปันความคิดเห็นเกี่ยวกับสินค้าและร้านค้า (ไม่บังคับ)" className="input h-20" />
      <p className="text-xs text-slate-500">รีวิวได้ครั้งเดียวต่อคำสั่งซื้อ และแก้ไขภายหลังไม่ได้</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          ยกเลิก
        </Button>
        <Button loading={saving}>ส่งรีวิว</Button>
      </div>
    </form>
  );
}

// ─────────────────────────── ผู้ขาย ───────────────────────────

function SellerActions({ order, now, shipDeadline, confirmDeadline }: ActionProps) {
  const { send, pending } = useMarketplaceTx();
  const [tracking, setTracking] = useState("");
  const id = BigInt(order.id);

  if (order.status === 1) {
    if (now > shipDeadline) return <Actions note="เลยกำหนดจัดส่งแล้ว — ผู้ซื้อขอเงินคืนได้">{null}</Actions>;
    return (
      <div className="flex flex-wrap items-center justify-end gap-2">
        <input value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={64} placeholder="เลขพัสดุ เช่น TH1234567890" className="input h-10 max-w-xs flex-1" />
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() => {
            if (confirm(`ยกเลิกคำสั่งซื้อ #${order.id} และคืนเงินผู้ซื้อเต็มจำนวน?`)) void send(`ยกเลิกคำสั่งซื้อ #${order.id}`, { functionName: "cancelOrder", args: [id] });
          }}
        >
          ยกเลิกและคืนเงิน
        </Button>
        <Button icon={Truck} loading={pending} disabled={!tracking.trim()} onClick={() => void send(`แจ้งจัดส่ง #${order.id}`, { functionName: "markShipped", args: [id, tracking.trim()] })}>
          แจ้งจัดส่ง
        </Button>
      </div>
    );
  }

  if (order.status === 2) {
    const canClaim = confirmDeadline !== null && now > confirmDeadline;
    return canClaim ? (
      <Actions>
        <Button loading={pending} onClick={() => void send(`รับเงิน #${order.id}`, { functionName: "claimPayment", args: [id] })}>
          รับเงิน (ผู้ซื้อไม่ยืนยันตามกำหนด)
        </Button>
      </Actions>
    ) : (
      <Actions note="รอผู้ซื้อยืนยันรับสินค้า — ถ้าเลยกำหนด คุณจะกดรับเงินเองได้">{null}</Actions>
    );
  }

  if (order.status === 3) return <Actions note="ผู้ซื้อแจ้งปัญหา — รอ Admin ตรวจสอบและตัดสิน (เงินยังล็อกอยู่)">{null}</Actions>;
  if (order.status === 4) {
    return (
      <Actions note="ขายสำเร็จ — เงินเข้ายอดที่ถอนได้แล้ว">
        <a href={explorer.address(order.buyer)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-600">
          ผู้ซื้อบน Etherscan <ExternalLink className="h-3 w-3" />
        </a>
      </Actions>
    );
  }
  return <Actions note="คืนเงินผู้ซื้อแล้ว · สต็อกถูกคืนเข้าสินค้า">{null}</Actions>;
}
