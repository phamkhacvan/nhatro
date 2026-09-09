import type { NextRequest } from "next/server";
import { sb } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ room: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new Response("unauthorized", { status: 401 });
  const { room } = await params;
  const roomClean = decodeURIComponent(room).trim();
  if (!roomClean || roomClean.length > 60) return new Response("bad room", { status: 400 });

  // resolve active house owned by user
  let hid: number | null = user.active_house_id;
  if (hid != null) {
    const { data } = await sb.from("nhatro_houses").select("id").eq("id", hid).eq("owner_id", user.id).maybeSingle();
    if (!data) hid = null;
  }
  if (hid == null) {
    const { data: list } = await sb.from("nhatro_houses").select("id").eq("owner_id", user.id).order("id").limit(1);
    hid = (list?.[0]?.id as number) ?? null;
  }
  if (hid == null) return new Response("no house", { status: 404 });

  const { data } = await sb
    .from("nhatro_contracts")
    .select("file_name, mime, data")
    .eq("house_id", hid)
    .eq("room", roomClean)
    .maybeSingle();
  if (!data) return new Response("not found", { status: 404 });

  const buf = Buffer.from(data.data as string, "base64");
  const fileName = (data.file_name as string).replace(/["\\\r\n]/g, "").slice(0, 120);
  const mime = (data.mime as string) || "application/octet-stream";
  const viewable = /^(application\/pdf|image\/(jpeg|png|webp))$/.test(mime);
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buf.length),
      "Content-Disposition": `${download || !viewable ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}