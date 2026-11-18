import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAccount, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { ContractFunctionArgs, ContractFunctionName, TransactionReceipt } from "viem";
import { create } from "zustand";
import { hoodi, marketplace } from "./chain";
import { friendlyError } from "./format";
import { triggerSync } from "./supabase";
import { wagmiConfig } from "./wagmi";

// ---------------------------------------------------------------------
// Toasts — แจ้งสถานะธุรกรรม: รอยืนยันใน MetaMask → กำลังประมวลผล → สำเร็จ/ล้มเหลว
// ---------------------------------------------------------------------

export type ToastKind = "pending" | "success" | "error" | "info";
export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  txHash?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, "id">) => number;
  update: (id: number, patch: Partial<Omit<Toast, "id">>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { ...t, id }] }));
    if (t.kind !== "pending") setTimeout(() => get().dismiss(id), 6000);
    return id;
  },
  update: (id, patch) => {
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
    if (patch.kind && patch.kind !== "pending") setTimeout(() => get().dismiss(id), patch.kind === "error" ? 10000 : 7000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, message?: string) => useToasts.getState().push({ kind: "success", title, message }),
  error: (title: string, message?: string) => useToasts.getState().push({ kind: "error", title, message }),
  info: (title: string, message?: string) => useToasts.getState().push({ kind: "info", title, message }),
};

// ---------------------------------------------------------------------
// ส่งธุรกรรมไปที่ PCMarketplace
// ---------------------------------------------------------------------

type Abi = typeof marketplace.abi;
type WriteName = ContractFunctionName<Abi, "nonpayable" | "payable">;

export interface TxRequest<N extends WriteName> {
  functionName: N;
  args: ContractFunctionArgs<Abi, "nonpayable" | "payable", N>;
  value?: bigint;
}

/**
 * simulate (ได้ข้อความ error ที่อ่านง่ายก่อนเปิด MetaMask) → เซ็นใน MetaMask → รอ receipt
 * → สั่ง sync-chain และรีเฟรชข้อมูลทั้งหมด
 */
export function useMarketplaceTx() {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);

  async function send<N extends WriteName>(label: string, req: TxRequest<N>): Promise<TransactionReceipt | null> {
    const toasts = useToasts.getState();
    const id = toasts.push({ kind: "pending", title: label, message: "กำลังตรวจสอบ…" });
    setPending(true);
    try {
      const account = getAccount(wagmiConfig);
      if (!account.address) throw new Error("กรุณาเชื่อมต่อ MetaMask ก่อน");
      if (account.chainId !== hoodi.id) {
        toasts.update(id, { message: "กรุณาสลับเครือข่ายเป็น Hoodi ใน MetaMask" });
        await switchChain(wagmiConfig, { chainId: hoodi.id });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params: any = {
        address: marketplace.address,
        abi: marketplace.abi,
        functionName: req.functionName,
        args: req.args,
        value: req.value,
        account: account.address,
        chainId: hoodi.id,
      };
      const { request } = await simulateContract(wagmiConfig, params);

      toasts.update(id, { message: "กรุณายืนยันรายการใน MetaMask" });
      const hash = await writeContract(wagmiConfig, request);

      toasts.update(id, { message: "ส่งธุรกรรมแล้ว กำลังรอบล็อก (~12 วินาที)…", txHash: hash });
      const receipt = await waitForTransactionReceipt(wagmiConfig, { hash, chainId: hoodi.id });
      if (receipt.status !== "success") throw new Error("ธุรกรรมล้มเหลว (reverted)");

      toasts.update(id, { kind: "success", message: "สำเร็จ", txHash: hash });
      void triggerSync().then(() => queryClient.invalidateQueries());
      void queryClient.invalidateQueries();
      return receipt;
    } catch (err) {
      console.error(err);
      toasts.update(id, { kind: "error", message: friendlyError(err) });
      return null;
    } finally {
      setPending(false);
    }
  }

  return { send, pending };
}

/**
 * รอจนกว่า Supabase จะ sync ข้อมูลจาก chain (เรียก sync-chain ซ้ำระหว่างรอ)
 * ใช้ก่อนเขียนข้อมูลที่ RLS ต้องเห็นแถวจาก chain แล้ว เช่น ที่อยู่จัดส่ง รายละเอียดสินค้า
 */
export async function waitForSynced(check: () => Promise<boolean>, timeoutMs = 90_000): Promise<boolean> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await check()) return true;
    await triggerSync();
    if (await check()) return true;
    await new Promise((r) => setTimeout(r, 4000));
  }
  return false;
}
