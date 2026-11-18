import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { useAccount } from "wagmi";
import { supabase } from "../lib/supabase";

/**
 * การล็อกอิน 2 ชั้น
 *  1) เชื่อม MetaMask (wagmi)  → ดูสินค้า / ทำธุรกรรมบน chain ได้
 *  2) Sign in with Ethereum (Supabase Auth) → เซ็นข้อความ (ไม่เสีย gas) เพื่อเขียนข้อมูลใน Supabase
 *     เช่น ที่อยู่จัดส่ง รายละเอียดสินค้า รีวิว
 *
 * ถ้าผู้ใช้สลับบัญชีใน MetaMask ให้ออกจากระบบ Supabase อัตโนมัติ (กัน session ไม่ตรงกับกระเป๋า)
 */

interface AuthState {
  session: Session | null;
  /** wallet ที่ล็อกอิน Supabase อยู่ (lowercase) */
  sessionWallet: string | null;
  /** เชื่อม MetaMask และล็อกอินด้วยบัญชีเดียวกัน */
  isSignedIn: boolean;
  signingIn: boolean;
  error: string | null;
  signIn: () => Promise<boolean>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function walletFromSession(session: Session | null): string | null {
  if (!session) return null;
  const source = JSON.stringify(session.user.identities ?? []) + JSON.stringify(session.user.user_metadata ?? {});
  return source.match(/0x[0-9a-fA-F]{40}/)?.[0].toLowerCase() ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { address } = useAccount();
  const [session, setSession] = useState<Session | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const sessionWallet = useMemo(() => walletFromSession(session), [session]);

  // สลับบัญชีใน MetaMask → ออกจากระบบ Supabase
  useEffect(() => {
    if (session && address && sessionWallet && address.toLowerCase() !== sessionWallet) {
      void supabase.auth.signOut();
    }
  }, [session, address, sessionWallet]);

  const signIn = useCallback(async () => {
    setError(null);
    setSigningIn(true);
    try {
      const { error: err } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: "Sign in to ChainPC marketplace (Ethereum Hoodi testnet). This does not cost any gas.",
      });
      if (err) throw err;
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(
        /user rejected|user denied/i.test(msg)
          ? "คุณยกเลิกการเซ็นข้อความใน MetaMask"
          : /provider.*(disabled|not enabled)|unsupported provider/i.test(msg)
            ? `Supabase ยังไม่ได้เปิด Web3 Wallet (Ethereum) — ดู supabase/README.md (${msg})`
            : /uri|domain|redirect/i.test(msg)
              ? `ต้องเพิ่ม ${window.location.origin}/** ใน Redirect URLs ของ Supabase (${msg})`
              : msg,
      );
      return false;
    } finally {
      setSigningIn(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const isSignedIn = Boolean(session && address && sessionWallet === address.toLowerCase());

  return (
    <AuthContext.Provider value={{ session, sessionWallet, isSignedIn, signingIn, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ต้องอยู่ภายใน <AuthProvider>");
  return ctx;
}
