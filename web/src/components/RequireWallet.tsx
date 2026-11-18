import type { ReactNode } from "react";
import { useAccount, useConnect } from "wagmi";
import { useAuth } from "../hooks/useAuth";
import { EmptyState, Spinner } from "./ui";

/**
 * ต้องเชื่อม MetaMask (และถ้า signIn = true ต้องเข้าสู่ระบบ Supabase ด้วย) ก่อนแสดงเนื้อหา
 */
export function RequireWallet({ children, signIn = false, title }: { children: ReactNode; signIn?: boolean; title: string }) {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const auth = useAuth();

  if (!isConnected) {
    return (
      <EmptyState icon="🦊" title={title}>
        <p>เชื่อมต่อ MetaMask ก่อนเพื่อใช้งานหน้านี้</p>
        <button
          onClick={() => connect({ connector: connectors[0] })}
          disabled={isPending}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-mint-500 px-5 py-2 font-semibold text-white hover:bg-mint-600 disabled:opacity-60"
        >
          {isPending && <Spinner className="h-4 w-4" />}
          เชื่อมต่อ MetaMask
        </button>
      </EmptyState>
    );
  }

  if (signIn && !auth.isSignedIn) {
    return (
      <EmptyState icon="✍️" title={title}>
        <p>เซ็นข้อความใน MetaMask เพื่อเข้าสู่ระบบ (ไม่เสียค่า gas) — ใช้ยืนยันว่าคุณเป็นเจ้าของกระเป๋านี้</p>
        <button
          onClick={() => void auth.signIn()}
          disabled={auth.signingIn}
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2 font-semibold text-white hover:bg-navy-800 disabled:opacity-60"
        >
          {auth.signingIn && <Spinner className="h-4 w-4" />}
          เข้าสู่ระบบด้วย MetaMask
        </button>
        {auth.error && <p className="mt-2 text-xs text-rose-600">{auth.error}</p>}
      </EmptyState>
    );
  }

  return <>{children}</>;
}
