"use client";

import { ReactNode, useState, useEffect, useRef, useCallback } from "react";
import { House, MonthlyRow } from "@/lib/types";
import { computeRow, fmt, displayKy, penaltyFor, nextKy, prevKy, prorate, parseKy, isoToVi, viToIso, maskDate, formatThousand, parseThousand } from "@/lib/calc";
import { saveMonth } from "@/app/actions";
import { showToast } from "@/components/toast";
import RoomInfoModal from "@/components/room-info-modal";
import MonthSelector from "@/components/month-selector";
import { setDirty, useDirty } from "@/lib/dirty";

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
  washing_machine: boolean;
  paid: string;
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
    washing_machine: Boolean(r.washing_machine),
    paid: r.paid == null ? "" : formatThousand(String(r.paid)),
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
    nights: Number(d.nights) || 0,
    violations: Number(d.violations) || 0,
    guest: d.guest ? 1 : 0,
    washing_machine: d.washing_machine,
    paid: parseThousand(d.paid),
  };
}

type SortKey =
  | "room" | "tenant" | "phone" | "occupancy"
  | "old_index" | "old_date" | "new_index" | "close_date" | "kwh"
  | "move_in" | "move_out"
  | "rent" | "water" | "wifi" | "elec" | "penalty"
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
  onSaved?: () => void;
};

export default function MonthTable({ ky, isCurrent, house, prices, rows, prevRows = [], minKy = null, onSelectMonth, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(rows.map(toDraft));
  const [pen, setPen] = useState<{ i: number; nights: string; violations: string; guest: boolean } | null>(null);
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
    setPen({ i, nights: d.nights, violations: d.violations, guest: d.guest });
  }

  function set(r: Draft, key: keyof Draft, val: string) {
    setEditing((prev) => prev.map((x) => (x.room === r.room ? { ...x, [key]: val } : x)));
  }

  const computed = editing.map((d) => {
    const c = computeRow(house, prices, toRow(ky, d), prevMap.get(d.room) ?? null);
    const occ = Math.max(Number(d.occupancy) || 0, d.guest ? 2 : 0);
    const waterPerHead = d.washing_machine ? 150000 : Number(house.water_rate);
    const nextBill =
      prorate(occ * waterPerHead, ky, d.move_in || null, d.move_out || null).amount +
      prorate(occ * Number(house.wifi_rate), ky, d.move_in || null, d.move_out || null).amount +
      (c.kwh != null ? c.kwh * Number(house.elec_rate) : 0) +
      penaltyFor(Number(d.nights) || 0, Number(d.violations) || 0) +
      (d.guest ? 500000 : 0);
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
    const bad = data.find(
      (d) =>
        (d.old_date !== "" && !viToIso(d.old_date)) ||
        (d.close_date !== "" && !viToIso(d.close_date)) ||
        (d.move_in !== "" && !viToIso(d.move_in)) ||
        (d.move_out !== "" && !viToIso(d.move_out))
    );
    if (bad) {
      showToast("error", `Ngày ở phòng ${bad.room} chưa đúng định dạng dd/mm/yyyy.`);
      return Promise.resolve(false);
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
            onSaved?.();
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
    "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60";

  return (
    <div>
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Phải thu tháng {parseKy(ky).m}</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(sum((c) => c.total))}</p>
        </div>
        <div className={statCardCls}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Đã đóng</p>
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

      <div className="hidden overflow-x-auto rounded-2xl bg-white pb-4 shadow-sm ring-1 ring-slate-200/60 lg:block dark:bg-slate-900 dark:ring-slate-700/60">
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
            <tr className="border-b-2 border-slate-300 bg-white text-xs font-bold uppercase tracking-wide text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100">
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
              {thSort("total", "Tổng", moneyCls)}
              {thSort("paid", "Đã đóng", moneyCls)}
              {thSort("remain", "Còn lại", moneyCls)}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={20} className="px-4 py-8 text-center text-sm text-slate-400">
                  Không có phòng nào khớp tìm kiếm.
                </td>
              </tr>
            )}
            {items.map(({ d, i, c }) => {
              const rowBg = i % 2 ? "bg-slate-50/60 dark:bg-slate-800/40" : "bg-white dark:bg-slate-900";
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
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={d.old_date}
                      onChange={(e) => set(d, "old_date", maskDate(e.target.value))}
                      className={dateCls}
                      placeholder="dd/mm/yyyy"
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
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={d.close_date}
                      onChange={(e) => set(d, "close_date", maskDate(e.target.value))}
                      className={dateCls}
                      placeholder="dd/mm/yyyy"
                    />
                  </td>
                  <td className={numCls + " font-bold dark:text-slate-100"}>{c.kwh || ""}</td>
                  <td className={cellCls}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={d.move_in}
                      onChange={(e) => set(d, "move_in", maskDate(e.target.value))}
                      className={dateCls}
                      placeholder="dd/mm/yyyy"
                    />
                  </td>
                  <td className={cellCls}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      value={d.move_out}
                      onChange={(e) => set(d, "move_out", maskDate(e.target.value))}
                      className={dateCls}
                      placeholder="dd/mm/yyyy"
                    />
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>
                    {fmt(c.rent)}
                    {c.rentNote && <div className="text-xs font-normal text-slate-400">{c.rentNote}</div>}
                  </td>
                  <td className={moneyCls + " dark:text-slate-300"}>{fmt(c.water)}</td>
                  <td className={moneyCls + " dark:text-slate-300"}>{fmt(c.wifi)}</td>
                  <td className={moneyCls + " dark:text-slate-300"}>{fmt(c.elec)}</td>
                  <td className={moneyCls}>
                    <button
                      onClick={() => openPen(i)}
                      title="Nhập phụ phí (khách đêm / vi phạm)"
                      className="font-medium text-indigo-700 underline decoration-dotted underline-offset-2 transition hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                    >
                      {fmt(c.penalty)}
                    </button>
                    {c.penalty > 0 && (
                      <div className="text-xs font-normal text-slate-400">
                        {c.prevNights > 0 || c.prevViolations > 0 || c.hasGuest ? (
                          `khách đêm: ${c.prevNights}, khách ở trên 5 ngày: ${c.hasGuest ? 1 : 0}, vi phạm: ${c.prevViolations}`
                        ) : null}
                      </div>
                    )}
                    {(Number(d.nights) > 0 || Number(d.violations) > 0) && (
                      <div className="text-xs font-normal text-indigo-500 dark:text-indigo-400">
                        → thu tháng {nextM}: khách đêm {d.nights} · vi phạm {d.violations} = {fmt(penaltyFor(Number(d.nights) || 0, Number(d.violations) || 0))}
                      </div>
                    )}
                    {d.guest && (
                      <div className="text-xs font-normal text-indigo-500 dark:text-indigo-400">
                        → thu tháng {nextM}: khách qua ở + 500k
                      </div>
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
                      placeholder="đã đóng"
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
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
              <td className={cellCls} colSpan={11}>
                TỔNG CỘNG
              </td>
              <td className={moneyCls}>{fmt(sum((c) => c.rent))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.water))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.wifi))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.elec))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.penalty))}</td>
              <td className={moneyCls + " text-slate-900 dark:text-slate-100"}>{fmt(sum((c) => c.total))}</td>
              <td className={moneyCls}>{fmt(sum((c) => c.paid))}</td>
              <td className={moneyCls + (sum((c) => c.remain) > 0 ? " text-red-600 dark:text-red-400" : " text-emerald-600 dark:text-emerald-400")}>
                {fmt(sum((c) => c.remain))}
              </td>
              <td className={cellCls}></td>
            </tr>
            <tr className="h-6 bg-white dark:bg-slate-900">
              <td className="border-0" colSpan={20}></td>
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
            className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60"
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
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={d.old_date}
                  onChange={(e) => set(d, "old_date", maskDate(e.target.value))}
                  className={dateCls + " w-full"}
                  placeholder="dd/mm/yyyy"
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
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={d.close_date}
                  onChange={(e) => set(d, "close_date", maskDate(e.target.value))}
                  className={dateCls + " w-full"}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label className={labelCls}>Ở từ ngày</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={d.move_in}
                  onChange={(e) => set(d, "move_in", maskDate(e.target.value))}
                  className={dateCls + " w-full"}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label className={labelCls}>Ở đến ngày</label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={d.move_out}
                  onChange={(e) => set(d, "move_out", maskDate(e.target.value))}
                  className={dateCls + " w-full"}
                  placeholder="dd/mm/yyyy"
                />
              </div>
              <div>
                <label className={labelCls}>Đã đóng</label>
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
                <label className={labelCls}>Phụ phí (khách đêm/vi phạm)</label>
                <button
                  onClick={() => openPen(i)}
                  className="w-full rounded-md border border-dashed border-indigo-300 px-2 py-1 text-left text-sm font-medium text-indigo-700 transition hover:bg-indigo-50 dark:border-indigo-500/40 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
                >
                  {fmt(c.penalty)}
                </button>
                {c.penalty > 0 && (
                  <p className="mt-1 text-xs text-slate-400">
                    {`tháng ${prevM}: khách đêm: ${c.prevNights}, khách ở trên 5 ngày: ${c.hasGuest ? 1 : 0}, vi phạm: ${c.prevViolations}`}
                  </p>
                )}
                {(Number(d.nights) > 0 || Number(d.violations) > 0) && (
                  <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">
                    → thu tháng {nextM}: {d.nights} đêm · {d.violations} lần = {fmt(penaltyFor(Number(d.nights) || 0, Number(d.violations) || 0))}
                  </p>
                )}
                {d.guest && (
                  <p className="mt-1 text-xs text-indigo-500 dark:text-indigo-400">
                    → thu tháng {nextM}: khách qua ở + 500k
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm tabular-nums dark:border-slate-800">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Tiền phòng</span>
                <span>{fmt(c.rent)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Nước (tháng {prevM})</span>
                <span>{fmt(c.water)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Wifi+Rác (tháng {prevM})</span>
                <span>{fmt(c.wifi)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Điện (tháng {prevM}){c.kwh ? ` · ${c.kwh} kWh` : ""}</span>
                <span>{fmt(c.elec)}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Phụ phí (tháng {prevM})</span>
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
        trên phiếu tháng sau. Dòng &quot;→ thu tháng {nextM}&quot; dưới Tổng là phần tiền ghi nhận
        tháng này, sẽ xuất hiện trên phiếu tháng {nextM}.
      </p>

      {pen &&
        (() => {
          const n = Number(pen.nights) || 0;
          const v = Number(pen.violations) || 0;
          const pc = penaltyFor(n, v);
          const pd = prevMap.get(editing[pen.i].room) ?? null;
          const prevPc = penaltyFor(Number(pd?.nights) || 0, Number(pd?.violations) || 0);
          const nBreak =
            n <= 2
              ? "Miễn phí 2 đêm đầu tiên"
              : `Đêm 3: 200.000đ` + (n > 3 ? ` + ${n - 3} đêm × 250.000đ = ${fmt(200000 + (n - 3) * 250000)}` : "");
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setPen(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
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
                      Số đêm khách (khách đêm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={pen.nights}
                      onFocus={(e) => e.currentTarget.select()}
                      onChange={(e) => setPen({ ...pen, nights: e.target.value })}
                      className={inputCls + " w-full"}
                    />
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
                        Phiếu tháng {m} đang thu phần tháng {prevM}: khách đêm {pd?.nights}, khách ở trên 5
                        ngày {pd?.guest ? 1 : 0}, vi phạm {pd?.violations} = {fmt(prevPc)}
                      </p>
                    )}
                    <p>Khách đêm: {n} đêm → {nBreak}</p>
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
                      const next = editing.map((x, j) =>
                        j === pen.i ? { ...x, nights: pen.nights, violations: pen.violations, guest: pen.guest } : x
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
