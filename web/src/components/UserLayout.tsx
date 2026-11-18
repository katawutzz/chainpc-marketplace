import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Bell, ClipboardList, ShieldCheck, Store, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { useAuth } from "../hooks/useAuth";
import { useIsAdmin, useUnreadNotifications } from "../hooks/useMarket";
import { shortAddress } from "../lib/format";
import { supabase } from "../lib/supabase";
import { NavAvatar, SideNavLayout, type SideNavItem } from "./SideNavLayout";

/** เมนูด้านซ้ายของหน้าบัญชีผู้ใช้ (บัญชี / การซื้อ / แจ้งเตือน) */
export function UserLayout({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const wallet = address?.toLowerCase() ?? "";
  const { isSignedIn, sessionWallet } = useAuth();
  const { data: unread = 0 } = useUnreadNotifications(sessionWallet, isSignedIn);
  const isAdmin = useIsAdmin();
  const { data: profile } = useQuery({
    queryKey: ["profile", wallet],
    enabled: !!wallet,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("address", wallet).maybeSingle()).data,
  });

  const items: SideNavItem[] = [
    { to: "/account", label: "บัญชีของฉัน", icon: User },
    { to: "/orders", label: "การซื้อของฉัน", icon: ClipboardList },
    { to: "/account/notifications", label: "การแจ้งเตือน", icon: Bell, badge: unread },
    { to: "/seller", label: "ร้านค้าของฉัน", icon: Store },
    ...(isAdmin ? [{ to: "/admin", label: "Admin Panel", icon: ShieldCheck }] : []),
  ];

  return (
    <SideNavLayout
      items={items}
      header={
        <NavAvatar
          address={wallet || "0x00"}
          title={profile?.display_name ?? shortAddress(wallet)}
          subtitle={
            <Link to="/account" className="hover:text-brand-600">
              แก้ไขโปรไฟล์
            </Link>
          }
        />
      }
    >
      {children}
    </SideNavLayout>
  );
}
