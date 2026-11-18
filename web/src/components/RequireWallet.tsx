import type { ReactNode } from "react";
import { PenLine, Wallet } from "lucide-react";
import { useAccount, useConnect } from "wagmi";
import { useAuth } from "../hooks/useAuth";
import { Button, EmptyState } from "./ui";

/**
 * ต้องเชื่อม MetaMask (และถ้า signIn = true ต้องเข้าสู่ระบบ Supabase ด้วย) ก่อนแสดงเนื้อหา
 */
export function RequireWallet({ children, signIn = false, title }: { children: ReactNode; signIn?: boolean; title: string }) {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const auth = useAuth();

  if (!isConnected) {
    return (
      <EmptyState icon={Wallet} title={title}>
        <p>เชื่อมต่อ MetaMask ก่อนเพื่อใช้งานหน้านี้</p>
        <Button className="mt-4" icon={Wallet} loading={isPending} onClick={() => connect({ connector: connectors[0] })}>
          เชื่อมต่อ MetaMask
        </Button>
      </EmptyState>
    );
  }

  if (signIn && !auth.isSignedIn) {
    return (
      <EmptyState icon={PenLine} title={title}>
        <p>เซ็นข้อความใน MetaMask เพื่อเข้าสู่ระบบ (ไม่เสียค่า gas) — ใช้ยืนยันว่าคุณเป็นเจ้าของกระเป๋านี้</p>
        <Button className="mt-4" loading={auth.signingIn} onClick={() => void auth.signIn()}>
          เข้าสู่ระบบด้วย MetaMask
        </Button>
        {auth.error && <p className="mt-2 text-xs text-rose-600">{auth.error}</p>}
      </EmptyState>
    );
  }

  return <>{children}</>;
}
