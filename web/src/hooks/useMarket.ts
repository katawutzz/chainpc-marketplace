import { useQuery } from "@tanstack/react-query";
import { useAccount, useReadContract } from "wagmi";
import { marketplace } from "../lib/chain";
import { supabase, type ProductDetailsRow, type ProductRow, type ProfileRow, type SellerRow } from "../lib/supabase";

export interface ProductListing extends ProductRow {
  details: ProductDetailsRow | null;
  sellerInfo: SellerRow | null;
  sellerProfile: ProfileRow | null;
}

async function attachSellers(rows: (ProductRow & { product_details: ProductDetailsRow | null })[]) {
  const addresses = [...new Set(rows.map((r) => r.seller))];
  if (addresses.length === 0) return [];
  const [sellers, profiles] = await Promise.all([
    supabase.from("sellers").select("*").in("address", addresses),
    supabase.from("profiles").select("*").in("address", addresses),
  ]);
  if (sellers.error) throw sellers.error;
  if (profiles.error) throw profiles.error;
  const sellerMap = new Map(sellers.data.map((s) => [s.address, s]));
  const profileMap = new Map(profiles.data.map((p) => [p.address, p]));
  return rows.map(({ product_details, ...p }) => ({
    ...p,
    details: product_details,
    sellerInfo: sellerMap.get(p.seller) ?? null,
    sellerProfile: profileMap.get(p.seller) ?? null,
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

/** owner ของ contract = Admin */
export function useIsAdmin() {
  const { address } = useAccount();
  const { data: owner } = useReadContract({
    address: marketplace.address,
    abi: marketplace.abi,
    functionName: "owner",
    chainId: marketplace.chainId,
  });
  return Boolean(address && owner && address.toLowerCase() === owner.toLowerCase());
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
