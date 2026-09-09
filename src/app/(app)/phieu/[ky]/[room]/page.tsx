import { notFound } from "next/navigation";
import { getActiveHouse } from "@/app/actions";
import { sb } from "@/lib/supabase";
import { MonthlyRow, Room } from "@/lib/types";
import { computeRow, fmt, pricesToMap, displayKy, applyRoomSync, prevKy, vietQrLocalUrl, fmtDateVi, utilNote } from "@/lib/calc";
import PhieuActions from "@/components/phieu-actions";
import PhieuCard from "@/components/phieu-card";

export const dynamic = "force-dynamic";

export default async function PhieuPage({
  params,
}: {
  params: Promise<{ ky: string; room: string }>;
}) {
  const { ky, room } = await params;
  const house = await getActiveHouse();
  const [{ data: row }, { data: prevRow }, { data: roomRow }, { data: prices }] = await Promise.all([
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", ky).eq("room", room).single(),
    sb.from("nhatro_monthly").select("*").eq("house_id", house.id).eq("ky", prevKy(ky)).eq("room", room).maybeSingle(),
    sb.from("nhatro_rooms").select("*").eq("house_id", house.id).eq("room", room).single(),
    sb.from("nhatro_prices").select("*").eq("house_id", house.id).order("occupancy"),
  ]);

  if (!row || !house) notFound();
  const synced = applyRoomSync([row as MonthlyRow], (roomRow ? [roomRow] : []) as Room[])[0] as MonthlyRow;
  const prevSynced = prevRow
    ? applyRoomSync([prevRow as MonthlyRow], (roomRow ? [roomRow] : []) as Room[])[0] as MonthlyRow
    : null;
  const c = computeRow(house, pricesToMap(prices ?? []), synced, prevSynced);

  const pDateStr = fmtDateVi(c.prevCloseDate);
  const oDateStr =
    c.prevMoveIn && c.prevMoveIn.slice(0, 7) === prevKy(ky) ? fmtDateVi(c.prevMoveIn) : null;
  const elecNote =
    c.prevKwh > 0
      ? oDateStr && pDateStr
        ? `Số cũ: ${c.prevOldIndex.toLocaleString("vi-VN")} (${oDateStr}) → Số mới: ${c.prevNewIndex.toLocaleString("vi-VN")} (${pDateStr}) = ${c.prevKwh.toLocaleString("vi-VN")} kWh`
        : `Số cũ: ${c.prevOldIndex.toLocaleString("vi-VN")} → Số mới: ${c.prevNewIndex.toLocaleString("vi-VN")} = ${c.prevKwh.toLocaleString("vi-VN")} kWh${pDateStr ? ` (chốt ngày ${pDateStr})` : ""}`
      : "";
  const pl = ` (tháng ${displayKy(prevKy(ky))})`;

  const items = [
    { label: "Tiền phòng", value: fmt(c.rent), note: c.rentNote || (c.occupancy > 0 ? `(${c.occupancy} người)` : "") },
    {
      label: "Tiền nước" + pl,
      value: fmt(c.water),
      note: utilNote(c.prevOcc, c.prevUtilNote, ky, Boolean(c.washing_machine), c.prevUtilGuest),
    },
    { label: "Wifi + Rác" + pl, value: fmt(c.wifi), note: utilNote(c.prevOcc, c.prevUtilNote, ky, undefined, c.prevUtilGuest) },
    { label: "Tiền điện" + pl, value: fmt(c.elec), note: elecNote },
    {
      label: "Phụ phí" + pl,
      value: fmt(c.penalty),
      note:
        c.penalty > 0
          ? `(khách đêm: ${c.prevNights}, khách ở trên 5 ngày: ${c.hasGuest ? 1 : 0}, vi phạm: ${c.prevViolations})`
          : "",
    },
  ];

  const qrUrl =
    house.bank_code && house.bank_account
      ? vietQrLocalUrl({
          bankCode: house.bank_code,
          accountNumber: house.bank_account,
          amount: c.remain,
          reference: `P${room} ${displayKy(ky)}`,
        })
      : null;
  const reference = `P${room} ${displayKy(ky)}`;

  return (
    <div className="mx-auto max-w-xl">
      <PhieuActions ky={ky} room={room} remain={c.remain} />
      <PhieuCard house={house} c={c} items={items} qrUrl={qrUrl} reference={reference} address={house.address} kyLabel={displayKy(ky)} />
    </div>
  );
}