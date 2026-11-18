import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase, type Tables } from "../lib/supabase";
import { toast } from "../lib/tx";
import { Lock, Plus } from "lucide-react";
import { Button, Spinner } from "./ui";

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
          className={`flex cursor-pointer gap-3 rounded-sm border p-3 ${selectedId === a.id ? "border-brand-500 bg-brand-50/40" : "border-slate-200 hover:bg-slate-50"}`}
        >
          <input type="radio" name="address" className="mt-1 accent-brand-500" checked={selectedId === a.id} onChange={() => onSelect(a)} />
          <span className="text-sm">
            <span className="font-medium">{a.recipient_name}</span> <span className="text-slate-500">| {a.phone}</span>
            {a.is_default && <span className="ml-2 border border-brand-500 px-1 text-[11px] text-brand-500">ค่าเริ่มต้น</span>}
            <span className="block text-slate-600">{formatAddress(a)}</span>
          </span>
        </label>
      ))}
      {adding || addresses?.length === 0 ? (
        <AddressForm
          isFirst={addresses?.length === 0}
          onSaved={(a) => {
            setAdding(false);
            onSelect(a);
          }}
          onCancel={addresses?.length ? () => setAdding(false) : undefined}
        />
      ) : (
        <Button variant="secondary" size="sm" icon={Plus} onClick={() => setAdding(true)}>
          เพิ่มที่อยู่ใหม่
        </Button>
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

  const input = "input";
  return (
    <form onSubmit={submit} className="animate-pop space-y-3 rounded-sm border border-slate-200 bg-white p-4">
      <p className="text-base">ที่อยู่ใหม่</p>
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
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Lock className="h-3.5 w-3.5" /> ที่อยู่เก็บใน Supabase (ไม่อยู่บน Blockchain) — ผู้ขายเห็นเฉพาะคำสั่งซื้อที่ส่งถึงเขา
      </p>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            ยกเลิก
          </Button>
        )}
        <Button loading={saving}>บันทึกที่อยู่</Button>
      </div>
    </form>
  );
}
