"use client";

import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { House, MonthlyRow, GuestNight } from "@/lib/types";
import { computeRow, fmt, displayKy, guestNightMoney, guestModeOf, guestNightRows, nextKy, prevKy, prorate, parseKy, isoToVi, viToIso, formatThousand, parseThousand, daysInMonth, guestSummary, guestChipLabel, normGuestDates, rowNights } from "@/lib/calc";
import { saveMonth } from "@/app/actions";
import { showToast } from "@/components/toast";
import DatePicker from "@/components/date-picker";
import RoomInfoModal from "@/components/room-info-modal";
import MonthSelector from "@/components/month-selector";
import { setDirty, useDirty } from "@/lib/dirty";
import { emitRefresh } from "@/lib/refresh";

type Draft = {
  room: string;
  tenant: string;
  phone: string;
  occupancy: string;
  old_index: string;
  old_date: string;
  new_index: string;
  close_date: string;
  move_in: string;
  move_out: string;
  nights: string;
  violations: string;
  guest: boolean;
  guest_dates: GuestNight[];
  guest_mode: "chung" | "rieng";
  washing_machine: boolean;
  paid: string;
  exempt_elec: boolean;
  exempt_wifi: boolean;
  exempt_water: boolean;
  exempt_penalty: boolean;
  exempt_from: string;
  exempt_until: string;
  room_price: string;
};

function toDraft(r: MonthlyRow): Draft {
  return {
    room: r.room,
    tenant: r.tenant,
    phone: r.phone,
    occupancy: String(r.occupancy ?? 0),
    old_index: r.old_index == null ? "" : String(r.old_index),
    old_date: isoToVi(r.old_date),
    new_index: r.new_index == null ? "" : String(r.new_index),
    close_date: isoToVi(r.close_date),
    move_in: isoToVi(r.move_in),
    move_out: isoToVi(r.move_out),
    nights: String(r.nights ?? 0),
    violations: String(r.violations ?? 0),
    guest: Number(r.guest) > 0,
    guest_dates: normGuestDates(r.guest_dates),
    guest_mode: r.guest_mode === "rieng" ? "rieng" : "chung",
    washing_machine: Boolean(r.washing_machine),
    paid: r.paid == null ? "" : formatThousand(String(r.paid)),
    exempt_elec: Boolean(r.exempt_elec),
    exempt_wifi: Boolean(r.exempt_wifi),
    exempt_water: Boolean(r.exempt_water),
    exempt_penalty: Boolean(r.exempt_penalty),
    exempt_from: r.exempt_from ?? "",
    exempt_until: r.exempt_until ?? "",
    room_price: r.room_price == null ? "" : formatThousand(String(r.room_price)),
  };
}

function toRow(ky: string, d: Draft): MonthlyRow {
  return {
    ky,
    room: d.room,
    tenant: d.tenant,
    phone: d.phone,
    occupancy: Number(d.occupancy) || 0,
    old_index: d.old_index === "" ? null : Number(d.old_index),
    old_date: viToIso(d.old_date),
    new_index: d.new_index === "" ? null : Number(d.new_index),
    close_date: viToIso(d.close_date),
    move_in: viToIso(d.move_in),
    move_out: viToIso(d.move_out),
    nights: d.guest_dates.length > 0 ? new Set(d.guest_dates.map((g) => g.date)).size : Number(d.nights) || 0,
    violations: Number(d.violations) || 0,
    guest: d.guest ? 1 : 0,
    guest_dates: d.guest_dates
      .filter((g) => typeof g.date === "string" && g.date)
      .map((g) => ({ date: g.date, name: g.name || "", relation: g.relation || "" })),
    guest_mode: d.guest_mode === "rieng" ? "rieng" : "chung",
    washing_machine: d.washing_machine,
    paid: parseThousand(d.paid),
    exempt_elec: d.exempt_elec,
    exempt_wifi: d.exempt_wifi,
    exempt_water: d.exempt_water,
    exempt_penalty: d.exempt_penalty,
    exempt_from: d.exempt_from || null,
    exempt_until: d.exempt_until || null,
    room_price: d.room_price === "" ? null : parseThousand(d.room_price),
  };
}

type SortKey =
  | "room" | "tenant" | "phone" | "occupancy"
  | "old_index" | "old_date" | "new_index" | "close_date" | "kwh"
  | "move_in" | "move_out"
  | "rent" | "water" | "wifi" | "elec" | "penalty" | "penaltyNow"
  | "total" | "paid" | "remain";

type Props = {
  ky: string;
  isCurrent: boolean;
  house: House;
  prices: Record<number, number>;
  rows: MonthlyRow[];
  prevRows?: MonthlyRow[];
  minKy?: string | null;
  onSelectMonth?: (ky: string) => void;
};

export default function MonthTable({ ky, isCurrent, house, prices, rows, prevRows = [], minKy = null, onSelectMonth }: Props) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(rows.map(toDraft));
  const [prevRowsState, setPrevRowsState] = useState(rows);
  if (prevRowsState !== rows) {
    setPrevRowsState(rows);
    setEditing(rows.map(toDraft));
  }
  const [pen, setPen] = useState<{ i: number; picker: string; name: string; rel: string; dates: GuestNight[]; violations: string; guest: boolean; mode: "chung" | "rieng" } | null>(null);
  // xem (không sửa) phụ phí của tháng trước — số tiền đã in trên phiếu tháng này
  const [penView, setPenView] = useState<number | null>(null);
  const [roomModal, setRoomModal] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const dirty = useDirty();
  const prevMap = new Map(prevRows.map((r) => [r.room, r]));
  const m = parseKy(ky).m;
  const prevM = parseKy(prevKy(ky)).m;
  const nextM = parseKy(nextKy(ky)).m;

  const firstRender = useRef(true);
  const dirtyRef = useRef(false);

  const checkDirty = useCallback(() => {
    if (firstRender.current) return;
    const orig = new Map(rows.map((r) => [r.room, toDraft(r)]));
    let d = false;
    for (const ed of editing) {
      const o = orig.get(ed.room);
      if (!o) {
        d = true;
        break;
      }
      if (
        o.occupancy !== ed.occupancy ||
        o.old_index !== ed.old_index ||
        o.old_date !== ed.old_date ||
        o.new_index !== ed.new_index ||
        o.close_date !== ed.close_date ||
        o.move_in !== ed.move_in ||
        o.move_out !== ed.move_out ||
        o.nights !== ed.nights ||
        o.violations !== ed.violations ||
        o.guest !== ed.guest ||
        JSON.stringify(o.guest_dates) !== JSON.stringify(ed.guest_dates) ||
        o.guest_mode !== ed.guest_mode ||
        o.paid !== ed.paid
      ) {
        d = true;
        break;
      }
    }
    if (d !== dirtyRef.current) {
      dirtyRef.current = d;
      setDirty(d);
    }
  }, [editing, rows]);

  useEffect(() => {
    checkDirty();
    firstRender.current = false;
  });

  useEffect(() => {
    return () => {
      setDirty(false);
      dirtyRef.current = false;
    };
  }, []);

  useEffect(() => {
    const open = Boolean(pen) || Boolean(roomModal) || penView !== null;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [pen, roomModal, penView]);

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  function openPen(i: number) {
    const d = editing[i];
    setPen({ i, picker: "", name: "", rel: "", dates: normGuestDates(d.guest_dates), violations: d.violations, guest: d.guest, mode: d.guest_mode === "rieng" ? "rieng" : "chung" });
  }

  function set(r: Draft, key: keyof Draft, val: string) {
    setEditing((prev) => prev.map((x) => (x.room === r.room ? { ...x, [key]: val } : x)));
  }

  const computed = editing.map((d) => {
    const c = computeRow(house, prices, toRow(ky, d), prevMap.get(d.room) ?? null);
    const occ = Math.max(Number(d.occupancy) || 0, d.guest ? 2 : 0);
    const waterPerHead = d.washing_machine ? 150000 : Number(house.water_rate);
    const ex = c.exempted ?? [];
    const nextBill =
      (ex.includes("water") ? 0 : prorate(occ * waterPerHead, ky, d.move_in || null, d.move_out || null).amount) +
      (ex.includes("wifi") ? 0 : prorate(occ * Number(house.wifi_rate), ky, d.move_in || null, d.move_out || null).amount) +
      (ex.includes("elec") || c.kwh == null ? 0 : c.kwh * Number(house.elec_rate)) +
      (ex.includes("penalty") ? 0 : guestNightMoney(d.guest_dates, d.guest_mode, Number(d.violations) || 0) + (d.guest ? 500000 : 0));
    return { ...c, nextBill };
  });

  type Item = { d: Draft; i: number; c: (typeof computed)[number] };
  const all: Item[] = editing.map((d, i) => ({ d, i, c: computed[i] }));

  const q = query.trim().toLowerCase();
  let items: Item[] = q
    ? all.filter(
        (it) =>
          it.d.room.toLowerCase().includes(q) ||
          it.d.tenant.toLowerCase().includes(q) ||
          it.d.phone.toLowerCase().includes(q)
      )
    : all;

  if (sort) {
    const acc: Record<SortKey, (it: Item) => string | number> = {
      room: (it) => it.d.room,
      tenant: (it) => it.d.tenant,
      phone: (it) => it.d.phone,
      occupancy: (it) => Number(it.d.occupancy) || 0,
      old_index: (it) =>
        it.d.old_index === "" ? -1 : Number(it.d.old_index),
      old_date: (it) => it.d.old_date,
      new_index: (it) => Number(it.d.new_index) || 0,
      close_date: (it) => it.d.close_date,
      kwh: (it) => it.c.kwh ?? -1,
      move_in: (it) => it.d.move_in,
      move_out: (it) => it.d.move_out,
      rent: (it) => it.c.rent,
      water: (it) => it.c.water,
      wifi: (it) => it.c.wifi,
      elec: (it) => it.c.elec,
      penalty: (it) => it.c.penalty,
      penaltyNow: (it) => it.c.penaltyNow,
      total: (it) => it.c.total,
      paid: (it) => Number(it.d.paid) || 0,
      remain: (it) => it.c.remain,
    };
    const get = acc[sort.key];
    items = [...items].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const r =
        typeof va === "number" && typeof vb === "number"
          ? va - vb
          : String(va).localeCompare(String(vb), "vi");
      return sort.dir === "asc" ? r : -r;
    });
  }

  function toggleSort(key: SortKey) {
    setSort((s) =>
      s?.key === key ? (s.dir === "asc" ? { key, dir: "desc" } : null) : { key, dir: "asc" }
    );
  }

  function statusOf(c: { occupancy: number; remain: number }) {
    if (c.remain > 0)
      return {
        label: "Còn thiếu",
        cls: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-500/30",
        dot: "bg-red-500 dark:bg-red-400",
      };
    if (!c.occupancy)
      return {
        label: "Trống",
        cls: "bg-slate-100 text-slate-500 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:ring-slate-500/30",
        dot: "bg-slate-400",
      };
    return {
      label: "Đủ",
      cls: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-500/30",
      dot: "bg-emerald-500 dark:bg-emerald-400",
    };
  }

  function Badge({ c }: { c: { occupancy: number; remain: number } }) {
    const st = statusOf(c);
    return (
      <span className={"inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 " + st.cls}>
        <span className={"h-1.5 w-1.5 rounded-full " + st.dot}></span>
        {st.label}
      </span>
    );
  }

  function save(next?: Draft[]): Promise<boolean> {
    const data = next ?? editing;
    const dateFields: [keyof Draft, string][] = [
      ["old_date", "Ngày chốt số cũ"],
      ["close_date", "Ngày chốt số mới"],
      ["move_in", "Ở từ ngày"],
      ["move_out", "Ở đến ngày"],
    ];
    for (const d of data) {
      for (const [key, label] of dateFields) {
        const v = d[key] as string;
        if (v === "") continue;
        if (!/^\d{2}\/\d{2}\/\d{4}$/.test(v)) {
          showToast("error", `Phòng ${d.room}: ${label} "${v}" sai định dạng. Nhập dd/mm/yyyy (vd 01/10/2026).`);
          return Promise.resolve(false);
        }
        if (!viToIso(v)) {
          showToast("error", `Phòng ${d.room}: ${label} "${v}" không tồn tại trong lịch (vd 31/09). Vui lòng nhập lại.`);
          return Promise.resolve(false);
        }
      }
    }
    return new Promise((resolve) => {
      let done = false;
      setSaving(true);
      saveMonth(ky, data.map((d) => toRow(ky, d)))
        .then((res) => {
          if (done) return;
          done = true;
          setSaving(false);
          if (!res.ok) {
            showToast("error", res.error || "Lưu thất bại.");
            resolve(false);
          } else {
            showToast("success", "Lưu thành công");
            setDirty(false);
            resolve(true);
            emitRefresh();
          }
        })
        .catch((err) => {
          if (done) return;
          done = true;
          setSaving(false);
          showToast("error", "Lưu thất bại: " + (err?.message || "lỗi không xác định"));
          resolve(false);
        });
    });
  }

  const inputCls =
    "w-20 rounded-md border border-slate-300 px-2 py-1 text-right text-sm tabular-nums transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";
  const dateCls =
    "w-[6.8rem] rounded-md border border-slate-300 px-2 py-1 text-left text-sm tabular-nums transition placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-600 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20";
  const cellCls =
    "whitespace-nowrap border-b border-slate-100 px-3 py-1.5 dark:border-slate-800";
  const numCls = cellCls + " text-right";
  const moneyCls = numCls + " tabular-nums";
  const labelCls =
    "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500";

  const sum = (fn: (c: (typeof computed)[number]) => number) =>
    computed.reduce((a, c) => a + fn(c), 0);

  const due = sum((c) => c.remain);
  const occupied = computed.filter((c) => c.occupancy > 0).length;

  const thSort = (key: SortKey, label: ReactNode, extraCls?: string) => (
    <th
      className={
        (extraCls ?? cellCls) +
        " cursor-pointer select-none transition hover:text-indigo-600 dark:hover:text-indigo-400"
      }
      onClick={() => toggleSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sort?.key === key && (
          <span className="text-indigo-600 dark:text-indigo-400">
            {sort.dir === "asc" ? "▲" : "▼"}
          </span>
        )}
      </span>
    </th>
  );

  const statCardCls =
    "rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60";

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Phải thu tháng {parseKy(ky).m}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(sum((c) => c.total))}</p>
        </div>
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Đã thu</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{fmt(sum((c) => c.paid))}</p>
        </div>
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Còn lại</p>
          <p className={"mt-1 text-xl font-bold tabular-nums " + (due > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
            {due > 0 ? fmt(due) : "Đủ ✓"}
          </p>
        </div>
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Phòng đang ở</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {occupied}
            <span className="text-sm font-medium text-slate-400"> / {computed.length} phòng</span>
          </p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Bảng tính tháng {displayKy(ky)}
        </h1>
        <MonthSelector ky={ky} setCurrent={isCurrent} minKy={minKy} onSelect={onSelectMonth} />
        <div className="relative ml-auto">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm phòng, tên, SĐT..."
            className={
              "w-52 rounded-lg border border-slate-300 py-1.5 pl-8 pr-7 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20" +
              (q ? " pr-16" : "")
            }
          />
          {q && (
            <button
              onClick={() => setQuery("")}
              title="Xóa tìm kiếm"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-1 text-xs text-slate-400 transition hover:text-slate-700 dark:hover:text-slate-200"
            >
              ✕
            </button>
          )}
        </div>
        <button
          onClick={() => save()}
          disabled={saving || !dirty}
          className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 disabled:opacity-50"
        >
          {saving ? "Đang lưu..." : "Lưu thay đổi"}
        </button>
      </div>

      <div className="hidden overflow-x-auto rounded-2xl bg-surface pb-4 shadow-sm ring-1 ring-slate-200/60 lg:block dark:bg-slate-900 dark:ring-slate-700/60">
        <table className="w-full min-w-[1400px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-xs font-bold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <th rowSpan={2} className={cellCls + " sticky left-0 z-20 bg-slate-100 text-center dark:bg-slate-800"}>
                Phòng
              </th>
              <th colSpan={3} className={cellCls}>
                Khách
              </th>
              <th colSpan={5} className={cellCls + " text-center"}>
                Điện
              </th>
              <th colSpan={2} className={cellCls + " text-center"}>
                Thuê không tròn tháng
              </th>
              <th colSpan={5} className={cellCls + " text-center"}>
                Chi phí
              </th>
              <th colSpan={3} className={cellCls + " text-center"}>
                Thanh toán
              </th>
              <th rowSpan={2} className={cellCls + " sticky right-0 z-20 bg-slate-100 text-center dark:bg-slate-800"}>
                In phiếu
              </th>
            </tr>
            <tr className="border-b-2 border-slate-300 bg-surface text-xs font-bold uppercase tracking-wide text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
              {thSort("tenant", "Người thuê")}
              {thSort("phone", "SĐT")}
              {thSort("occupancy", "Số người", cellCls + " text-center")}
              {thSort("old_index", "Số điện cũ", numCls)}
              {thSort("old_date", "Ngày chốt số cũ")}
              {thSort("new_index", "Số điện mới", numCls)}
              {thSort("close_date", "Ngày chốt số mới")}
              {thSort("kwh", "kWh", numCls)}
              {thSort("move_in", "Ở từ ngày")}
              {thSort("move_out", "Ở đến ngày")}
              {thSort("rent", "Tiền phòng", moneyCls)}
              {thSort("water", <>Nước (tháng {prevM})</>, moneyCls)}
              {thSort("wifi", <>Wifi+Rác (tháng {prevM})</>, moneyCls)}
              {thSort("elec", <>Điện (tháng {prevM})</>, moneyCls)}
              {thSort("penalty", <>Phụ phí (tháng {prevM})</>, moneyCls)}
              {thSort("penaltyNow", <>Phụ phí (tháng {m})</>, moneyCls)}
              {thSort("total", "Tổng", moneyCls)}
              {thSort("paid", "Đã thu", moneyCls)}
              {thSort("remain", "Còn lại", moneyCls)}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={21} className="px-4 py-8 text-center text-sm text-slate-400">
                  Không có phòng nào khớp tìm kiếm.
                </td>
              </tr>
            )}
            {items.map(({ d, i, c }) => {
              const rowBg = i % 2 ? "bg-[#f1f4f9]/70 dark:bg-slate-800/40" : "bg-surface dark:bg-slate-900";
              return (
                <tr key={c.room} className={rowBg + " transition hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"}>
                  <td className={cellCls + " sticky left-0 z-10 bg-inherit text-center"}>
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-bold">{c.room}</span>
                      <Badge c={c} />
                    </div>
                  </td>
                  <td className={cellCls + " font-medium dark:text-slate-200"}>
                    {c.tenant ? (
                      <button
                        onClick={() => setRoomModal(c.room)}
                        title="Xem / sửa thông tin người thuê"
                        className="underline decoration-dotted underline-offset-2 transition hover:text-indigo-600 dark:hover:text-indigo-400"
                      >
                        {c.tenant}
                      </button>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className={cellCls + " dark:text-slate-300"}>{c.phone || "—"}</td>
                  <td className={cellCls + " text-center"}>
                    <span className="font-semibold dark:text-slate-200">{c.occupancy}</span>
                  </td>
                  <td className={cellCls}>
                    <input
                      type="number"
                      value={d.old_index}
                      onChange={(e) => set(d, "old_index", e.target.value)}
                      className={inputCls}
                      placeholder={prevMap.has(d.room) ? "kWh" : "số lúc nhận phòng"}
                      title="Số điện cũ: có thể sửa (vd số công tơ lúc nhận phòng nếu mới vào ở giữa tháng)"
                    />
                  </td>
                  <td className={cellCls}>
                    <DatePicker
                      value={d.old_date}
                      onChange={(v) => set(d, "old_date", v)}
                      className={dateCls}
                      ariaLabel={`Ngày chốt số điện cũ phòng ${d.room}`}
                      title="Ngày chốt số điện cũ (ngày ghi nhận chỉ số đứng trước)"
                    />
                  </td>
                  <td className={cellCls}>
                    <input
                      type="number"
                      value={d.new_index}
                      onChange={(e) => set(d, "new_index", e.target.value)}
                      className={inputCls}
                      placeholder="kWh"
                    />
                  </td>
                  <td className={cellCls}>
                    <DatePicker
                      value={d.close_date}
                      onChange={(v) => set(d, "close_date", v)}
                      className={dateCls}
                      ariaLabel={`Ngày chốt số điện mới phòng ${d.room}`}
                    />
                  </td>
                  <td className={numCls + " font-bold dark:text-slate-100"}>{c.kwh || ""}</td>
                  <td className={cellCls}>
                    <DatePicker
                      value={d.move_in}
                      onChange={(v) => set(d, "move_in", v)}
                      className={dateCls}
                      ariaLabel={`Ngày vào ở phòng ${d.room}`}
                    />
                  </td>
                  <td className={cellCls}>
                    <DatePicker
                      value={d.move_out}
                      onChange={(v) => set(d, "move_out", v)}
                      className={dateCls}
                      ariaLabel={`Ngày trả phòng ${d.room}`}
                    />
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>
                    {fmt(c.rent)}
                    {c.rentNote && <div className="text-xs font-normal text-slate-400">{c.rentNote}</div>}
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>
                    {fmt(c.water)}
                    {c.exempted?.includes("water") && (
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">🎁 miễn phí</div>
                    )}
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>
                    {fmt(c.wifi)}
                    {c.exempted?.includes("wifi") && (
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">🎁 miễn phí</div>
                    )}
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>
                    {fmt(c.elec)}
                    {c.exempted?.includes("elec") && (
                      <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">🎁 miễn phí</div>
                    )}
                  </td>
                  <td className={moneyCls}>
                    {c.exempted?.includes("penalty") ? (
                      <>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmt(c.penalty)}</span>
                        <div className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">🎁 miễn phí</div>
                      </>
                    ) : (
                      <button
                        onClick={() => setPenView(i)}
                        title={`Xem chi tiết phụ phí tháng ${prevM} (đã thu trên phiếu tháng ${m})`}
                        className="font-medium text-slate-700 underline decoration-dotted underline-offset-2 transition hover:text-indigo-700 dark:text-slate-300 dark:hover:text-indigo-400"
                      >
                        {fmt(c.penalty)}
                      </button>
                    )}
                  </td>
                  <td className={moneyCls}>
                    <button
                      onClick={() => openPen(i)}
                      title={`Nhập phụ phí tháng ${m} (khách đêm / vi phạm / khách qua ở) — sẽ thu trên phiếu tháng ${nextM}`}
                      className="font-medium text-indigo-700 underline decoration-dotted underline-offset-2 transition hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {fmt(c.penaltyNow)}
                    </button>
                    {c.penaltyNow > 0 && (
                      <div className="text-[10px] font-normal text-slate-400">→ thu tháng {nextM}</div>
                    )}
                  </td>
                  <td className={moneyCls + " font-bold text-slate-900 dark:text-slate-100"}>
                    {fmt(c.total)}
                  </td>
                  <td className={cellCls}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={d.paid}
                      onChange={(e) => set(d, "paid", formatThousand(e.target.value))}
                      className={inputCls}
                      placeholder="đã thu"
                    />
                  </td>
                  <td className={moneyCls + " font-bold " + (c.remain > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                    {fmt(c.remain)}
                  </td>
                  <td className={cellCls + " sticky right-0 z-10 bg-inherit text-center"}>
                    {c.remain > 0 ? (
                      <a
                        href={`/phieu/${encodeURIComponent(ky)}/${encodeURIComponent(c.room)}`}
                        className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:ring-indigo-200 dark:bg-slate-800 dark:text-indigo-400 dark:ring-slate-700 dark:hover:bg-indigo-500/10 dark:hover:ring-indigo-500/40"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        🖨 In
                      </a>
                    ) : (
                      <span
                        title="Đã thanh toán đầy đủ"
                        className="inline-block cursor-not-allowed rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:ring-slate-700"
                      >
                        🖨 In
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-[#eef3f9] font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <td className={cellCls} colSpan={8}>
                TỔNG CỘNG
              </td>
              <td className={numCls} title="Tổng kWh tiêu thụ các phòng">
                {formatThousand(String(sum((c) => c.kwh ?? 0)))} kWh
              </td>
              <td className={cellCls} colSpan={2}></td>
              <td className={moneyCls}>{fmt(sum((c) => c.rent))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.water))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.wifi))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.elec))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.penalty))}</td>
              <td className={moneyCls} title={`Tổng phụ phí ghi nhận trong tháng ${m} (thu trên phiếu tháng ${nextM})`}>
                {fmt(sum((c) => c.penaltyNow))}
              </td>
              <td className={moneyCls + " text-slate-900 dark:text-slate-100"}>{fmt(sum((c) => c.total))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.paid))}</td>
              <td className={moneyCls + (sum((c) => c.remain) > 0 ? " text-red-600 dark:text-red-400" : " text-emerald-600 dark:text-emerald-400")}>
                {fmt(sum((c) => c.remain))}
              </td>
              <td className={cellCls}></td>
            </tr>
            <tr className="h-6 bg-white dark:bg-slate-900">
              <td className="border-0" colSpan={21}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 lg:hidden">
        {items.length === 0 && (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-400 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
            Không có phòng nào khớp tìm kiếm.
          </p>
        )}
        {items.map(({ d, i, c }) => (
          <div
            key={d.room}
            className="rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60"
          >
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">Phòng {c.room}</span>
              <Badge c={c} />
              {c.remain > 0 ? (
                <a
                  href={`/phieu/${encodeURIComponent(ky)}/${encodeURIComponent(c.room)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-slate-200 transition hover:bg-indigo-50 hover:ring-indigo-200 dark:bg-slate-800 dark:text-indigo-400 dark:ring-slate-700"
                >
                  🖨 In phiếu
                </a>
              ) : (
                <span
                  title="Đã thanh toán đầy đủ"
                  className="ml-auto cursor-not-allowed rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-300 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:ring-slate-700"
                >
                  🖨 In phiếu
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
              {c.tenant ? (
                <button
                  onClick={() => setRoomModal(c.room)}
                  title="Xem / sửa thông tin người thuê"
                  className="font-medium text-slate-700 underline decoration-dotted underline-offset-2 transition hover:text-indigo-600 dark:text-slate-200 dark:hover:text-indigo-400"
                >
                  {c.tenant}
                </button>
              ) : (
                "Chưa có người thuê"
              )}
              {c.phone ? ` · ${c.phone}` : ""}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Số điện cũ</label>
                <input
                  type="number"
                  value={d.old_index}
                  onChange={(e) => set(d, "old_index", e.target.value)}
                  className={inputCls + " w-full text-left"}
                  placeholder={prevMap.has(d.room) ? "kWh" : "số lúc nhận phòng"}
                  title="Số điện cũ: có thể sửa (vd số công tơ lúc nhận phòng nếu mới vào ở giữa tháng)"
                />
              </div>
              <div>
                <label className={labelCls}>Ngày chốt số cũ</label>
                <DatePicker
                  value={d.old_date}
                  onChange={(v) => set(d, "old_date", v)}
                  className={dateCls + " w-full"}
                  ariaLabel="Ngày chốt số cũ"
                />
              </div>
              <div>
                <label className={labelCls}>Số điện mới</label>
                <input
                  type="number"
                  value={d.new_index}
                  onChange={(e) => set(d, "new_index", e.target.value)}
                  className={inputCls + " w-full text-left"}
                  placeholder={`cũ ${d.old_index || "—"}`}
                />
              </div>
              <div>
                <label className={labelCls}>Ngày chốt số mới</label>
                <DatePicker
                  value={d.close_date}
                  onChange={(v) => set(d, "close_date", v)}
                  className={dateCls + " w-full"}
                  ariaLabel="Ngày chốt số mới"
                />
              </div>
              <div>
                <label className={labelCls}>Ở từ ngày</label>
                <DatePicker
                  value={d.move_in}
                  onChange={(v) => set(d, "move_in", v)}
                  className={dateCls + " w-full"}
                  ariaLabel="Ở từ ngày"
                />
              </div>
              <div>
                <label className={labelCls}>Ở đến ngày</label>
                <DatePicker
                  value={d.move_out}
                  onChange={(v) => set(d, "move_out", v)}
                  className={dateCls + " w-full"}
                  ariaLabel="Ở đến ngày"
                />
              </div>
              <div>
                <label className={labelCls}>Đã thu</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={d.paid}
                  onChange={(e) => set(d, "paid", formatThousand(e.target.value))}
                  className={inputCls + " w-full text-left"}
                  placeholder="0"
                />
              </div>
              <div>
                <label className={labelCls}>Phụ phí (tháng {m})</label>
                <button
                  onClick={() => openPen(i)}
                  title={`Khách đêm / vi phạm / khách qua ở của tháng ${m} — sẽ thu trên phiếu tháng ${nextM}`}
                  className="w-full rounded-md border border-dashed border-indigo-300 px-2 py-1 text-left text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                >
                  {fmt(c.penaltyNow)}
                </button>
                {c.penaltyNow > 0 && (
                  <p className="mt-1 text-xs text-slate-400">→ sẽ thu trên phiếu tháng {nextM}</p>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm tabular-nums dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tiền phòng</span>
                <span>{fmt(c.rent)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Nước (tháng {prevM}){c.exempted?.includes("water") ? " · 🎁 miễn phí" : ""}</span>
                <span>{fmt(c.water)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Wifi+Rác (tháng {prevM}){c.exempted?.includes("wifi") ? " · 🎁 miễn phí" : ""}</span>
                <span>{fmt(c.wifi)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Điện (tháng {prevM}){c.kwh ? ` · ${c.kwh} kWh` : ""}{c.exempted?.includes("elec") ? " · 🎁 miễn phí" : ""}</span>
                <span>{fmt(c.elec)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Phụ phí (tháng {prevM}){c.exempted?.includes("penalty") ? " · 🎁 miễn phí" : ""}</span>
                <span>{fmt(c.penalty)}</span>
              </div>
              <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100">
                <span>Tổng</span>
                <span>{fmt(c.total)}</span>
              </div>
              <div className={"flex justify-between font-bold " + (c.remain > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                <span>Còn lại</span>
                <span>{fmt(c.remain)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="mb-3 mt-1 text-xs text-slate-400 dark:text-slate-500">
        Cột &quot;(tháng {prevM})&quot; tính theo dữ liệu tháng {prevM}. Nguyên tắc: tiền phòng thu
        theo tháng hiện tại; nước / wifi+rác / điện / khách đêm / vi phạm của tháng này ở sẽ được thu
        trên phiếu tháng sau. Cột &quot;Phụ phí (tháng {m})&quot; là phần tiền ghi nhận trong tháng này,
        bấm vào để nhập khách đêm / vi phạm / khách qua ở — sẽ xuất hiện trên phiếu tháng {nextM}.
      </p>

      {penView !== null &&
        (() => {
          const row = editing[penView];
          const pd = prevMap.get(row.room) ?? null;
          if (!pd) return null;
          const mode = guestModeOf(pd);
          const nights = guestNightRows(pd.guest_dates, mode);
          const v = Number(pd.violations) || 0;
          const q = normGuestDates(pd.guest_dates).length;
          const g = Number(pd.guest) > 0;
          const raw = guestNightMoney(pd.guest_dates, mode, v) + (g ? 500000 : 0);
          const cRow = computed[penView];
          const noPenalty = cRow.exempted?.includes("penalty");
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setPenView(null)}
            >
              <div
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="mb-1 flex items-start justify-between gap-3">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100">
                    Phụ phí tháng {prevM} · Phòng {row.room}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setPenView(null)}
                    aria-label="Đóng"
                    className="-mr-1 -mt-1 rounded px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  >
                    ✕
                  </button>
                </div>
                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                  Đã ghi nhận và thu trên phiếu tháng {m}. Xem để đối chiếu.
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Khách qua đêm</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {nights.length > 0 ? `${nights.length} đêm · ${q} người` : "0 đêm"}
                    </span>
                  </div>

                  {nights.length > 0 && (
                    <ul className="space-y-1 rounded-lg bg-slate-50 p-2 text-xs dark:bg-slate-800/60">
                      {nights.map((nr) => (
                        <li key={nr.date} className="flex items-start justify-between gap-3">
                          <span className="text-slate-600 dark:text-slate-300">
                            <span className="font-semibold">{isoToVi(nr.date)}</span>
                            {nr.people.length > 0 && (
                              <span className="text-slate-500 dark:text-slate-400">
                                {" · "}
                                {nr.people
                                  .map((g2) => (g2.name ? `${g2.name}${g2.relation ? ` (${g2.relation})` : ""}` : "—"))
                                  .join(", ")}
                              </span>
                            )}
                          </span>
                          <span
                            className={
                              nr.fee > 0
                                ? "shrink-0 font-semibold text-slate-800 dark:text-slate-100"
                                : "shrink-0 text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {nr.fee > 0 ? fmt(nr.fee) : "Miễn phí"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Khách ở trên 5 ngày</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {g ? "Có · +500.000đ" : "Không"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Vi phạm</span>
                    <span className="font-medium text-slate-800 dark:text-slate-100">
                      {v > 0 ? `${v} lần · ${fmt(v * 500000)}` : "Không"}
                    </span>
                  </div>

                  <div className="mt-3 flex justify-between border-t border-slate-200 pt-2 font-bold dark:border-slate-700">
                    <span className="text-slate-900 dark:text-slate-100">
                      {noPenalty ? "Tổng đã miễn" : "Tổng phụ phí"}
                    </span>
                    <span className={noPenalty ? "text-emerald-600 dark:text-emerald-400" : "text-slate-900 dark:text-slate-100"}>
                      {fmt(cRow.penalty)}
                    </span>
                  </div>
                  {noPenalty && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      🎁 Phòng được miễn phụ phí tháng {m} (ghi nhận: {fmt(raw)}).
                    </p>
                  )}
                </div>

                <p className="mt-4 rounded-lg bg-slate-50 p-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
                  Muốn sửa dữ liệu tháng {prevM}, hãy chọn tháng {prevM} ở thanh chọn tháng phía
                  trên rồi bấm cột &quot;Phụ phí (tháng {prevM})&quot;.
                </p>
              </div>
            </div>
          );
        })()}

      {pen &&
        (() => {
          const n = new Set(pen.dates.map((g) => g.date)).size;
          const v = Number(pen.violations) || 0;
          const q = pen.dates.length;
          const pc = guestNightMoney(pen.dates, pen.mode, v);
          const pd = prevMap.get(editing[pen.i].room) ?? null;
          const prevPc = guestNightMoney(pd?.guest_dates, guestModeOf(pd), Number(pd?.violations) || 0);
          const nBreak =
            pen.mode === "rieng"
              ? `${q} lượt người-đêm × 200.000đ = ${fmt(q * 200000)}`
              : "xếp theo ngày: đêm 1-2 miễn phí · đêm 3 = 200.000đ/người · đêm 4+ = 250.000đ/người/đêm";
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setPen(null)}
            >
              <div
                className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="mb-1 font-bold text-slate-900 dark:text-slate-100">
                  Khách đêm / vi phạm · Phòng {editing[pen.i].room}
                </h3>
                <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
                  Ghi nhận cho tháng {m} — sẽ được thu trên phiếu tháng {nextM}.
                </p>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Cách tính khách đêm
                    </label>
                    <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
                      <button
                        type="button"
                        onClick={() => setPen({ ...pen, mode: "chung" })}
                        className={"rounded-md px-2 py-1.5 text-sm font-semibold transition " + (pen.mode === "chung" ? "bg-white text-indigo-700 shadow ring-1 ring-indigo-200 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}
                      >
                        Option chung
                      </button>
                      <button
                        type="button"
                        onClick={() => setPen({ ...pen, mode: "rieng" })}
                        className={"rounded-md px-2 py-1.5 text-sm font-semibold transition " + (pen.mode === "rieng" ? "bg-white text-indigo-700 shadow ring-1 ring-indigo-200 dark:bg-slate-900 dark:text-indigo-300 dark:ring-slate-700" : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200")}
                      >
                        Option riêng
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      {pen.mode === "rieng"
                        ? "Mỗi ngày qua đêm tính 200.000đ/người, không miễn đêm đầu (dùng cho phòng 101 từ 01/10/2026)."
                        : "Xếp theo ngày: đêm 1-2 miễn phí; đêm 3 = 200.000đ/người; đêm 4+ = 250.000đ/người/đêm (nguyên tắc Điều 6)."}
                    </p>
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        Khách qua đêm (khách đêm)
                      </label>
                      {n > 0 && (
                        <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                          {n} đêm · {q} người · tiền = {fmt(pc - v * 500000)}
                        </span>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <DatePicker
                          value={isoToVi(pen.picker)}
                          onChange={(v) => setPen({ ...pen, picker: viToIso(v) ?? "" })}
                          className={inputCls + " w-full"}
                          ariaLabel="Ngày khách qua đêm"
                          min={`01/${ky.split("-")[1]}/${ky.split("-")[0]}`}
                          max={`${String(daysInMonth(ky)).padStart(2, "0")}/${ky.split("-")[1]}/${ky.split("-")[0]}`}
                        />
                        <input
                          type="text"
                          placeholder="Tên khách"
                          maxLength={40}
                          value={pen.name}
                          onChange={(e) => setPen({ ...pen, name: e.target.value })}
                          className={inputCls + " w-full"}
                        />
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          list="guest-relations"
                          placeholder="Mối quan hệ với người thuê"
                          maxLength={40}
                          value={pen.rel}
                          onChange={(e) => setPen({ ...pen, rel: e.target.value })}
                          className={inputCls + " w-full"}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const d = pen.picker;
                            if (!d) return;
                            setPen({
                              ...pen,
                              picker: "",
                              name: "",
                              rel: "",
                              dates: [...pen.dates, { date: d, name: pen.name.trim(), relation: pen.rel.trim() }]
                                .sort((a, b) => (a.date < b.date ? -1 : 1)),
                            });
                          }}
                          disabled={!pen.picker || pen.name.trim() === ""}
                          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          ＋ Thêm
                        </button>
                      </div>
                      <datalist id="guest-relations">
                        <option value="ông" />
                        <option value="bà" />
                        <option value="bố" />
                        <option value="mẹ" />
                        <option value="anh ruột" />
                        <option value="em ruột" />
                        <option value="chị ruột" />
                        <option value="cháu ruột" />
                        <option value="họ hàng" />
                        <option value="bạn (cùng giới)" />
                      </datalist>
                    </div>
                    {pen.dates.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {[...pen.dates].sort((a, b) => (a.date < b.date ? -1 : 1)).map((g) => {
                          const idx = pen.dates.findIndex(
                            (x) => x.date === g.date && x.name === g.name && x.relation === g.relation
                          );
                          return (
                            <span
                              key={`${g.date}-${g.name}-${g.relation}`}
                              className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300"
                            >
                              {guestChipLabel(g)}
                              <button
                                type="button"
                                onClick={() =>
                                  setPen({
                                    ...pen,
                                    dates: idx >= 0
                                      ? [...pen.dates.slice(0, idx), ...pen.dates.slice(idx + 1)]
                                      : pen.dates,
                                  })
                                }
                                className="font-bold text-indigo-400 transition hover:text-red-500"
                                title="Xóa người này"
                              >
                                ×
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                      Mỗi lần thêm là <strong className="font-semibold">1 người · 1 đêm</strong> ({q} lượt người-đêm trong {n} đêm).
                      2 người cùng 1 đêm → chọn cùng ngày và thêm 2 lần, mỗi lần 1 tên + 1 mối quan hệ.
                      {pen.mode === "chung" ? " Chung vẫn tính theo đêm (cùng đêm nhiều người = 1 đêm)." : ""}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                      Số lần vi phạm
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pen.violations}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setPen({ ...pen, violations: e.target.value })}
                      className={inputCls + " w-full"}
                    />
                  </div>
                  <div className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                    <input
                      type="checkbox"
                      id="guest-check"
                      checked={pen.guest}
                      onChange={(e) => setPen({ ...pen, guest: e.target.checked })}
                      className="mt-0.5 h-4 w-4 accent-indigo-600"
                    />
                    <label htmlFor="guest-check" className="text-sm text-slate-700 dark:text-slate-300">
                      Khách qua ở trên 5 ngày/tháng (người thân/bạn bè ở lại quá quy định Điều 6)
                      — tính thêm <span className="font-semibold text-indigo-700 dark:text-indigo-400">500.000đ</span>
                    </label>
                  </div>
                  <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                    {prevPc > 0 && (
                      <p className="text-slate-500 dark:text-slate-400">
                        Phiếu tháng {m} đang thu phần tháng {prevM}: khách đêm {rowNights(pd)}
                        {pd?.guest_dates?.length ? ` (${guestSummary(pd.guest_dates)})` : ""}, khách ở trên 5
                        ngày {pd?.guest ? 1 : 0}, vi phạm {pd?.violations} = {fmt(prevPc)}
                      </p>
                    )}
                    <p>Khách đêm: {q} lượt người-đêm ({n} đêm) · {nBreak}</p>
                    <p>Vi phạm: {v} × 500.000đ = {fmt(v * 500000)}</p>
                    {pen.guest && <p>Khách qua ở: + 500.000đ</p>}
                    <p className="pt-1 font-bold text-blue-900 dark:text-blue-300">
                      Sẽ thu trên phiếu tháng {nextM}: {fmt(pc + (pen.guest ? 500000 : 0))}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <button
                    onClick={() => setPen(null)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={() => {
                      const entries = [...pen.dates].sort((a, b) => (a.date < b.date ? -1 : 1));
                      const nDays = new Set(entries.map((g) => g.date)).size;
                      const next = editing.map((x, j) =>
                        j === pen.i
                          ? { ...x, guest_dates: entries, nights: String(nDays), guest_mode: pen.mode, violations: pen.violations, guest: pen.guest }
                          : x
                      );
                      setEditing(next);
                      setPen(null);
                      save(next);
                    }}
                    className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500"
                  >
                    Lưu
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {roomModal && <RoomInfoModal room={roomModal} onClose={() => setRoomModal(null)} />}
    </div>
  );
}
