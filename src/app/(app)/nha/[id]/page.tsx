import { notFound } from "next/navigation";
import { sb } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-server";
import { activateHouse, dataForKy } from "@/app/actions";
import { House } from "@/lib/types";
import HouseWorkspace from "@/components/house-workspace";

export const dynamic = "force-dynamic";

export default async function HousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let render: { key: number; house: House; initialMonth: Awaited<ReturnType<typeof dataForKy>> } | null = null;
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
    render = { key: hid, house: house as House, initialMonth };
  } catch (err) {
    console.error("house-page-ssr", (err as Error)?.message ?? err);
    return (
      <div
        style={{
          margin: "40px auto",
          maxWidth: 640,
          padding: 16,
          textAlign: "center",
          border: "1px solid #d33",
          borderRadius: 8,
          background: "#fff5f5",
        }}
      >
        <p style={{ color: "#a00", fontWeight: 700 }}>&#x1F6D1; Không tải được dữ liệu nhà.</p>
        <p style={{ marginTop: 8, fontSize: 14, color: "#555" }}>Vui lòng tải lại trang hoặc thử lại sau.</p>
      </div>
    );
  }
  if (!render) return null;
  return <HouseWorkspace key={render.key} house={render.house} initialMonth={render.initialMonth} />;
}