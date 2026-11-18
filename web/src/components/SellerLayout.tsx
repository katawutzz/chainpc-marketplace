import type { ReactNode } from "react";
import { ClipboardList, LayoutDashboard, Package, Plus, Store } from "lucide-react";
import { useAccount } from "wagmi";
import { useOrders } from "../hooks/useOrders";
import { shortAddress } from "../lib/format";
import { NavAvatar, SideNavLayout } from "./SideNavLayout";

/** เมนูด้านซ้ายของศูนย์ผู้ขาย */
export function SellerLayout({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const wallet = address?.toLowerCase() ?? "";
  const { data: orders } = useOrders("seller", wallet);
  const toShip = orders?.filter((o) => o.status === 1).length ?? 0;

  return (
    <SideNavLayout
      header={<NavAvatar address={wallet || "0x00"} title="ศูนย์ผู้ขาย" subtitle={<span className="font-mono">{shortAddress(wallet)}</span>} />}
      items={[
        { to: "/seller?tab=overview", label: "ภาพรวมร้านค้า", icon: LayoutDashboard },
        { to: "/seller?tab=orders", label: "คำสั่งซื้อ", icon: ClipboardList, badge: toShip },
        { to: "/seller?tab=products", label: "สินค้าของฉัน", icon: Package },
        { to: "/seller/products/new", label: "เพิ่มสินค้าใหม่", icon: Plus },
        { to: "/seller?tab=shop", label: "ข้อมูลร้านค้า", icon: Store },
      ]}
    >
      {children}
    </SideNavLayout>
  );
}
