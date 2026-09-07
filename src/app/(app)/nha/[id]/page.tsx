import { notFound } from "next/navigation";
import { sb } from "@/lib/supabase";
import { getCurrentUser } from "@/lib/auth-server";
import { activateHouse, dataForKy } from "@/app/actions";
import { House } from "@/lib/types";
import HouseWorkspace from "@/components/house-workspace";

export const dynamic = "force-dynamic";

export default async function HousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
}