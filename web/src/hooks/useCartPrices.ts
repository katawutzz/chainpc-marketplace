import { useReadContracts } from "wagmi";
import { marketplace } from "../lib/chain";
import type { CartItem } from "../store/cart";

export interface CartLine extends CartItem {
  /** ราคาล่าสุดจาก contract */
  livePrice: bigint | null;
  liveStock: number;
  available: boolean;
  priceChanged: boolean;
  lineTotal: bigint;
  problem: string | null;
}

/** อ่านราคา/สต็อก/สถานะล่าสุดของทุกสินค้าในตะกร้าจาก contract ในครั้งเดียว */
export function useCartPrices(items: CartItem[], buyer?: string) {
  const query = useReadContracts({
    contracts: items.map((i) => ({
      address: marketplace.address,
      abi: marketplace.abi,
      functionName: "getProduct" as const,
      args: [BigInt(i.productId)] as const,
      chainId: marketplace.chainId,
    })),
    query: { enabled: items.length > 0, refetchInterval: 20_000 },
  });

  const lines: CartLine[] = items.map((item, idx) => {
    const res = query.data?.[idx];
    const p = res?.status === "success" ? res.result : null;
    const livePrice = p ? p.price : null;
    const liveStock = p ? Number(p.stock) : 0;
    let problem: string | null = null;
    if (query.data && !p) problem = "ไม่พบสินค้านี้แล้ว";
    else if (p && (!p.active || p.hidden)) problem = "สินค้าปิดการขายแล้ว";
    else if (p && buyer && p.seller.toLowerCase() === buyer.toLowerCase()) problem = "เป็นสินค้าของคุณเอง";
    else if (p && liveStock < item.quantity) problem = liveStock === 0 ? "สินค้าหมด" : `เหลือเพียง ${liveStock} ชิ้น`;
    const price = livePrice ?? BigInt(item.priceWei);
    return {
      ...item,
      livePrice,
      liveStock,
      available: !!p && problem === null,
      priceChanged: livePrice !== null && livePrice.toString() !== item.priceWei,
      lineTotal: price * BigInt(item.quantity),
      problem,
    };
  });

  const total = lines.reduce((s, l) => s + l.lineTotal, 0n);
  const allAvailable = lines.length > 0 && lines.every((l) => l.available);
  return { lines, total, allAvailable, isLoading: query.isLoading, refetch: query.refetch };
}
