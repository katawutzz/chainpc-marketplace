// =====================================================================
// Edge Function: sync-chain
//
// อ่าน Events ของ PCMarketplace บน Hoodi ต่อจาก block ล่าสุดที่เคยอ่าน
// แล้วอ่าน "สถานะล่าสุด" ของสินค้า/คำสั่งซื้อ/ผู้ขายที่เปลี่ยนจาก contract โดยตรง
// (ไม่ประกอบสถานะเองจาก event → ข้อมูลตรงกับ chain เสมอ และรันซ้ำได้ปลอดภัย)
//
// เรียกโดย:
//   - pg_cron ทุก 1 นาที
//   - หน้าเว็บหลังทำธุรกรรมสำเร็จ (POST /functions/v1/sync-chain) เพื่อให้ข้อมูลอัปเดตทันที
//
// เขียนฐานข้อมูลด้วย service role (ข้าม RLS) — ผู้ใช้เขียนตารางเหล่านี้ตรง ๆ ไม่ได้
// =====================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { createPublicClient, http } from "npm:viem@2";
import {
  pcMarketplaceAbi,
  pcMarketplaceAddress,
  pcMarketplaceDeployBlock,
} from "../_shared/pcMarketplace.ts";

const CHAIN_ID = 560048; // Hoodi
const RPC_URL = Deno.env.get("HOODI_RPC_URL") ?? "https://ethereum-hoodi-rpc.publicnode.com";
const CONTRACT = pcMarketplaceAddress[CHAIN_ID];
const DEPLOY_BLOCK = pcMarketplaceDeployBlock[CHAIN_ID];

const BLOCK_CHUNK = 5_000n; // block ต่อการเรียก eth_getLogs หนึ่งครั้ง
const MAX_CHUNKS_PER_RUN = 10;
const CONFIRMATIONS = 1n; // รอ 1 block กันข้อมูลยังไม่นิ่ง
const MIN_INTERVAL_MS = 3_000; // กันการเรียกถี่เกินไป
const READ_CONCURRENCY = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const client = createPublicClient({ transport: http(RPC_URL) });
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// ---------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------

type Hex = `0x${string}`;
const lower = (a: string) => a.toLowerCase();
const iso = (seconds: bigint) => (seconds === 0n ? null : new Date(Number(seconds) * 1000).toISOString());
const isZeroHash = (h: string) => /^0x0{64}$/.test(h);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, (_k, v) => (typeof v === "bigint" ? v.toString() : v)), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

function check<T>(res: { data: T; error: unknown }, what: string): T {
  if (res.error) throw new Error(`${what}: ${JSON.stringify(res.error)}`);
  return res.data;
}


// ---------------------------------------------------------------------
// อ่านสถานะจาก contract
// ---------------------------------------------------------------------

async function readProduct(id: bigint) {
  const p = await client.readContract({
    address: CONTRACT,
    abi: pcMarketplaceAbi,
    functionName: "getProduct",
    args: [id],
  });
  return {
    id: Number(p.id),
    seller: lower(p.seller),
    title: p.title,
    category: p.category,
    condition: p.condition,
    price_wei: p.price.toString(),
    stock: p.stock,
    active: p.active,
    hidden: p.hidden,
    details_hash: p.detailsHash,
    created_at: iso(p.createdAt),
    updated_at: iso(p.updatedAt),
    synced_at: new Date().toISOString(),
  };
}

async function readOrder(id: bigint) {
  const o = await client.readContract({
    address: CONTRACT,
    abi: pcMarketplaceAbi,
    functionName: "getOrder",
    args: [id],
  });
  return {
    id: Number(o.id),
    product_id: Number(o.productId),
    buyer: lower(o.buyer),
    seller: lower(o.seller),
    quantity: o.quantity,
    unit_price_wei: o.unitPrice.toString(),
    total_wei: o.total.toString(),
    fee_bps: o.feeBps,
    status: o.status,
    paid_at: iso(o.paidAt),
    ship_deadline: iso(o.shipDeadline),
    shipped_at: iso(o.shippedAt),
    confirm_deadline: iso(o.confirmDeadline),
    tracking_no: o.trackingNo || null,
    dispute_reason_hash: isZeroHash(o.disputeReasonHash) ? null : o.disputeReasonHash,
    synced_at: new Date().toISOString(),
  };
}

async function readSeller(address: string) {
  const s = await client.readContract({
    address: CONTRACT,
    abi: pcMarketplaceAbi,
    functionName: "getSellerInfo",
    args: [address as Hex],
  });
  // rating_sum / rating_count ไม่ sync จาก chain แล้ว — คำนวณจากตาราง reviews ใน Supabase (trigger)
  return {
    address,
    verified: s.verified,
    banned: s.banned,
    synced_at: new Date().toISOString(),
  };
}

/** รายชื่อ Admin (ADMIN_ROLE) จาก contract → ตาราง admins (เพิ่ม/ลบให้ตรงกัน) */
async function syncAdmins(): Promise<string[]> {
  const onChain = (
    await client.readContract({ address: CONTRACT, abi: pcMarketplaceAbi, functionName: "getAdmins" })
  ).map(lower);
  const current = (check(await supabase.from("admins").select("address"), "read admins") as { address: string }[]).map(
    (a) => a.address,
  );
  const removed = current.filter((a) => !onChain.includes(a));
  const added = onChain.filter((a) => !current.includes(a));
  if (removed.length) check(await supabase.from("admins").delete().in("address", removed), "delete old admins");
  if (added.length) {
    const now = new Date().toISOString();
    check(await supabase.from("admins").upsert(added.map((address) => ({ address, synced_at: now }))), "upsert admins");
  }
  return onChain;
}

// ---------------------------------------------------------------------
// ประมวลผล logs ชุดหนึ่ง
// ---------------------------------------------------------------------

type NotifyTarget = "buyer" | "seller" | "admin";
interface NotifyIntent {
  type: string;
  orderId: bigint;
  to: NotifyTarget[];
  txHash: string;
  logIndex: number;
  data?: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
async function processLogs(logs: any[], admins: string[]) {
  const productIds = new Set<bigint>();
  const orderIds = new Set<bigint>();
  const sellers = new Set<string>();
  const resolutions = new Map<bigint, { refund: boolean; note: string }>();
  const intents: NotifyIntent[] = [];

  for (const log of logs) {
    const a = log.args ?? {};
    const base = { txHash: log.transactionHash as string, logIndex: Number(log.logIndex) };
    switch (log.eventName) {
      case "ProductListed":
      case "ProductUpdated":
      case "ProductActiveChanged":
      case "ProductHidden":
        productIds.add(a.productId);
        if (a.seller) sellers.add(lower(a.seller));
        break;
      case "OrderPlaced":
        orderIds.add(a.orderId);
        intents.push({ type: "order_placed", orderId: a.orderId, to: ["seller"], ...base });
        break;
      case "OrderShipped":
        orderIds.add(a.orderId);
        intents.push({ type: "order_shipped", orderId: a.orderId, to: ["buyer"], ...base, data: { trackingNo: a.trackingNo } });
        break;
      case "OrderCompleted":
        orderIds.add(a.orderId);
        intents.push({
          type: "order_completed",
          orderId: a.orderId,
          to: ["seller", "buyer"],
          ...base,
          data: { sellerAmountWei: a.sellerAmount?.toString(), feeWei: a.fee?.toString() },
        });
        break;
      case "OrderRefunded":
        orderIds.add(a.orderId);
        intents.push({
          type: "order_refunded",
          orderId: a.orderId,
          to: ["buyer", "seller"],
          ...base,
          data: { amountWei: a.amount?.toString() },
        });
        break;
      case "DisputeOpened":
        orderIds.add(a.orderId);
        intents.push({ type: "dispute_opened", orderId: a.orderId, to: ["seller", "admin"], ...base });
        break;
      case "DisputeResolved":
        orderIds.add(a.orderId);
        resolutions.set(a.orderId, { refund: a.refundBuyer, note: a.note });
        intents.push({
          type: "dispute_resolved",
          orderId: a.orderId,
          to: ["buyer", "seller"],
          ...base,
          data: { refundBuyer: a.refundBuyer, note: a.note },
        });
        break;
      // ReviewAdded: รีวิวย้ายไปเก็บใน Supabase แล้ว (หน้าเว็บไม่เรียก leaveReview) — ไม่ sync
      case "SellerBanned":
      case "SellerVerified":
        sellers.add(lower(a.seller));
        break;
      default:
        // FeeUpdated, DeadlinesUpdated, Paused, Withdrawn, ... ไม่ต้องเก็บใน DB
        break;
    }
  }

  // 1) คำสั่งซื้อ (ต้องรู้ productId/seller ก่อน upsert สินค้า)
  const orders = await mapLimit([...orderIds], READ_CONCURRENCY, readOrder);
  for (const o of orders) {
    productIds.add(BigInt(o.product_id));
    sellers.add(o.seller);
    const r = resolutions.get(BigInt(o.id));
    if (r) Object.assign(o, { resolution_refund: r.refund, resolution_note: r.note });
  }

  // 2) สินค้า → ผู้ขาย → คำสั่งซื้อ → รีวิว (ตามลำดับ foreign key)
  const products = await mapLimit([...productIds], READ_CONCURRENCY, readProduct);
  for (const p of products) sellers.add(p.seller);
  const sellerRows = await mapLimit([...sellers], READ_CONCURRENCY, readSeller);

  if (products.length) check(await supabase.from("products").upsert(products), "upsert products");
  if (sellerRows.length) check(await supabase.from("sellers").upsert(sellerRows), "upsert sellers");
  if (orders.length) check(await supabase.from("orders").upsert(orders), "upsert orders");

  // 3) แจ้งเตือน (unique (tx_hash, log_index, recipient) → รันซ้ำไม่เกิดซ้ำ)
  const orderMap = new Map(orders.map((o) => [BigInt(o.id), o]));
  const notifications = intents.flatMap((n) => {
    const o = orderMap.get(n.orderId);
    if (!o) return [];
    const recipients = new Set(n.to.flatMap((t) => (t === "buyer" ? [o.buyer] : t === "seller" ? [o.seller] : admins)));
    return [...recipients].map((recipient) => ({
      recipient,
      type: n.type,
      order_id: o.id,
      product_id: o.product_id,
      data: n.data ?? {},
      tx_hash: n.txHash,
      log_index: n.logIndex,
    }));
  });
  if (notifications.length) {
    check(
      await supabase
        .from("notifications")
        .upsert(notifications, { onConflict: "tx_hash,log_index,recipient", ignoreDuplicates: true }),
      "insert notifications",
    );
  }

  return { products: products.length, orders: orders.length, sellers: sellerRows.length, notifications: notifications.length };
}

// ---------------------------------------------------------------------
// handler
// ---------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const state = check(
      await supabase.from("sync_state").select("*").eq("id", 1).maybeSingle(),
      "read sync_state",
    ) as { contract_address: string; last_block: number; last_run_at: string } | null;

    if (state && Date.now() - Date.parse(state.last_run_at) < MIN_INTERVAL_MS) {
      return json({ skipped: true, reason: "called too frequently", lastBlock: state.last_block });
    }

    // contract เปลี่ยน (deploy ใหม่) → เริ่มอ่านจาก block ที่ deploy
    const sameContract = state && state.contract_address === lower(CONTRACT);
    let from = sameContract ? BigInt(state!.last_block) + 1n : DEPLOY_BLOCK;

    // จองเวลาเรียกไว้ก่อน กันหลาย request ทำงานพร้อมกัน
    check(
      await supabase.from("sync_state").upsert({
        id: 1,
        chain_id: CHAIN_ID,
        contract_address: lower(CONTRACT),
        last_block: Number(from - 1n),
        last_run_at: new Date().toISOString(),
      }),
      "touch sync_state",
    );

    const admins = await syncAdmins();
    const head = (await client.getBlockNumber()) - CONFIRMATIONS;
    const totals = { logs: 0, products: 0, orders: 0, sellers: 0, notifications: 0 };
    let chunks = 0;

    while (from <= head && chunks < MAX_CHUNKS_PER_RUN) {
      const to = from + BLOCK_CHUNK - 1n < head ? from + BLOCK_CHUNK - 1n : head;
      const logs = await client.getContractEvents({
        address: CONTRACT,
        abi: pcMarketplaceAbi,
        fromBlock: from,
        toBlock: to,
      });
      const r = await processLogs(logs, admins);
      totals.logs += logs.length;
      totals.products += r.products;
      totals.orders += r.orders;
      totals.sellers += r.sellers;
      totals.notifications += r.notifications;

      check(
        await supabase
          .from("sync_state")
          .update({ last_block: Number(to), last_run_at: new Date().toISOString() })
          .eq("id", 1),
        "save sync_state",
      );
      from = to + 1n;
      chunks++;
    }

    return json({
      ok: true,
      contract: CONTRACT,
      admins,
      syncedTo: Number(from - 1n),
      head: Number(head),
      caughtUp: from > head,
      ...totals,
    });
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
