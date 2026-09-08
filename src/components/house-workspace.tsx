"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { House } from "@/lib/types";
import { dataForKy, settingsData, getAuditLogs } from "@/app/actions";
import { pricesToMap } from "@/lib/calc";
import { setDirty } from "@/lib/dirty";
import MonthTable from "@/components/month-table";
import CaiDatTabs from "@/components/cai-dat-tabs";

type MonthData = Awaited<ReturnType<typeof dataForKy>>;
type SettingsData = Awaited<ReturnType<typeof settingsData>>;
type AuditLog = { id: number; ky: string | null; room: string | null; field: string; old_val: string | null; new_val: string | null; created_at: string };

function TableSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800"></div>
        ))}
      </div>
      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
        <div className="mb-3 h-6 w-56 animate-pulse rounded-lg bg-slate-200/70 dark:bg-slate-800"></div>
        <div className="space-y-2.5">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div
      className="space-y-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60"
      aria-hidden
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-10 animate-pulse rounded-md bg-slate-100 dark:bg-slate-800/60"></div>
      ))}
    </div>
  );
}

function BangTinhTab({ ky, onOpen, initial }: { ky: string; onOpen: (k: string) => void; initial: MonthData | null }) {
  const [data, setData] = useState<MonthData | null>(
    initial && initial.house && initial.house.cur_ky === ky && initial.rows.length > 0 ? initial : null
  );
  const reqKyRef = useRef<string | null>(null);

  useEffect(() => {
    if (reqKyRef.current === ky && data) return;
    reqKyRef.current = ky;
    setData(null);
    let live = true;
    dataForKy(ky).then((d) => {
      if (live) setData(d);
    });
    return () => {
      live = false;
    };
  }, [ky, data]);

  if (!data?.house) return <TableSkeleton />;
  return (
    <MonthTable
      key={ky}
      ky={ky}
      isCurrent={ky === data.house.cur_ky}
      house={data.house}
      prices={pricesToMap(data.prices)}
      rows={data.rows}
      prevRows={data.prevRows}
      minKy={data.minKy}
      onSelectMonth={onOpen}
    />
  );
}

const FIELD_LABELS: Record<string, string> = {
  new_index: "Chỉ số điện",
  close_date: "Ngày chốt",
  move_in: "Ngày vào ở",
  move_out: "Ngày kết thúc HĐ",
  nights: "Số đêm",
  violations: "Vi phạm",
  paid: "Đã đóng",
  tenant: "Người thuê",
  phone: "SĐT",
  occupancy: "Số người",
  contract_end: "Ngày kết thúc HĐ",
  tam_tru_date: "Ngày hoàn thành ĐKTT",
  deposit: "Tiền cọc",
  email: "Email",
};

function formatAuditVal(field: string, val: string | null): string {
  if (val === null || val === undefined || val === "") return "—";
  if (field === "paid" || field === "deposit") {
    const n = Number(val);
    return isNaN(n) ? val : new Intl.NumberFormat("vi-VN").format(n) + "đ";
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    const [y, m, d] = val.split("-");
    return `${d}/${m}/${y}`;
  }
  return val;
}

function AuditLogView({ logs, page }: { logs: AuditLog[]; page: number }) {
  const [search, setSearch] = useState("");
  const filtered = search
    ? logs.filter((e) => {
        const q = search.toLowerCase();
        return (
          (e.room || "").toLowerCase().includes(q) ||
          (e.ky || "").toLowerCase().includes(q) ||
          (FIELD_LABELS[e.field] || e.field).toLowerCase().includes(q) ||
          (formatAuditVal(e.field, e.old_val) || "").toLowerCase().includes(q) ||
          (formatAuditVal(e.field, e.new_val) || "").toLowerCase().includes(q)
        );
      })
    : logs;

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-700">
        <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        <input
          type="text"
          placeholder="Tìm kiếm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-300"
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">✕</button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
              <th className="w-12 border-r border-slate-200 px-3 py-2.5 text-center font-semibold dark:border-slate-700">#</th>
              <th className="border-r border-slate-200 px-4 py-2.5 font-semibold dark:border-slate-700">Thời gian</th>
              <th className="border-r border-slate-200 px-4 py-2.5 font-semibold dark:border-slate-700">Phòng</th>
              <th className="border-r border-slate-200 px-4 py-2.5 font-semibold dark:border-slate-700">Tháng</th>
              <th className="border-r border-slate-200 px-4 py-2.5 font-semibold dark:border-slate-700">Trường</th>
              <th className="border-r border-slate-200 px-4 py-2.5 font-semibold dark:border-slate-700">Cũ</th>
              <th className="px-4 py-2.5 font-semibold">Mới</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">Không tìm thấy kết quả.</td></tr>
            ) : filtered.map((e, i) => {
              const dt = new Date(e.created_at);
              const time = dt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
              const date = dt.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
              return (
                <tr key={e.id} className="transition hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                  <td className="border-r border-slate-200 px-3 py-2 text-center text-xs tabular-nums text-slate-400 dark:border-slate-700">{(page * 20) + i + 1}</td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-4 py-2 text-xs tabular-nums text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    {time}<br />{date}
                  </td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-4 py-2 font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">{e.room || "—"}</td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-4 py-2 text-slate-500 dark:border-slate-700 dark:text-slate-400">{e.ky || "—"}</td>
                  <td className="whitespace-nowrap border-r border-slate-200 px-4 py-2 text-slate-600 dark:border-slate-700 dark:text-slate-300">{FIELD_LABELS[e.field] || e.field}</td>
                  <td className="max-w-[200px] truncate border-r border-slate-200 px-4 py-2 text-red-500 line-through dark:border-slate-700">{formatAuditVal(e.field, e.old_val) || "—"}</td>
                  <td className="max-w-[200px] truncate px-4 py-2 font-medium text-emerald-600">{formatAuditVal(e.field, e.new_val) || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HouseWorkspace({
  house,
  initialMonth,
}: {
  house: House;
  initialMonth?: MonthData | null;
}) {
  const PAGE_SIZE = 20;
  const [tab, setTab] = useState<"bangtinh" | "lichsu" | "caidat">("bangtinh");
  const [ky, setKy] = useState(house.cur_ky);
  const [auditLogs, setAuditLogs] = useState<AuditLog[] | null>(null);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditLoading, setAuditLoading] = useState(false);
  const now = new Date();
  const currentKy = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [auditKyFilter, setAuditKyFilter] = useState<string>(currentKy);
  const [auditPage, setAuditPage] = useState(0);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (tab === "lichsu" && auditLogs === null) {
      getAuditLogs(PAGE_SIZE, 0, auditKyFilter || undefined).then((r) => {
        setAuditLogs(r.logs);
        setAuditTotal(r.total);
      });
    }
    if (tab === "caidat" && settings === null) settingsData().then(setSettings);
  }, [tab, auditLogs, settings, auditKyFilter]);

  function goToAuditPage(page: number) {
    if (auditLoading) return;
    setAuditLoading(true);
    setAuditPage(page);
    getAuditLogs(PAGE_SIZE, page * PAGE_SIZE, auditKyFilter || undefined).then((r) => {
      setAuditLogs(r.logs);
      setAuditTotal(r.total);
      setAuditLoading(false);
    });
  }

  function changeAuditFilter(val: string) {
    setAuditKyFilter(val);
    setAuditLogs(null);
    setAuditPage(0);
  }

  const availableMonths: { ky: string; label: string }[] = [];
  const curDate = new Date(house.cur_ky + "-01");
  for (let i = 0; i < 12; i++) {
    const d = new Date(curDate);
    d.setMonth(d.getMonth() - i);
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    availableMonths.push({ ky: m, label: `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}` });
  }

  function executeNav(p: { type: "tab"; value: "bangtinh" | "lichsu" | "caidat" } | { type: "month"; value: string } | { type: "home" }) {
    if (p.type === "tab") {
      setTab(p.value);
    } else if (p.type === "month") {
      setKy(p.value);
      setTab("bangtinh");
    } else {
      router.push("/");
    }
  }

  function requestNav(p: { type: "tab"; value: "bangtinh" | "lichsu" | "caidat" } | { type: "month"; value: string } | { type: "home" }) {
    setDirty(false);
    executeNav(p);
  }

  const tabCls = (a: boolean) =>
    "rounded-full px-4 py-1.5 text-sm font-semibold transition " +
    (a
      ? "bg-indigo-600 text-white shadow-sm shadow-indigo-200"
      : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200");

  return (
    <div>
      <div className="mb-5">
        <button
          onClick={() => requestNav({ type: "home" })}
          className="text-sm font-medium text-slate-400 transition hover:text-indigo-600 dark:hover:text-indigo-400"
        >
          ← Danh sách nhà trọ
        </button>
        <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{house.name}</h1>
            <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{house.address || "Chưa có địa chỉ"}</p>
          </div>
        </div>
        <div className="mt-4 inline-flex gap-1 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
          <button className={tabCls(tab === "bangtinh")} onClick={() => requestNav({ type: "tab", value: "bangtinh" })}>
            🧮 Bảng tính
          </button>
          <button className={tabCls(tab === "lichsu")} onClick={() => requestNav({ type: "tab", value: "lichsu" })}>
            🕘 Lịch sử
          </button>
          <button className={tabCls(tab === "caidat")} onClick={() => requestNav({ type: "tab", value: "caidat" })}>
            ⚙️ Cài đặt
          </button>
        </div>
      </div>

      {tab === "bangtinh" && <BangTinhTab key={ky} ky={ky} onOpen={(k) => requestNav({ type: "month", value: k })} initial={initialMonth ?? null} />}

      {tab === "lichsu" && (
        <>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="text-slate-500 dark:text-slate-400">Tháng:</span>
            <select
              value={auditKyFilter}
              onChange={(e) => changeAuditFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              <option value="">Tất cả</option>
              {availableMonths.map((m) => (
                <option key={m.ky} value={m.ky}>
                  {m.label}
                </option>
              ))}
            </select>
            {auditTotal > 0 && (
              <span className="text-slate-400 dark:text-slate-500">{auditTotal} bản ghi</span>
            )}
          </div>
          {auditLogs === null ? (
            <RowsSkeleton />
          ) : auditLogs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Không có thay đổi nào.</p>
          ) : (
            <>
              <AuditLogView logs={auditLogs} page={auditPage} />
              {auditTotal > PAGE_SIZE && (
                <div className="mt-4 flex items-center justify-center gap-1">
                  <button
                    onClick={() => goToAuditPage(auditPage - 1)}
                    disabled={auditPage === 0 || auditLoading}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    ←
                  </button>
                  {Array.from({ length: Math.ceil(auditTotal / PAGE_SIZE) }, (_, i) => i)
                    .filter((p) => {
                      const total = Math.ceil(auditTotal / PAGE_SIZE);
                      return p === 0 || p === total - 1 || Math.abs(p - auditPage) <= 1;
                    })
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && arr[idx - 1] !== p - 1 && (
                          <span className="px-1 text-slate-300 dark:text-slate-600">…</span>
                        )}
                        <button
                          onClick={() => goToAuditPage(p)}
                          disabled={auditLoading}
                          className={`min-w-[32px] rounded-lg px-2 py-1.5 text-sm font-medium transition ${
                            p === auditPage
                              ? "bg-indigo-600 text-white"
                              : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                          }`}
                        >
                          {p + 1}
                        </button>
                      </span>
                    ))}
                  <button
                    onClick={() => goToAuditPage(auditPage + 1)}
                    disabled={(auditPage + 1) * PAGE_SIZE >= auditTotal || auditLoading}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                  >
                    →
                  </button>
                </div>
              )}
            </>
          )}
      </>
      )}

      {tab === "caidat" &&
        (settings?.house ? (
          <CaiDatTabs
            house={settings.house}
            prices={settings.prices}
            rooms={settings.rooms}
            contracts={settings.contracts}
            me={
              settings.me ?? { id: 0, email: "", name: "", is_admin: false }
            }
            users={settings.users}
          />
        ) : (
          <RowsSkeleton />
        ))}
    </div>
  );
}
