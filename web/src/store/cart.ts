import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * ตะกร้าสินค้า (เก็บในเบราว์เซอร์)
 * ราคาในตะกร้าเป็นแค่ "ราคาที่เห็นตอนเพิ่ม" — ตอนชำระเงินจะอ่านราคาล่าสุดจาก contract เสมอ
 */
export interface CartItem {
  productId: number;
  quantity: number;
  title: string;
  priceWei: string;
  seller: string;
  category: number;
  image?: string;
}

interface CartState {
  items: CartItem[];
  add: (item: CartItem, maxStock: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

export const MAX_CART_ITEMS = 20; // ตรงกับ MAX_CART_ITEMS ใน contract

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item, maxStock) =>
        set((state) => {
          const existing = state.items.find((i) => i.productId === item.productId);
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.productId === item.productId
                  ? { ...i, ...item, quantity: Math.min(i.quantity + item.quantity, maxStock) }
                  : i,
              ),
            };
          }
          if (state.items.length >= MAX_CART_ITEMS) return state;
          return { items: [...state.items, { ...item, quantity: Math.min(item.quantity, maxStock) }] };
        }),
      setQuantity: (productId, quantity) =>
        set((state) => ({
          items: state.items.map((i) => (i.productId === productId ? { ...i, quantity: Math.max(1, quantity) } : i)),
        })),
      remove: (productId) => set((state) => ({ items: state.items.filter((i) => i.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    { name: "chainpc-cart" },
  ),
);

export const useCartCount = () => useCart((s) => s.items.reduce((sum, i) => sum + i.quantity, 0));
