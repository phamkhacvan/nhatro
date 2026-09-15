import { House, PriceRow, MonthlyRow, ComputedRow, Room } from "./types";

export function isoToVi(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export function viToIso(v: string): string | null {
  const t = v.trim();
  const mt = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!mt) return null;
  const iso = `${mt[3]}-${mt[2]}-${mt[1]}`;
  const dt = new Date(iso + "T00:00:00");
  return isNaN(dt.getTime()) ? null : iso;
}

export function maskDate(v: string): string {
  const dg = v.replace(/\D/g, "").slice(0, 8);
  return [dg.slice(0, 2), dg.slice(2, 4), dg.slice(4, 8)].filter(Boolean).join("/");
}

// Nhập "mm/yyyy" (tháng/năm) theo dạng gõ trơn
export function maskMonth(v: string): string {
  const dg = v.replace(/\D/g, "").slice(0, 6);
  if (dg.length <= 2) return dg;
  return dg.slice(0, 2) + "/" + dg.slice(2);
}

// "mm/yyyy" -> "yyyy-mm"
export function viMonthToKy(v: string): string | null {
  const mt = v.trim().match(/^(\d{2})\/(\d{4})$/);
  if (!mt) return null;
  const m = Number(mt[1]);
  const y = Number(mt[2]);
  if (m < 1 || m > 12 || y < 2000 || y > 2100) return null;
  return `${mt[2]}-${mt[1]}`;
}

// "yyyy-mm" -> "mm/yyyy"
export function kyToViMonth(ky: string | null | undefined): string {
  if (!ky) return "";
  const mt = ky.trim().match(/^(\d{4})-(\d{2})$/);
  if (!mt) return "";
  return `${mt[2]}/${mt[1]}`;
}

export function applyRoomSync(
  rows: MonthlyRow[],
  rooms: Room[],
  opts?: { historical?: boolean }
): MonthlyRow[] {
  const hist = opts?.historical ?? false;
  const occMap = new Map<string, number>(rooms.map((r) => [r.room, Number(r.occupancy) || 0]));
  const tenantMap = new Map<string, string>(rooms.map((r) => [r.room, r.tenant]));
  const phoneMap = new Map<string, string>(rooms.map((r) => [r.room, r.phone]));
  const machineMap = new Map<string, boolean>(rooms.map((r) => [r.room, Boolean(r.washing_machine)]));
  const exemptMap = new Map<string, Pick<Room, "exempt_elec" | "exempt_wifi" | "exempt_water" | "exempt_penalty" | "exempt_from" | "exempt_until" | "room_price">>(
    rooms.map((r) => [
      r.room,
      {
        exempt_elec: Boolean(r.exempt_elec),
        exempt_wifi: Boolean(r.exempt_wifi),
        exempt_water: Boolean(r.exempt_water),
        exempt_penalty: Boolean(r.exempt_penalty),
        exempt_from: r.exempt_from ?? null,
        exempt_until: r.exempt_until ?? null,
        room_price: r.room_price == null ? null : Number(r.room_price),
      },
    ])
  );
  return rows.map((r) => {
    const ex = exemptMap.get(r.room);
    return {
      ...r,
      occupancy: hist ? r.occupancy : (occMap.get(r.room) ?? r.occupancy),
      tenant: tenantMap.get(r.room) ?? r.tenant,
      phone: phoneMap.get(r.room) ?? r.phone,
      move_in: r.move_in ?? null,
      move_out: r.move_out ?? null,
      washing_machine: machineMap.has(r.room) ? machineMap.get(r.room) : r.washing_machine,
      exempt_elec: ex?.exempt_elec ?? Boolean(r.exempt_elec),
      exempt_wifi: ex?.exempt_wifi ?? Boolean(r.exempt_wifi),
      exempt_water: ex?.exempt_water ?? Boolean(r.exempt_water),
      exempt_penalty: ex?.exempt_penalty ?? Boolean(r.exempt_penalty),
      exempt_from: ex?.exempt_from ?? r.exempt_from ?? null,
      exempt_until: ex?.exempt_until ?? r.exempt_until ?? null,
      room_price: ex?.room_price ?? (r.room_price == null ? null : Number(r.room_price)),
    };
  });
}

export function parseKy(ky: string): { m: number; y: number } {
  const [y, m] = ky.split("-").map(Number);
  return { m: m || 1, y: y || 2026 };
}

export function formatKy(m: number, y: number): string {
  return `${y}-${String(m).padStart(2, "0")}`;
}

export function displayKy(ky: string): string {
  const { m, y } = parseKy(ky);
  return `${String(m).padStart(2, "0")}/${y}`;
}

export function fmtDateVi(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function daysInMonth(ky: string): number {
  const { m, y } = parseKy(ky);
  return new Date(y, m, 0).getDate();
}

export function prorate(
  full: number,
  ky: string,
  moveIn: string | null,
  moveOut: string | null
): { amount: number; note: string; days: number; total: number } {
  if (!moveIn && !moveOut) {
    const t = daysInMonth(ky);
    return { amount: full, note: "", days: t, total: t };
  }
  const { m, y } = parseKy(ky);
  const monthStart = new Date(y, m - 1, 1);
  const monthEnd = new Date(y, m, 0);
  const from = moveIn ? new Date(moveIn + "T00:00:00") : monthStart;
  const to = moveOut ? new Date(moveOut + "T00:00:00") : monthEnd;
  const s = from < monthStart ? monthStart : from;
  const e = to > monthEnd ? monthEnd : to;
  const total = daysInMonth(ky);
  if (s > e) return { amount: 0, note: "0 ngày", days: 0, total };
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  if (days >= total) return { amount: full, note: "", days: total, total };
  return { amount: Math.round((full * days) / total), note: `${days}/${total} ngày`, days, total };
}

export function nextKy(ky: string): string {
  const { m, y } = parseKy(ky);
  return m === 12 ? formatKy(1, y + 1) : formatKy(m + 1, y);
}

export function prevKy(ky: string): string {
  const { m, y } = parseKy(ky);
  return m === 1 ? formatKy(12, y - 1) : formatKy(m - 1, y);
}

// Ghi chú số người cho nước/wifi:
// ở đủ tháng -> (x người, tháng MM/YYYY); ở thiếu ngày -> (x người, tính theo X/Y ngày)
export function utilNote(
  prevOcc: number,
  prevUtilNote: string,
  ky: string,
  machine?: boolean,
  guest?: boolean
): string {
  if (prevOcc <= 0) return "";
  const parts: string[] = [];
  if (prevUtilNote) parts.push(`tính theo ${prevUtilNote}`);
  else parts.push(`tháng ${displayKy(prevKy(ky))}`);
  if (machine) parts.push("có sử dụng máy giặt");
  if (guest) parts.push("khách ở trên 5 ngày");
  return `(${prevOcc} người, ${parts.join(", ")})`;
}

export function fmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(n)) + "đ";
}

export function fmtNum(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "";
  return new Intl.NumberFormat("vi-VN").format(Number(n));
}

export function formatThousand(v: string): string {
  const digits = v.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return new Intl.NumberFormat("en-US").format(Number(digits));
}

export function parseThousand(v: string | number | null | undefined): number {
  if (v == null || v === "") return 0;
  return Number(String(v).replace(/,/g, "") ) || 0;
}

export function penaltyFor(nights: number, violations: number): number {
  const n = Number(nights) || 0;
  const v = Number(violations) || 0;
  return (n <= 2 ? 0 : 200000 + Math.max(0, n - 3) * 250000) + v * 500000;
}

export function vietQrLocalUrl(opts: {
  bankCode: string;
  accountNumber: string;
  amount: number;
  reference: string;
}): string {
  const { bankCode, accountNumber, amount, reference } = opts;
  return `/api/qr?bank=${bankCode}&acc=${accountNumber}&amount=${amount}&ref=${encodeURIComponent(reference)}`;
}

// Kiểm tra một kỳ (YYYY-MM) có nằm trong khoảng miễn phí của phòng hay không
export function isKyExempt(ky: string, from: string | null | undefined, until: string | null | undefined): boolean {
  if (from && ky < from) return false;
  if (until && ky > until) return false;
  return true;
}

// Danh sách thành phần đang được miễn phí cho 1 kỳ (dùng để hiển thị + in phiếu)
export function exemptParts(row: MonthlyRow): ("water" | "wifi" | "elec" | "penalty")[] {
  const active = isKyExempt(row.ky, row.exempt_from, row.exempt_until);
  if (!active) return [];
  const out: ("water" | "wifi" | "elec" | "penalty")[] = [];
  if (row.exempt_water) out.push("water");
  if (row.exempt_wifi) out.push("wifi");
  if (row.exempt_elec) out.push("elec");
  if (row.exempt_penalty) out.push("penalty");
  return out;
}

export function exemptLabel(part: "water" | "wifi" | "elec" | "penalty"): string {
  return part === "water" ? "nước" : part === "wifi" ? "wifi + rác" : part === "elec" ? "điện" : "phụ phí";
}

export function computeRow(
  s: House,
  prices: Record<number, number>,
  row: MonthlyRow,
  prevRow?: MonthlyRow | null
): ComputedRow {
  const occ = row.occupancy || 0;
  let pOcc = Number(prevRow?.occupancy) || 0;
  const guest = Number(prevRow?.guest) > 0;
  if (guest && pOcc < 2) pOcc = 2;
  const newIdx = row.new_index;
  const oldIdx = row.old_index ?? null;
  const kwh = newIdx != null && oldIdx != null ? Math.max(0, Number(newIdx) - Number(oldIdx)) : null;
  const useRoomPrice = row.room_price != null && Number(row.room_price) > 0;
  const fullRent = useRoomPrice ? Number(row.room_price) : prices[occ] ?? 0;
  const mi = row.move_in ?? null;
  const mo = row.move_out ?? null;
  const { amount: rent, note } = prorate(fullRent, row.ky, mi, mo);
  const missingPrice = occ > 0 && !useRoomPrice && (prices[occ] ?? 0) === 0;
  const rentNote = [useRoomPrice ? "giá riêng theo thỏa thuận" : "", note, missingPrice && !useRoomPrice ? `❗ chưa có giá ${occ} người` : ""]
    .filter(Boolean)
    .join(" · ");
  const pMi = prevRow?.move_in ?? null;
  const pMo = prevRow?.move_out ?? null;
  const pKy = prevRow?.ky ?? row.ky;
  const prevOld = prevRow?.old_index ?? null;
  const prevNew = prevRow?.new_index ?? null;
  const pKwh = prevOld != null && prevNew != null ? Math.max(0, Number(prevNew) - Number(prevOld)) : null;
  const machine = Boolean(prevRow?.washing_machine ?? row.washing_machine);
  const exempted = exemptParts(row);
  const noWater = exempted.includes("water");
  const noWifi = exempted.includes("wifi");
  const noElec = exempted.includes("elec");
  const noPenalty = exempted.includes("penalty");
  const waterPerHead = machine ? 150000 : Number(s.water_rate);
  const water = noWater ? 0 : prorate(pOcc * waterPerHead, pKy, pMi, pMo).amount;
  const wifi = noWifi ? 0 : prorate(pOcc * Number(s.wifi_rate), pKy, pMi, pMo).amount;
  const wNote = prorate(pOcc * waterPerHead, pKy, pMi, pMo).note;
  const elec = noElec || pKwh == null ? 0 : pKwh * Number(s.elec_rate);
  const penaltyBase = penaltyFor(Number(prevRow?.nights) || 0, Number(prevRow?.violations) || 0);
  const guestFee = guest ? 500000 : 0;
  const penalty = noPenalty ? 0 : penaltyBase + guestFee;
  const total = rent + water + wifi + elec + penalty;
  const paid = Number(row.paid) || 0;
  return {
    ...row,
    kwh,
    rent,
    rentNote,
    water,
    wifi,
    elec,
    penalty,
    guestFee,
    hasGuest: guest,
    exempted,
    total,
    remain: total - paid,
    prevOcc: pOcc,
    prevOldIndex: prevOld ?? 0,
    prevNewIndex: prevNew ?? 0,
    prevKwh: pKwh ?? 0,
    prevNights: Number(prevRow?.nights) || 0,
    prevViolations: Number(prevRow?.violations) || 0,
    prevCloseDate: prevRow?.close_date ?? null,
    prevMoveIn: pMi,
    prevUtilNote: wNote,
    prevUtilGuest: guest,
  };
}

export function computeRows(
  s: House,
  prices: Record<number, number>,
  rows: MonthlyRow[],
  prevRows?: MonthlyRow[] | null
): ComputedRow[] {
  const map = new Map((prevRows ?? []).map((r) => [r.room, r]));
  return rows.map((r) => computeRow(s, prices, r, map.get(r.room) ?? null));
}

export function pricesToMap(prices: PriceRow[]): Record<number, number> {
  const m: Record<number, number> = {};
  for (const p of prices) m[p.occupancy] = Number(p.price);
  return m;
}
