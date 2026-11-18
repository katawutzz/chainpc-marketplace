import { keccak256, stringToBytes, zeroHash } from "viem";

/**
 * hash ของรายละเอียดสินค้า (เก็บบน chain ใน detailsHash)
 * ใช้ JSON ที่เรียง key แน่นอน เพื่อให้คำนวณซ้ำได้ผลเดิมเสมอ
 */
export interface ProductDetailsInput {
  description: string;
  specs: Record<string, string>;
  images: string[];
}

function canonical(details: ProductDetailsInput): string {
  const specs = Object.fromEntries(
    Object.entries(details.specs)
      .filter(([k, v]) => k.trim() && String(v).trim())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return JSON.stringify({ description: details.description, specs, images: details.images });
}

export function detailsHash(details: ProductDetailsInput): `0x${string}` {
  return keccak256(stringToBytes(canonical(details)));
}

/** hash ของข้อความ (รีวิว / เหตุผลข้อพิพาท) */
export function textHash(text: string): `0x${string}` {
  return keccak256(stringToBytes(text));
}

export type IntegrityStatus = "verified" | "mismatch" | "none";

/** เทียบรายละเอียดใน Supabase กับ hash บน chain */
export function checkDetailsIntegrity(
  onChainHash: string,
  details: { description: string; specs: unknown; images: string[] } | null | undefined,
): IntegrityStatus {
  if (!onChainHash || onChainHash === zeroHash) return "none";
  if (!details) return "mismatch";
  const specs = (details.specs && typeof details.specs === "object" ? details.specs : {}) as Record<string, string>;
  return detailsHash({ description: details.description, specs, images: details.images }) === onChainHash
    ? "verified"
    : "mismatch";
}
