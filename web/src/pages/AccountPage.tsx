import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CircleCheck,
  ExternalLink,
  Flag,
  MapPin,
  Package,
  RotateCcw,
  Scale,
  ShoppingBag,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { useAccount } from "wagmi";
import { AddressForm, formatAddress, useAddresses } from "../components/AddressBook";
import { RequireWallet } from "../components/RequireWallet";
import { UserLayout } from "../components/UserLayout";
import { Button, Spinner } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { explorer } from "../lib/chain";
import { formatEth, formatThaiDate } from "../lib/format";
import { supabase, type Tables } from "../lib/supabase";
import { toast } from "../lib/tx";

export function AccountPage() {
  return (
    <RequireWallet signIn title="บัญชีของฉัน">
      <UserLayout>
        <Account />
      </UserLayout>
    </RequireWallet>
  );
}

export function NotificationsPage() {
  return (
    <RequireWallet signIn title="การแจ้งเตือน">
      <UserLayout>
        <Notifications />
      </UserLayout>
    </RequireWallet>
  );
}

function Account() {
  const { address } = useAccount();
  const wallet = address!.toLowerCase();
  return (
    <div className="space-y-3">
      <ProfileForm wallet={wallet} />
      <WithdrawCard />
      <Addresses />
    </div>
  );
}

// ─────────────────────────── โปรไฟล์ ───────────────────────────

function ProfileForm({ wallet }: { wallet: string }) {
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["profile", wallet],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("address", wallet).maybeSingle()).data,
  });
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => setName(profile?.display_name ?? ""), [profile?.display_name]);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({ address: wallet, display_name: name.trim() || null });
    setSaving(false);
    if (error) toast.error("บันทึกไม่สำเร็จ", error.message);
    else {
      toast.success("บันทึกข้อมูลแล้ว");
      void qc.invalidateQueries();
    }
  };

  return (
    <form onSubmit={save} className="card">
      <div className="border-b border-slate-100 px-6 py-4">
        <h1 className="text-lg">ข้อมูลของฉัน</h1>
        <p className="text-sm text-slate-500">จัดการข้อมูลส่วนตัวของคุณ</p>
      </div>
      <div className="space-y-5 px-6 py-6 text-sm">
        <Field label="ที่อยู่กระเป๋า">
          <a href={explorer.address(wallet)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-mono hover:text-brand-600">
            {wallet} <ExternalLink className="h-3.5 w-3.5 shrink-0" />
          </a>
        </Field>
        <Field label="ชื่อที่แสดง">
          <input maxLength={50} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อที่แสดงให้คนอื่นเห็น" className="input max-w-md" />
        </Field>
        <Field label="ชื่อร้าน">
          <Link to="/seller?tab=shop" className="text-sky-700 hover:underline">
            ตั้งค่าในศูนย์ผู้ขาย
          </Link>
        </Field>
        <Field label="">
          <Button loading={saving} className="w-28">
            บันทึก
          </Button>
        </Field>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-6">
      <span className="text-slate-500 sm:w-32 sm:text-right">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// ─────────────────────────── สมุดที่อยู่ ───────────────────────────

function Addresses() {
  const qc = useQueryClient();
  const { data: addresses, isLoading } = useAddresses(true);
  const [adding, setAdding] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["addresses"] });

  const remove = async (id: string) => {
    if (!confirm("ลบที่อยู่นี้?")) return;
    const { error } = await supabase.from("addresses").delete().eq("id", id);
    if (error) toast.error("ลบไม่สำเร็จ", error.message);
    void refresh();
  };

  const makeDefault = async (id: string) => {
    const ids = addresses?.filter((a) => a.is_default).map((a) => a.id) ?? [];
    if (ids.length) await supabase.from("addresses").update({ is_default: false }).in("id", ids);
    const { error } = await supabase.from("addresses").update({ is_default: true }).eq("id", id);
    if (error) toast.error("ตั้งค่าไม่สำเร็จ", error.message);
    void refresh();
  };

  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="text-lg">ที่อยู่ของฉัน</h2>
          <p className="text-xs text-slate-500">เก็บใน Supabase เท่านั้น (ไม่อยู่บน Blockchain) — เห็นได้แค่คุณ</p>
        </div>
        {!adding && (
          <Button icon={MapPin} onClick={() => setAdding(true)}>
            เพิ่มที่อยู่ใหม่
          </Button>
        )}
      </div>
      <div className="px-6 py-2">
        {adding && (
          <div className="py-4">
            <AddressForm isFirst={!addresses?.length} onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
          </div>
        )}
        {isLoading ? (
          <div className="py-6">
            <Spinner />
          </div>
        ) : !addresses?.length && !adding ? (
          <p className="py-10 text-center text-sm text-slate-500">ยังไม่มีที่อยู่</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {addresses?.map((a) => (
              <li key={a.id} className="flex flex-wrap items-start justify-between gap-3 py-4 text-sm">
                <div>
                  <p>
                    <span className="font-medium">{a.recipient_name}</span> <span className="text-slate-500">| {a.phone}</span>
                  </p>
                  <p className="text-slate-600">{formatAddress(a)}</p>
                  {a.is_default && <span className="mt-1 inline-block border border-brand-500 px-1 text-[11px] text-brand-500">ค่าเริ่มต้น</span>}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button onClick={() => void remove(a.id)} className="text-sky-700 hover:underline">
                    ลบ
                  </button>
                  <Button variant="secondary" size="sm" disabled={a.is_default} onClick={() => void makeDefault(a.id)}>
                    ตั้งเป็นค่าเริ่มต้น
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// ─────────────────────────── แจ้งเตือน ───────────────────────────

type Notification = Tables<"notifications">;

function describe(n: Notification): { icon: LucideIcon; title: string; text: string; link: string } {
  const data = (n.data ?? {}) as Record<string, string | boolean | undefined>;
  const order = `#${n.order_id}`;
  switch (n.type) {
    case "order_placed":
      return { icon: ShoppingBag, title: "มีคำสั่งซื้อใหม่", text: `คำสั่งซื้อ ${order} — กรุณาจัดส่งให้ทันกำหนด`, link: "/seller?tab=orders" };
    case "order_shipped":
      return { icon: Truck, title: "สินค้าถูกจัดส่งแล้ว", text: `คำสั่งซื้อ ${order}${data.trackingNo ? ` เลขพัสดุ ${data.trackingNo}` : ""}`, link: "/orders" };
    case "order_completed":
      return {
        icon: CircleCheck,
        title: "คำสั่งซื้อสำเร็จ",
        text: data.sellerAmountWei ? `คำสั่งซื้อ ${order} — ยอดขาย ${formatEth(String(data.sellerAmountWei))} ETH เข้ายอดที่ถอนได้` : `คำสั่งซื้อ ${order}`,
        link: "/orders",
      };
    case "order_refunded":
      return { icon: RotateCcw, title: "คืนเงินแล้ว", text: `คำสั่งซื้อ ${order}${data.amountWei ? ` (${formatEth(String(data.amountWei))} ETH)` : ""}`, link: "/orders" };
    case "dispute_opened":
      return { icon: Flag, title: "ผู้ซื้อแจ้งปัญหา", text: `คำสั่งซื้อ ${order} — รอ Admin ตัดสิน`, link: "/seller?tab=orders" };
    case "dispute_resolved":
      return {
        icon: Scale,
        title: "Admin ตัดสินแล้ว",
        text: `คำสั่งซื้อ ${order}: ${data.refundBuyer ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย"}${data.note ? ` — ${data.note}` : ""}`,
        link: "/orders",
      };
    default:
      return { icon: Package, title: "อัปเดตคำสั่งซื้อ", text: `${n.type} ${order}`, link: "/orders" };
  }
}

function Notifications() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    refetchInterval: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });
  const unread = data?.filter((n) => !n.read) ?? [];

  const markRead = async (ids: number[]) => {
    if (!ids.length) return;
    const { error } = await supabase.from("notifications").update({ read: true }).in("id", ids);
    if (error) toast.error("อัปเดตแจ้งเตือนไม่สำเร็จ", error.message);
    void qc.invalidateQueries({ queryKey: ["notifications"] });
    void qc.invalidateQueries({ queryKey: ["notifications-unread"] });
  };

  return (
    <section className="card">
      <header className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h1 className="text-lg">การแจ้งเตือน</h1>
        {unread.length > 0 && (
          <button onClick={() => void markRead(unread.map((n) => n.id))} className="text-sm text-slate-600 hover:text-brand-600">
            อ่านทั้งหมดแล้ว
          </button>
        )}
      </header>
      {isLoading ? (
        <div className="p-6">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center py-20 text-slate-500">
          <Bell className="h-16 w-16 text-slate-300" strokeWidth={1.25} />
          <p className="mt-3 text-sm">ยังไม่มีการแจ้งเตือน</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((n) => {
            const d = describe(n);
            return (
              <li key={n.id} className={n.read ? "" : "bg-brand-50/50"}>
                <Link to={d.link} onClick={() => void markRead(n.read ? [] : [n.id])} className="flex gap-4 px-6 py-4 hover:bg-slate-50">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-sm bg-brand-50 text-brand-500">
                    <d.icon className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className={`block ${n.read ? "text-slate-700" : "font-medium text-slate-900"}`}>{d.title}</span>
                    <span className="block text-slate-600">{d.text}</span>
                    <span className="block text-xs text-slate-400">{formatThaiDate(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="ยังไม่อ่าน" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
