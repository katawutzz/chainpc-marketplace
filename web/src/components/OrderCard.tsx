import { useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { formatRemaining, useNow } from "../hooks/useNow";
import type { OrderWithRelations } from "../hooks/useOrders";
import { explorer } from "../lib/chain";
import { formatEth, formatThaiDate, ORDER_STATUS, shortAddress } from "../lib/format";
import { textHash } from "../lib/hash";
import { attachShipping } from "../lib/shipping";
import { supabase } from "../lib/supabase";
import { toast, useMarketplaceTx } from "../lib/tx";
import { AddressPicker, type AddressRow } from "./AddressBook";
import { EthAmount, ProductImage, Spinner } from "./ui";

const toneClass = {
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  warn: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-rose-50 text-rose-700 ring-rose-200",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  muted: "bg-slate-100 text-slate-600 ring-slate-200",
};

const STEPS = ["ชำระเงิน", "จัดส่ง", "สำเร็จ"];

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
  const status = ORDER_STATUS[order.status];
  const product = order.products;
  const shipDeadline = Date.parse(order.ship_deadline);
  const confirmDeadline = order.confirm_deadline ? Date.parse(order.confirm_deadline) : null;
  const fee = (BigInt(order.total_wei) * BigInt(order.fee_bps)) / 10000n;
  const stepIndex = order.status === 1 ? 0 : order.status === 2 || order.status === 3 ? 1 : 2;

  return (
    <article
      id={`order-${order.id}`}
      className={`rounded-xl bg-white shadow-sm ring-1 ${highlight ? "ring-2 ring-mint-500" : "ring-slate-200"}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5 text-sm">
        <span className="text-slate-500">
          คำสั่งซื้อ <b className="text-slate-800">#{order.id}</b> · {formatThaiDate(order.paid_at)}
        </span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${toneClass[status.tone]}`}>{status.label}</span>
      </header>

      <div className="flex flex-col gap-4 p-4 sm:flex-row">
        <Link to={`/product/${order.product_id}`} className="shrink-0">
          <ProductImage
            images={product?.product_details?.images}
            category={product?.category ?? 0}
            className="h-24 w-24 rounded-lg"
            iconClass="text-4xl"
          />
        </Link>

        <div className="min-w-0 flex-1 space-y-2">
          <Link to={`/product/${order.product_id}`} className="line-clamp-2 font-medium hover:text-sky-700">
            {product?.title ?? `สินค้า #${order.product_id}`}
          </Link>
          <p className="text-sm text-slate-600">
            {order.quantity} ชิ้น × {formatEth(order.unit_price_wei)} ETH ·{" "}
            {role === "buyer" ? (
              <>
                ผู้ขาย{" "}
                <Link to={`/shop/${order.seller}`} className="font-mono text-sky-700 hover:underline">
                  {shortAddress(order.seller)}
                </Link>
              </>
            ) : (
              <>
                ผู้ซื้อ{" "}
                <a href={explorer.address(order.buyer)} target="_blank" rel="noreferrer" className="font-mono text-sky-700 hover:underline">
                  {shortAddress(order.buyer)}
                </a>
              </>
            )}
          </p>

          {order.status !== 5 && (
            <ol className="flex items-center gap-2 text-xs">
              {STEPS.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold ${i <= stepIndex ? "bg-mint-500 text-white" : "bg-slate-200 text-slate-500"}`}
                  >
                    {i < stepIndex || order.status === 4 ? "✓" : i + 1}
                  </span>
                  <span className={i <= stepIndex ? "text-slate-800" : "text-slate-400"}>{s}</span>
                  {i < STEPS.length - 1 && <span className="h-px w-6 bg-slate-300" />}
                </li>
              ))}
            </ol>
          )}

          {order.tracking_no && (
            <p className="text-sm">
              📦 เลขพัสดุ: <span className="font-mono font-semibold">{order.tracking_no}</span>
            </p>
          )}
          {order.status === 1 && (
            <Deadline label="ผู้ขายต้องจัดส่งภายใน" remaining={shipDeadline - now} />
          )}
          {order.status === 2 && confirmDeadline &&
            (confirmDeadline - now > 0 ? (
              <Deadline
                label={role === "buyer" ? "กดยืนยันรับของ หรือแจ้งปัญหาได้ภายใน" : "ผู้ซื้อต้องยืนยันภายใน"}
                remaining={confirmDeadline - now}
              />
            ) : (
              <p className="text-sm text-amber-700">
                ⏱️{" "}
                {role === "buyer"
                  ? "หมดเวลาแจ้งปัญหาแล้ว — ยังกด \"ได้รับของแล้ว\" ได้ แต่ผู้ขายก็กดรับเงินเองได้เช่นกัน"
                  : "ผู้ซื้อไม่ยืนยันภายในกำหนด — คุณกดรับเงินได้แล้ว"}
              </p>
            ))}
          {order.status === 3 && order.dispute_details && (
            <p className="rounded-lg bg-rose-50 p-2 text-sm text-rose-800">🚩 ปัญหาที่ผู้ซื้อแจ้ง: {order.dispute_details.reason}</p>
          )}
          {order.resolution_note !== null && order.resolution_refund !== null && (
            <p className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
              🛡️ Admin ตัดสิน: {order.resolution_refund ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย"}
              {order.resolution_note && ` — ${order.resolution_note}`}
            </p>
          )}

          {role === "seller" && <ShippingInfo order={order} />}
        </div>

        <div className="shrink-0 text-right sm:w-40">
          <EthAmount value={formatEth(order.total_wei)} className="text-lg font-bold" />
          {role === "seller" && order.status === 4 && (
            <p className="text-xs text-slate-500">
              ได้รับ {formatEth(BigInt(order.total_wei) - fee)} (ค่าธรรมเนียม {order.fee_bps / 100}%)
            </p>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-100 px-4 py-3">
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
    <p className={`text-sm ${remaining <= 0 ? "font-semibold text-rose-600" : "text-slate-600"}`}>
      ⏱️ {label}: <b>{formatRemaining(remaining)}</b>
    </p>
  );
}

function ShippingInfo({ order }: { order: OrderWithRelations }) {
  if (!order.order_shipping) {
    return order.status === 1 ? (
      <p className="text-sm text-amber-700">⚠️ ผู้ซื้อยังไม่ได้ระบุที่อยู่จัดส่ง</p>
    ) : null;
  }
  const s = order.order_shipping;
  return (
    <div className="rounded-lg bg-slate-50 p-2 text-sm">
      <p className="font-semibold">🏠 ส่งถึง: {s.recipient_name} · {s.phone}</p>
      <p className="text-slate-600">{s.address}</p>
    </div>
  );
}

type ActionProps = { order: OrderWithRelations; now: number; shipDeadline: number; confirmDeadline: number | null };

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "danger";
}) {
  const cls = {
    primary: "bg-mint-500 text-white hover:bg-mint-600",
    secondary: "bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50",
    danger: "bg-white text-rose-700 ring-1 ring-rose-300 hover:bg-rose-50",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${cls}`}
    >
      {children}
    </button>
  );
}

// ─────────────────────────── ผู้ซื้อ ───────────────────────────

function BuyerActions({ order, now, shipDeadline, confirmDeadline }: ActionProps) {
  const { send, pending } = useMarketplaceTx();
  const [panel, setPanel] = useState<"none" | "dispute" | "review" | "address">("none");
  const id = BigInt(order.id);

  if (order.status === 1) {
    const canRefund = now > shipDeadline;
    return (
      <div className="flex flex-wrap items-center gap-2">
        {canRefund ? (
          <Btn variant="danger" disabled={pending} onClick={() => void send(`ขอคืนเงิน #${order.id}`, { functionName: "requestRefund", args: [id] })}>
            {pending && <Spinner className="h-3.5 w-3.5" />}↩️ ขอคืนเงิน (ผู้ขายไม่จัดส่งตามกำหนด)
          </Btn>
        ) : (
          <span className="text-sm text-slate-500">รอผู้ขายจัดส่ง — ถ้าไม่ส่งตามกำหนด คุณจะขอเงินคืนได้</span>
        )}
        {!order.order_shipping && (
          <>
            <Btn variant="secondary" onClick={() => setPanel(panel === "address" ? "none" : "address")}>
              🏠 ระบุที่อยู่จัดส่ง
            </Btn>
            {panel === "address" && <AttachAddress orderId={order.id} onDone={() => setPanel("none")} />}
          </>
        )}
      </div>
    );
  }

  if (order.status === 2) {
    const canDispute = confirmDeadline !== null && now <= confirmDeadline;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Btn disabled={pending} onClick={() => void send(`ยืนยันรับของ #${order.id}`, { functionName: "confirmReceived", args: [id] })}>
            {pending && <Spinner className="h-3.5 w-3.5" />}✅ ได้รับของแล้ว
          </Btn>
          {canDispute && (
            <Btn variant="danger" onClick={() => setPanel(panel === "dispute" ? "none" : "dispute")}>
              🚩 แจ้งปัญหา (ของไม่ตรงปก / เสีย)
            </Btn>
          )}
        </div>
        <p className="text-xs text-slate-500">กด "ได้รับของแล้ว" เมื่อตรวจของเรียบร้อย เงินจะถูกปลดให้ผู้ขายทันที</p>
        {panel === "dispute" && <DisputeForm order={order} onDone={() => setPanel("none")} />}
      </div>
    );
  }

  if (order.status === 3) return <p className="text-sm text-slate-600">⚖️ รอ Admin ตรวจสอบหลักฐานและตัดสิน</p>;

  if (order.status === 4) {
    if (order.reviews) {
      return (
        <p className="text-sm text-slate-600">
          ⭐ คุณให้ {order.reviews.rating} ดาว{order.reviews.comment ? `: “${order.reviews.comment}”` : ""}
        </p>
      );
    }
    return panel === "review" ? (
      <ReviewForm order={order} onDone={() => setPanel("none")} />
    ) : (
      <Btn variant="secondary" onClick={() => setPanel("review")}>
        ⭐ รีวิวผู้ขาย
      </Btn>
    );
  }

  return <p className="text-sm text-slate-600">💸 คืนเงินเข้ายอดที่ถอนได้แล้ว — กด "ถอนเข้า MetaMask" ด้านบน</p>;
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
  return (
    <div className="w-full rounded-lg bg-slate-50 p-3">
      {saving ? <Spinner /> : <AddressPicker selectedId={null} onSelect={choose} />}
    </div>
  );
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
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-rose-50 p-3">
      <textarea
        required
        maxLength={2000}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="อธิบายปัญหา เช่น ได้รับของไม่ตรงปก / ของเสีย / ไม่ได้รับของ"
        className="h-24 w-full rounded-md border border-rose-200 p-2 text-sm outline-none focus:border-rose-400"
      />
      <label className="block text-sm">
        รูปหลักฐาน (ไม่เกิน 5 รูป, รูปละ ≤ 5 MB)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setFiles([...(e.target.files ?? [])].filter((f) => f.size <= 5 * 1024 * 1024).slice(0, 5))}
          className="mt-1 block text-xs"
        />
      </label>
      <p className="text-xs text-rose-800">เหตุผลจะถูกบันทึกเป็น hash บน Blockchain เพื่อยืนยันว่าไม่ถูกแก้ไขภายหลัง</p>
      <Btn variant="danger" disabled={pending || !reason.trim()}>
        {pending && <Spinner className="h-3.5 w-3.5" />}ส่งเรื่องให้ Admin
      </Btn>
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
    const { error } = await supabase
      .from("reviews")
      .insert({ order_id: order.id, seller: order.seller, rating, comment: comment.trim() || null });
    setSaving(false);
    if (error) {
      toast.error("ส่งรีวิวไม่สำเร็จ", error.code === "23505" ? "คุณรีวิวคำสั่งซื้อนี้ไปแล้ว" : error.message);
      return;
    }
    toast.success("ขอบคุณสำหรับรีวิว");
    await qc.invalidateQueries();
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-2 rounded-lg bg-amber-50 p-3">
      <div className="flex items-center gap-1 text-2xl" role="radiogroup" aria-label="คะแนน">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            onClick={() => setRating(n)}
            className={n <= rating ? "text-amber-500" : "text-slate-300"}
            aria-label={`${n} ดาว`}
            aria-checked={n === rating}
            role="radio"
          >
            ★
          </button>
        ))}
        <span className="ml-2 text-sm text-slate-600">{rating}/5</span>
      </div>
      <textarea
        maxLength={1000}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="เขียนรีวิว (ไม่บังคับ)"
        className="h-20 w-full rounded-md border border-amber-200 p-2 text-sm outline-none focus:border-amber-400"
      />
      <p className="text-xs text-amber-900">รีวิวได้ครั้งเดียวต่อคำสั่งซื้อ และแก้ไขภายหลังไม่ได้</p>
      <Btn disabled={saving}>{saving && <Spinner className="h-3.5 w-3.5" />}ส่งรีวิว</Btn>
    </form>
  );
}

// ─────────────────────────── ผู้ขาย ───────────────────────────

function SellerActions({ order, now, shipDeadline, confirmDeadline }: ActionProps) {
  const { send, pending } = useMarketplaceTx();
  const [tracking, setTracking] = useState("");
  const id = BigInt(order.id);

  if (order.status === 1) {
    if (now > shipDeadline) {
      return <p className="text-sm text-rose-600">เลยกำหนดจัดส่งแล้ว — ผู้ซื้อขอเงินคืนได้</p>;
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={tracking}
          onChange={(e) => setTracking(e.target.value)}
          maxLength={64}
          placeholder="เลขพัสดุ เช่น TH1234567890"
          className="min-w-0 flex-1 rounded-full border border-slate-300 px-4 py-1.5 text-sm outline-none focus:border-mint-500 sm:max-w-xs"
        />
        <Btn
          disabled={pending || !tracking.trim()}
          onClick={() => void send(`แจ้งจัดส่ง #${order.id}`, { functionName: "markShipped", args: [id, tracking.trim()] })}
        >
          {pending && <Spinner className="h-3.5 w-3.5" />}🚚 แจ้งจัดส่ง
        </Btn>
        <Btn
          variant="danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`ยกเลิกคำสั่งซื้อ #${order.id} และคืนเงินผู้ซื้อเต็มจำนวน?`))
              void send(`ยกเลิกคำสั่งซื้อ #${order.id}`, { functionName: "cancelOrder", args: [id] });
          }}
        >
          ยกเลิก & คืนเงิน
        </Btn>
      </div>
    );
  }

  if (order.status === 2) {
    const canClaim = confirmDeadline !== null && now > confirmDeadline;
    return canClaim ? (
      <Btn disabled={pending} onClick={() => void send(`รับเงิน #${order.id}`, { functionName: "claimPayment", args: [id] })}>
        {pending && <Spinner className="h-3.5 w-3.5" />}💰 รับเงิน (ผู้ซื้อไม่ยืนยันตามกำหนด)
      </Btn>
    ) : (
      <p className="text-sm text-slate-500">รอผู้ซื้อยืนยันรับของ — ถ้าเลยกำหนด คุณจะกดรับเงินเองได้</p>
    );
  }

  if (order.status === 3) return <p className="text-sm text-slate-600">🚩 ผู้ซื้อแจ้งปัญหา — รอ Admin ตรวจสอบและตัดสิน (เงินยังล็อกอยู่)</p>;
  if (order.status === 4) return <p className="text-sm text-emerald-700">✓ ขายสำเร็จ — เงินเข้ายอดที่ถอนได้แล้ว</p>;
  return <p className="text-sm text-slate-500">คืนเงินผู้ซื้อแล้ว · สต็อกถูกคืนเข้าสินค้า</p>;
}
