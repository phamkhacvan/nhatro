import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token || !(await verifySession(token))) {
    return new Response("unauthorized", { status: 401 });
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
      "Cache-Control": "private, max-age=3600",
    },
  });
}