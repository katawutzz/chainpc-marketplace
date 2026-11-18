import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { AddressForm, formatAddress, useAddresses } from "../components/AddressBook";
import { RequireWallet } from "../components/RequireWallet";
import { EmptyState, Spinner } from "../components/ui";
import { WithdrawCard } from "../components/WithdrawCard";
import { explorer } from "../lib/chain";
import { formatEth, formatThaiDate } from "../lib/format";
import { supabase, type Tables } from "../lib/supabase";
import { toast } from "../lib/tx";

export function AccountPage() {
  return (
    <RequireWallet signIn title="บัญชีของฉัน">
      <Account />
    </RequireWallet>
  );
}

function Account() {
  const { address } = useAccount();
  const wallet = address!.toLowerCase();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">👤 บัญชีของฉัน</h1>
        <a href={explorer.address(wallet)} target="_blank" rel="noreferrer" className="font-mono text-sm text-sky-700 hover:underline">
          {wallet} ↗
        </a>
      </div>
      <WithdrawCard />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Notifications />
        <div className="space-y-6">
          <ProfileForm wallet={wallet} />
          <Addresses />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── แจ้งเตือน ───────────────────────────

type Notification = Tables<"notifications">;

function describe(n: Notification): { icon: string; text: string; link: string } {
  const data = (n.data ?? {}) as Record<string, string | boolean | undefined>;
  const order = `#${n.order_id}`;
  switch (n.type) {
    case "order_placed":
      return { icon: "🛍️", text: `มีคำสั่งซื้อใหม่ ${order} — จัดส่งให้ทันกำหนด`, link: "/seller?tab=orders" };
    case "order_shipped":
      return { icon: "🚚", text: `คำสั่งซื้อ ${order} จัดส่งแล้ว${data.trackingNo ? ` (เลขพัสดุ ${data.trackingNo})` : ""}`, link: "/orders" };
    case "order_completed":
      return {
        icon: "✅",
        text: data.sellerAmountWei
          ? `คำสั่งซื้อ ${order} สำเร็จ — ยอดขาย ${formatEth(String(data.sellerAmountWei))} ETH เข้ายอดที่ถอนได้`
          : `คำสั่งซื้อ ${order} สำเร็จ`,
        link: "/orders",
      };
    case "order_refunded":
      return { icon: "↩️", text: `คำสั่งซื้อ ${order} คืนเงินแล้ว${data.amountWei ? ` (${formatEth(String(data.amountWei))} ETH)` : ""}`, link: "/orders" };
    case "dispute_opened":
      return { icon: "🚩", text: `ผู้ซื้อแจ้งปัญหาคำสั่งซื้อ ${order}`, link: "/seller?tab=orders" };
    case "dispute_resolved":
      return {
        icon: "⚖️",
        text: `Admin ตัดสินคำสั่งซื้อ ${order}: ${data.refundBuyer ? "คืนเงินผู้ซื้อ" : "จ่ายเงินผู้ขาย"}${data.note ? ` — ${data.note}` : ""}`,
        link: "/orders",
      };
    default:
      return { icon: "🔔", text: `${n.type} ${order}`, link: "/orders" };
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
    <section id="notifications" className="rounded-xl bg-white shadow-sm ring-1 ring-slate-200">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <h2 className="font-semibold">🔔 การแจ้งเตือน {unread.length > 0 && <span className="text-rose-600">({unread.length} ใหม่)</span>}</h2>
        {unread.length > 0 && (
          <button onClick={() => void markRead(unread.map((n) => n.id))} className="text-sm text-sky-700 hover:underline">
            อ่านทั้งหมดแล้ว
          </button>
        )}
      </header>
      {isLoading ? (
        <div className="p-6">
          <Spinner />
        </div>
      ) : !data?.length ? (
        <p className="p-6 text-center text-sm text-slate-500">ยังไม่มีการแจ้งเตือน</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {data.map((n) => {
            const d = describe(n);
            return (
              <li key={n.id} className={n.read ? "" : "bg-sky-50/60"}>
                <Link to={d.link} onClick={() => void markRead(n.read ? [] : [n.id])} className="flex gap-3 px-4 py-3 hover:bg-slate-50">
                  <span className="text-xl" aria-hidden>
                    {d.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className={n.read ? "text-slate-600" : "font-medium text-slate-900"}>{d.text}</span>
                    <span className="block text-xs text-slate-400">{formatThaiDate(n.created_at)}</span>
                  </span>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="ยังไม่อ่าน" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
      toast.success("บันทึกชื่อที่แสดงแล้ว");
      void qc.invalidateQueries();
    }
  };

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="font-semibold">โปรไฟล์</h2>
      <input
        maxLength={50}
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="ชื่อที่แสดง"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-mint-500"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving && <Spinner className="h-3.5 w-3.5" />}
          บันทึก
        </button>
        <Link to="/seller" className="text-sm text-sky-700 hover:underline">
          ตั้งชื่อร้านในศูนย์ผู้ขาย →
        </Link>
      </div>
    </form>
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
    <section className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <div>
        <h2 className="font-semibold">🏠 สมุดที่อยู่</h2>
        <p className="text-xs text-slate-500">เก็บใน Supabase เท่านั้น (ไม่อยู่บน Blockchain) — เห็นได้แค่คุณ</p>
      </div>
      {isLoading ? (
        <Spinner />
      ) : !addresses?.length && !adding ? (
        <EmptyState icon="🏠" title="ยังไม่มีที่อยู่" />
      ) : (
        <ul className="space-y-2">
          {addresses?.map((a) => (
            <li key={a.id} className="rounded-lg p-3 text-sm ring-1 ring-slate-200">
              <p>
                <b>{a.recipient_name}</b> · {a.phone}
                {a.is_default && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-600">ค่าเริ่มต้น</span>}
              </p>
              <p className="text-slate-600">{formatAddress(a)}</p>
              <div className="mt-1 flex gap-3 text-xs">
                {!a.is_default && (
                  <button onClick={() => void makeDefault(a.id)} className="text-sky-700 hover:underline">
                    ตั้งเป็นค่าเริ่มต้น
                  </button>
                )}
                <button onClick={() => void remove(a.id)} className="text-rose-600 hover:underline">
                  ลบ
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {adding ? (
        <AddressForm isFirst={!addresses?.length} onSaved={() => setAdding(false)} onCancel={() => setAdding(false)} />
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-sky-700 hover:underline">
          + เพิ่มที่อยู่ใหม่
        </button>
      )}
    </section>
  );
}
