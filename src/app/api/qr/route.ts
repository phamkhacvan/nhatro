import type { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

// Rate-limit theo IP (fixed window trong bộ nhớ). Chạy trên serverless nên chỉ là
// best-effort theo instance, nhưng đủ chặn abuse cơ bản vì endpoint này không cần auth
// (tenants mở QR từ email mà không cần tài khoản).
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 60;
const hits = new Map<string, { n: number; at: number }>();

function allow(ip: string): boolean {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.at > WINDOW_MS) {
    hits.set(ip, { n: 1, at: now });
    return true;
  }
  rec.n += 1;
  return rec.n <= MAX_PER_WINDOW;
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ref = (p.get("ref") || "").normalize("NFC").slice(0, 40);
  const amountRaw = p.get("amount");
  const amount = amountRaw ? Math.floor(Number(amountRaw)) : 0;
  const bank = (p.get("bank") || "").trim().slice(0, 10);
  const acc = (p.get("acc") || "").trim().slice(0, 20);
  if (
    !/^[\p{L}\p{M}\p{N}.\-_/\x20]{1,40}$/u.test(ref) ||
    !/^[A-Za-z0-9]{3,10}$/.test(bank) ||
    !/^\d{6,20}$/.test(acc) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 500000000
  ) {
    return new Response("invalid qr params", { status: 400 });
  }

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  if (!allow(ip)) {
    return new Response("too many requests", { status: 429 });
  }

  const url = `https://img.vietqr.io/image/${bank}-${acc}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(ref)}`;
  const upstream = await fetch(url, { cache: "force-cache", redirect: "follow" });
  if (!upstream.ok) return new Response("qr upstream error", { status: 502 });
  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get("content-type") || "image/svg+xml";
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}