import { notFound } from "next/navigation";
import { sb } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-server";
import { activateHouse, dataForKy } from "@/app/actions";
import { House } from "@/lib/types";
import HouseWorkspace from "@/components/house-workspace";

export const dynamic = "force-dynamic";

export default async function HousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const hid = Number(id);
    if (!Number.isFinite(hid)) notFound();
    const user = await getCurrentUser();
    if (!user) notFound();
    const { data: house } = await sb
      .from("nhatro_houses")
      .select("*")
      .eq("id", hid)
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!house) notFound();
    await activateHouse(hid);
    const initialMonth = await dataForKy(house.cur_ky as string);
    return <HouseWorkspace key={hid} house={house as House} initialMonth={initialMonth} />;
  } catch (err) {
    const msg = String((err as Error)?.message ?? err);
    const stack = (err as Error)?.stack ?? "";
    console.error("house-page-ssr", msg, stack);
    return (
      <div
        style={{
          margin: "40px auto",
          maxWidth: 640,
          padding: 16,
          fontFamily: "ui-monospace, monospace",
          fontSize: 13,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          border: "1px solid #d33",
          borderRadius: 8,
          background: "#fff5f5",
        }}
      >
        <p style={{ color: "#a00", fontWeight: 700 }}>&#x1F6D1; Lỗi render (SSR) &mdash; nha/{id}</p>
        <p>{msg}</p>
        {stack ? <pre style={{ fontSize: 12 }}>{stack}</pre> : null}
      </div>
    );
  }
}