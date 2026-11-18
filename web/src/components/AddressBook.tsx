import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Tables } from "../lib/supabase";
import { toast } from "../lib/tx";
import { Spinner } from "./ui";

export type AddressRow = Tables<"addresses">;

export const formatAddress = (a: Pick<AddressRow, "address_line" | "district" | "province" | "postcode">) =>
  [a.address_line, a.district, a.province, a.postcode].filter(Boolean).join(" ");

export function useAddresses(enabled: boolean) {
  return useQuery({
    queryKey: ["addresses"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("addresses")
        .select("*")
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** เลือกที่อยู่จัดส่งจากสมุดที่อยู่ หรือเพิ่มใหม่ (ข้อมูลส่วนตัว — RLS ให้เห็นเฉพาะเจ้าของ) */
export function AddressPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (a: AddressRow) => void;
}) {
  const { data: addresses, isLoading } = useAddresses(true);
  const [adding, setAdding] = useState(false);

  if (isLoading) return <Spinner />;

  return (
    <div className="space-y-3">
      {addresses?.map((a) => (
        <label
          key={a.id}
          className={`flex cursor-pointer gap-3 rounded-lg p-3 ring-1 ${selectedId === a.id ? "bg-mint-500/5 ring-2 ring-mint-500" : "ring-slate-200 hover:bg-slate-50"}`}
        >
          <input type="radio" name="address" className="mt-1 accent-mint-600" checked={selectedId === a.id} onChange={() => onSelect(a)} />
          <span className="text-sm">
            <span className="font-semibold">{a.recipient_name}</span> · {a.phone}
            {a.is_default && <span className="ml-2 rounded bg-slate-100 px-1.5 text-xs text-slate-600">ค่าเริ่มต้น</span>}
            <span className="block text-slate-600">{formatAddress(a)}</span>
          </span>
        </label>
      ))}
      {(adding || addresses?.length === 0) ? (
        <AddressForm
          isFirst={addresses?.length === 0}
          onSaved={(a) => {
            setAdding(false);
            onSelect(a);
          }}
          onCancel={addresses?.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <button onClick={() => setAdding(true)} className="text-sm text-sky-700 hover:underline">
          + เพิ่มที่อยู่ใหม่
        </button>
      )}
    </div>
  );
}

export function AddressForm({
  isFirst,
  onSaved,
  onCancel,
}: {
  isFirst?: boolean;
  onSaved: (a: AddressRow) => void;
  onCancel?: () => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ recipient_name: "", phone: "", address_line: "", district: "", province: "", postcode: "" });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase
      .from("addresses")
      .insert({ ...form, is_default: !!isFirst })
      .select()
      .single();
    setSaving(false);
    if (error) {
      toast.error("บันทึกที่อยู่ไม่สำเร็จ", error.message);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["addresses"] });
    onSaved(data);
  };

  const input = "w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-mint-500";
  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg bg-slate-50 p-4 ring-1 ring-slate-200">
      <p className="text-sm font-semibold">ที่อยู่จัดส่งใหม่</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <input required maxLength={100} placeholder="ชื่อผู้รับ" value={form.recipient_name} onChange={set("recipient_name")} className={input} />
        <input required minLength={6} maxLength={20} placeholder="เบอร์โทร" inputMode="tel" value={form.phone} onChange={set("phone")} className={input} />
      </div>
      <input required maxLength={300} placeholder="บ้านเลขที่ ถนน ซอย ตำบล/แขวง" value={form.address_line} onChange={set("address_line")} className={input} />
      <div className="grid gap-3 sm:grid-cols-3">
        <input maxLength={100} placeholder="อำเภอ/เขต" value={form.district} onChange={set("district")} className={input} />
        <input maxLength={100} placeholder="จังหวัด" value={form.province} onChange={set("province")} className={input} />
        <input maxLength={10} placeholder="รหัสไปรษณีย์" inputMode="numeric" value={form.postcode} onChange={set("postcode")} className={input} />
      </div>
      <p className="text-xs text-slate-500">🔐 ที่อยู่เก็บใน Supabase (ไม่อยู่บน Blockchain) — ผู้ขายเห็นเฉพาะคำสั่งซื้อที่ส่งถึงเขา</p>
      <div className="flex gap-2">
        <button disabled={saving} className="inline-flex items-center gap-2 rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">
          {saving && <Spinner className="h-3.5 w-3.5" />}
          บันทึกที่อยู่
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-1.5 text-sm text-slate-600 hover:bg-slate-200">
            ยกเลิก
          </button>
        )}
      </div>
    </form>
  );
}
