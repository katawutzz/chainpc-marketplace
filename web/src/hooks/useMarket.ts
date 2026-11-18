import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { marketplace } from "../lib/chain";
import { supabase, type ProductDetailsRow, type ProductRow, type ProfileRow, type SellerRow } from "../lib/supabase";

export interface ProductListing extends ProductRow {
  details: ProductDetailsRow | null;
  sellerInfo: SellerRow | null;
  sellerProfile: ProfileRow | null;
  /** จำนวนชิ้นที่ขายแล้ว (ไม่นับคำสั่งซื้อที่คืนเงิน) */
  sold: number;
}

async function attachSellers(rows: (ProductRow & { product_details: ProductDetailsRow | null })[]): Promise<ProductListing[]> {
  const addresses = [...new Set(rows.map((r) => r.seller))];
  if (addresses.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [sellers, profiles, orders] = await Promise.all([
    supabase.from("sellers").select("*").in("address", addresses),
    supabase.from("profiles").select("*").in("address", addresses),
    supabase.from("orders").select("product_id, quantity, status").in("product_id", ids).neq("status", 5),
  ]);
  if (sellers.error) throw sellers.error;
  if (profiles.error) throw profiles.error;
  const sellerMap = new Map(sellers.data.map((s) => [s.address, s]));
  const profileMap = new Map(profiles.data.map((p) => [p.address, p]));
  const soldMap = new Map<number, number>();
  for (const o of orders.data ?? []) soldMap.set(o.product_id, (soldMap.get(o.product_id) ?? 0) + o.quantity);
  return rows.map(({ product_details, ...p }) => ({
    ...p,
    details: Array.isArray(product_details) ? (product_details[0] ?? null) : product_details,
    sellerInfo: sellerMap.get(p.seller) ?? null,
    sellerProfile: profileMap.get(p.seller) ?? null,
    sold: soldMap.get(p.id) ?? 0,
  }));
}

/** สินค้าที่เปิดขายทั้งหมด (สำเนาจาก chain ใน Supabase) — กรอง/เรียงฝั่ง client */
export function useListings() {
  return useQuery({
    queryKey: ["listings"],
    queryFn: async (): Promise<ProductListing[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_details(*)")
        .eq("active", true)
        .eq("hidden", false)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      const withSellers = await attachSellers(data);
      return withSellers.filter((p) => !p.sellerInfo?.banned);
    },
    staleTime: 15_000,
  });
}

/** สินค้า 1 รายการจาก Supabase (รายละเอียด/รูป/ข้อมูลร้าน) */
export function useProductListing(id: number) {
  return useQuery({
    queryKey: ["product", id],
    enabled: Number.isInteger(id) && id > 0,
    queryFn: async (): Promise<ProductListing | null> => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_details(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [withSeller] = await attachSellers([data]);
      return withSeller;
    },
  });
}

/** สถานะสินค้าล่าสุดจาก contract โดยตรง (ราคา/สต็อก/เปิดขาย) — ใช้ก่อนทำธุรกรรมเสมอ */
export function useOnChainProduct(id: number) {
  return useReadContract({
    address: marketplace.address,
    abi: marketplace.abi,
    functionName: "getProduct",
    args: [BigInt(Math.max(id, 0))],
    chainId: marketplace.chainId,
    query: { enabled: Number.isInteger(id) && id > 0, refetchInterval: 15_000 },
  });
}

/** รีวิวของสินค้านี้ (รีวิวผูกกับคำสั่งซื้อ → กรองตาม product_id) */
export function useProductReviews(productId: number) {
  return useQuery({
    queryKey: ["product-reviews", productId],
    enabled: productId > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*, orders!inner(product_id, quantity)")
        .eq("orders.product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** keccak256("ADMIN_ROLE") — ตรงกับ ADMIN_ROLE ใน contract */
export const ADMIN_ROLE = "0xa49807205ce4d355092ef5a8a18f56e8913cf4a201fbe287825b095693c21775" as const;
/** DEFAULT_ADMIN_ROLE ของ OpenZeppelin = 0x00…00 (เพิ่ม/ถอด Admin ได้) */
export const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000" as const;

/** wallet นี้มี ADMIN_ROLE บน contract หรือไม่ (มี Admin ได้หลายคน) */
export function useIsAdmin() {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: marketplace.address,
    abi: marketplace.abi,
    functionName: "hasRole",
    args: address ? [ADMIN_ROLE, address] : undefined,
    chainId: marketplace.chainId,
    query: { enabled: !!address },
  });
  return Boolean(data);
}

/** wallet นี้เพิ่ม/ถอด Admin ได้ไหม (DEFAULT_ADMIN_ROLE) */
export function useIsSuperAdmin() {
  const { address } = useAccount();
  const { data } = useReadContract({
    address: marketplace.address,
    abi: marketplace.abi,
    functionName: "hasRole",
    args: address ? [DEFAULT_ADMIN_ROLE, address] : undefined,
    chainId: marketplace.chainId,
    query: { enabled: !!address },
  });
  return Boolean(data);
}

export function useUnreadNotifications(wallet: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["notifications-unread", wallet],
    enabled: enabled && !!wallet,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
