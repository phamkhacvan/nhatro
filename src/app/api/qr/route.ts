import type { NextRequest } from "next/server";
import { sb } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const ref = (p.get("ref") || "").normalize("NFC").slice(0, 40);
  const amountRaw = p.get("amount");
  const amount = amountRaw ? Math.floor(Number(amountRaw)) : 0;
  const bank = (p.get("bank") || "").trim().slice(0, 10);
  const acc = (p.get("acc") || "").trim().slice(0, 20);
  if (
    !/^[\p{L}\p{M}\p{N}.\-_/\x20]{1,40}$/u.test(ref) ||
    !Number.isFinite(amount) ||
    amount < 0 ||
    amount > 500000000 ||
    !bank ||
    !acc
  ) {
    return new Response("invalid qr params", { status: 400 });
  }

  const url = `https://img.vietqr.io/image/${bank}-${acc}-compact.png?amount=${amount}&addInfo=${encodeURIComponent(ref)}`;
  const upstream = await fetch(url, { cache: "force-cache" });
  if (!upstream.ok) return new Response("qr upstream error", { status: 502 });
  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}