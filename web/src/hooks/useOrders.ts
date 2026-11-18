import { useQuery } from "@tanstack/react-query";
import { supabase, type Tables } from "../lib/supabase";

export type OrderWithRelations = Tables<"orders"> & {
  products: (Pick<Tables<"products">, "title" | "category"> & { product_details: Pick<Tables<"product_details">, "images"> | null }) | null;
  order_shipping: Tables<"order_shipping"> | null;
  dispute_details: Tables<"dispute_details"> | null;
  reviews: Tables<"reviews"> | null;
};

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

/** คำสั่งซื้อของฉัน (ในฐานะผู้ซื้อหรือผู้ขาย) + ที่อยู่/ข้อพิพาท/รีวิว (ถ้า RLS ให้เห็น) */
export function useOrders(role: "buyer" | "seller", wallet: string | undefined) {
  return useQuery({
    queryKey: ["orders", role, wallet],
    enabled: !!wallet,
    refetchInterval: 10_000,
    queryFn: async (): Promise<OrderWithRelations[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, products(title, category, product_details(images)), order_shipping(*), dispute_details(*), reviews(*)",
        )
        .eq(role, wallet!.toLowerCase())
        .order("id", { ascending: false });
      if (error) throw error;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (data as any[]).map((o) => {
        const product = one(o.products) as OrderWithRelations["products"] & { product_details: unknown };
        return {
          ...o,
          products: product ? { ...product, product_details: one(product.product_details as never) } : null,
          order_shipping: one(o.order_shipping),
          dispute_details: one(o.dispute_details),
          reviews: one(o.reviews),
        } as OrderWithRelations;
      });
    },
  });
}
