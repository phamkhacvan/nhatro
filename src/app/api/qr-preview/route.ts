import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Rate limit in-memory (đủ cho preview cá nhân; chặn spam URL).
const RATE = { limit: 30, windowMs: 60_000 };
const ipHits = new Map<string, { count: number; resetAt: number }>();

function limited(ip: string): boolean {
  const now = Date.now();
  const rec = ipHits.get(ip);
  if (!rec || rec.resetAt < now) {
    ipHits.set(ip, { count: 1, resetAt: now + RATE.windowMs });
    return false;
  }
  rec.count += 1;
  if (rec.count > RATE.limit) return true;
  ipHits.set(ip, rec);
  return false;
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("unauthorized", { status: 401 });
  }
  if (limited(req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown")) {
    return new Response("too many requests", { status: 429 });
  }

  const p = req.nextUrl.searchParams;
  const bank = (p.get("bank") || "").slice(0, 10);
  const acc = (p.get("acc") || "").slice(0, 24);
  const ref = (p.get("ref") || "P-PREVIEW").normalize("NFC").slice(0, 40);
  const amount = Math.floor(Number(p.get("amount") || "0"));
  if (!/^\d{6}$/.test(bank) || !/^\d{6,20}$/.test(acc) || !/^[\p{L}\p{M}\p{N}.\-_/\x20]{1,40}$/u.test(ref) || !Number.isFinite(amount) || amount < 0 || amount > 500000000) {
    return new Response("invalid params", { status: 400 });
  }

  const url = `https://img.vietqr.io/image/${bank}-${acc}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(ref)}`;
  const upstream = await fetch(url, { cache: "force-cache" });
  if (!upstream.ok) return new Response("qr upstream error", { status: 502 });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=3600",
    },
  });
}