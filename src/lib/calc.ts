import { House, PriceRow, MonthlyRow, ComputedRow, Room, GuestNight } from "./types";

export function isoToVi(iso: string | null | undefined): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return y && m && d ? `${d}/${m}/${y}` : "";
}

export function viToIso(v: string): string | null {
  const t = v.trim();
  const mt = t.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!mt) return null;
  const d = Number(mt[1]);
  const mm = Number(mt[2]);
  const y = Number(mt[3]);
  if (y < 1900 || y > 2100 || mm < 1 || mm > 12 || d < 1 || d > 31) return null;
  // new Date() bị JavaScript tự roll ngày vô lý (vd 31/02 -> 03/03), nên phải
  // kiểm tra round-trip để Postgres không nhận '2026-02-31' (date out of range)
  const dt = new Date(Date.UTC(y, mm - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mm - 1 || dt.getUTCDate() !== d) return null;
  return `${mt[3]}-${mt[2]}-${mt[1]}`;
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
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
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
  const monthStart = new Date(Date.UTC(y, m - 1, 1));
  const monthEnd = new Date(Date.UTC(y, m, 0));
  const from = moveIn ? new Date(moveIn + "T00:00:00Z") : monthStart;
  const to = moveOut ? new Date(moveOut + "T00:00:00Z") : monthEnd;
  const s = from < monthStart ? monthStart : from;
  const e = to > monthEnd ? monthEnd : to;
  const total = daysInMonth(ky);
  if (s > e) return { amount: 0, note: "0 ngày", days: 0, total };
  const days = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
  if (days <= 0) return { amount: 0, note: "0 ngày", days: 0, total };
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

export const GUEST_RIENG_RATE = 200000;

// Tiền khách đêm (chưa gồm vi phạm) theo option:
// - chung: xếp các đêm theo ngày — đêm 1-2 miễn phí; đêm 3 = 200.000đ/người; đêm 4+ = 250.000đ/người/đêm
// - rieng: mỗi lượt người-đêm x 200.000đ (không miễn đêm đầu)
export function guestNightMoney(
  dates: GuestNight[] | (string | GuestNight)[] | null | undefined,
  mode: string | null | undefined,
  violations: number
): number {
  const v = Number(violations) || 0;
  const entries = normGuestDates(dates);
  let base = 0;
  if (mode === "rieng") {
    base = entries.length * GUEST_RIENG_RATE;
  } else {
    base = guestNightRows(dates, mode).reduce((s, r) => s + r.fee, 0);
  }
  return base + v * 500000;
}

export type GuestNightRow = {
  date: string;
  people: GuestNight[];
  fee: number;
};

// Phân rã theo từng đêm: mỗi ngày gom số người + tiền đêm đó.
// - chung: đêm thứ mấy của tháng (xếp theo ngày): đêm 1-2 miễn phí, đêm 3 = 200.000đ/người, đêm 4+ = 250.000đ/người
// - rieng: số người đêm đó × 200.000đ
export function guestNightRows(
  dates?: GuestNight[] | (string | GuestNight)[] | null,
  mode?: string | null
): GuestNightRow[] {
  const entries = normGuestDates(dates);
  const byDate = new Map<string, GuestNight[]>();
  for (const g of entries) {
    const arr = byDate.get(g.date);
    if (arr) arr.push(g);
    else byDate.set(g.date, [g]);
  }
  const datesArr = Array.from(byDate.keys()).sort();
  const rate = (i: number) => (i < 2 ? 0 : i === 2 ? 200000 : 250000);
  return datesArr.map((date, i) => {
    const people = byDate.get(date) ?? [];
    const fee =
      mode === "rieng"
        ? people.length * GUEST_RIENG_RATE
        : people.length * rate(i);
    return { date, people, fee };
  });
}

export function guestModeOf(r?: { guest_mode?: string | null } | null): "chung" | "rieng" {
  return r?.guest_mode === "rieng" ? "rieng" : "chung";
}

// Tổng lượt người-đêm = số entry khách (mỗi entry = 1 người x 1 đêm)
export function guestPersonNights(dates?: GuestNight[] | (string | GuestNight)[] | null): number {
  return normGuestDates(dates).length;
}

// Chuẩn hóa guest_dates (có thể là record {date,name,relation} hoặc chuỗi ngày của dữ liệu cũ) -> record chuẩn
export function normGuestDates(dates?: GuestNight[] | (string | GuestNight)[] | null): GuestNight[] {
  if (!Array.isArray(dates)) return [];
  const out: GuestNight[] = [];
  for (const d of dates) {
    if (typeof d === "string") {
      if (d) out.push({ date: d, name: "", relation: "" });
    } else if (d && typeof d.date === "string" && d.date) {
      out.push({ date: d.date, name: d.name || "", relation: d.relation || "" });
    }
  }
  return out;
}

// "yyyy-mm-dd" -> "dd/mm"
export function guestDayVi(iso: string): string {
  const p = iso.split("-");
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
}

// Số đêm khách = số ngày KHÁC NHAU trong danh sách (cùng đêm 2 khách vẫn tính 1 đêm)
export function guestNights(guest_dates?: GuestNight[] | (string | GuestNight)[] | null): number {
  return new Set(normGuestDates(guest_dates).map((g) => g.date)).size;
}

// Chỉ hiện ngày, gọn: "10/09, 12/09"
export function guestDaysVi(dates?: GuestNight[] | (string | GuestNight)[] | null): string {
  return Array.from(new Set(normGuestDates(dates).map((g) => g.date))).sort().map(guestDayVi).join(", ");
}

// Nhãn chip: "10/09 · Lan (bạn học)"
export function guestChipLabel(g: GuestNight): string {
  const p = [guestDayVi(g.date)];
  if (g.name) p.push(g.name);
  if (g.relation) p.push(`(${g.relation})`);
  return p.join(" · ");
}

// Mô tả đầy đủ (chứng cứ): "10/09 · Lan (bạn học), 12/09 · Tuấn (anh)"
export function guestSummary(dates?: GuestNight[] | (string | GuestNight)[] | null): string {
  return normGuestDates(dates).map(guestChipLabel).join(", ");
}

// Ưu tiên suy từ guest_dates; row cũ chưa có guest_dates thì fallback theo nights nhập tay
export function rowNights(r?: Pick<MonthlyRow, "guest_dates" | "nights"> | null): number {
  if (!r) return 0;
  const g = guestNights(r.guest_dates);
  return g > 0 ? g : Number(r.nights) || 0;
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

// Nhãn khoản miễn phí trong ghi chú ưu đãi cuối phiếu.
// Khớp với tên dòng trong bảng phiếu ("Tiền wifi + rác", "Tiền điện"...).
export function exemptLabel(part: "water" | "wifi" | "elec" | "penalty"): string {
  return part === "water"
    ? "Tiền nước"
    : part === "wifi"
      ? "Tiền wifi + rác"
      : part === "elec"
        ? "Tiền điện"
        : "Tiền phụ phí";
}

// Ghi chú ưu đãi tổng hợp cuối phiếu (dùng chung cho web + HTML export).
// Tháng đầu/cuối lấy động từ exempt_from/exempt_until.
export function exemptSummary(row: {
  exempted?: ("water" | "wifi" | "elec" | "penalty")[];
  exempt_from?: string | null;
  exempt_until?: string | null;
}): string | null {
  const parts = row.exempted ?? [];
  if (parts.length === 0) return null;
  const from = row.exempt_from ? ` từ tháng ${displayKy(row.exempt_from)}` : "";
  const until = row.exempt_until ? ` đến tháng ${displayKy(row.exempt_until)}` : "";
  return `🎁 Ưu đãi: ${parts.map(exemptLabel).join(", ")} được miễn phí${from}${until}`;
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
  const penaltyBase = guestNightMoney(prevRow?.guest_dates, guestModeOf(prevRow), Number(prevRow?.violations) || 0);
  const guestFee = guest ? 500000 : 0;
  const penalty = noPenalty ? 0 : penaltyBase + guestFee;
  const total = rent + water + wifi + elec + penalty;
  const paid = Number(row.paid) || 0;
  // Phụ phí của chính tháng này: hiển thị/nhập ở bảng tính, chưa vào tổng tháng này,
  // sẽ được thu trên phiếu tháng sau (cùng logic với nước/wifi/điện của tháng trước).
  const penaltyNow =
    guestNightMoney(row.guest_dates, guestModeOf(row), Number(row.violations) || 0) +
    (Number(row.guest) > 0 ? 500000 : 0);
  return {
    ...row,
    kwh,
    rent,
    rentNote,
    water,
    wifi,
    elec,
    penalty,
    penaltyNow,
    guestFee,
    hasGuest: guest,
    exempted,
    total,
    remain: total - paid,
    prevOcc: pOcc,
    prevOldIndex: prevOld ?? 0,
    prevNewIndex: prevNew ?? 0,
    prevKwh: pKwh ?? 0,
    prevNights: rowNights(prevRow),
    prevGuestDates: normGuestDates(prevRow?.guest_dates),
    prevGuestMode: guestModeOf(prevRow),
    prevGuestPeople: guestPersonNights(prevRow?.guest_dates),
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
