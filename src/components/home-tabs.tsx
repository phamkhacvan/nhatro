"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { fmt, displayKy } from "@/lib/calc";
import { createHouse } from "@/app/actions";

type HouseData = {
  id: number;
  name: string;
  address: string;
  cur_ky: string;
  revenue: number;
  paid: number;
  cumRevenue: number;
  cumPaid: number;
  people: number;
  roomCount: number;
  occupied: number;
};

const GRADS = [
  "from-blue-600 to-indigo-600",
  "from-cyan-500 to-teal-600",
  "from-emerald-500 to-green-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-indigo-500 to-violet-600",
  "from-fuchsia-500 to-purple-600",
  "from-orange-500 to-red-600",
];

function SectionLabel({ icon, title, sub, actions }: { icon: string; title: string; sub: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-xl shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">{sub}</p>
        </div>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

function RevenuePanel({
  totalRev,
  totalPaid,
  totalCumRevenue,
  totalCumPaid,
  totalPeople,
  occupied,
  totalRooms,
  kyLabel,
}: {
  totalRev: number;
  totalPaid: number;
  totalCumRevenue: number;
  totalCumPaid: number;
  totalPeople: number;
  occupied: number;
  totalRooms: number;
  kyLabel: string;
}) {
  const remain = totalRev - totalPaid;
  const cumRate = totalCumRevenue > 0 ? Math.round((totalCumPaid / totalCumRevenue) * 100) : 0;
  const tiles = [
    { label: `Đã thu tháng ${kyLabel}`, value: fmt(totalPaid), icon: "✅" },
    { label: `Còn phải thu tháng ${kyLabel}`, value: fmt(Math.max(remain, 0)), icon: "⏳" },
    { label: "Người ở", value: String(totalPeople), icon: "👥" },
    { label: "Phòng", value: `${occupied}/${totalRooms}`, icon: "🚪" },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-lg shadow-indigo-200/60 sm:p-8 dark:shadow-none">
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 left-1/3 h-56 w-56 rounded-full bg-violet-400/20 blur-2xl" />
      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-200">Tổng doanh thu luỹ kế · tất cả tháng</p>
          <p className="mt-2 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{fmt(totalCumRevenue)}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              Tháng {kyLabel}: <span className="tabular-nums">{fmt(totalRev)}</span>
            </span>
            <span className="text-xs text-indigo-100">
              Đã thu luỹ kế <span className="font-bold tabular-nums">{fmt(totalCumPaid)}</span> ·{" "}
              Còn phải thu luỹ kế <span className="font-bold tabular-nums">{fmt(Math.max(totalCumRevenue - totalCumPaid, 0))}</span> ·{" "}
              <span className="font-semibold">{cumRate}%</span>
            </span>
          </div>
          <div className="mt-4 max-w-md">
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-indigo-100">Đã thu luỹ kế</span>
              <span className="font-semibold">{cumRate}%</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-white" style={{ width: `${Math.max(cumRate, 2)}%` }} />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:w-1/2">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15 backdrop-blur-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-100">{t.label}</p>
              <p className="mt-1.5 text-lg font-bold tabular-nums">{t.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function HouseCard({ h, active, idx }: { h: HouseData; active: number; idx: number }) {
  const rate = h.revenue > 0 ? Math.min(100, Math.round((h.paid / h.revenue) * 100)) : 0;
  const grad = GRADS[idx % GRADS.length];
  const isActive = h.id === active;

  return (
    <Link
      href={`/nha/${h.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:ring-indigo-200 dark:bg-slate-900 dark:ring-slate-700/60 dark:hover:ring-indigo-500/40"
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${grad} opacity-70`} />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${grad} text-lg font-bold text-white shadow-sm`}
          >
            {h.name.charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-900 dark:text-slate-100">{h.name}</p>
            <p className="truncate text-sm text-slate-500 dark:text-slate-400">{h.address || "Chưa có địa chỉ"}</p>
          </div>
        </div>
        {isActive && (
          <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
            Đang dùng
          </span>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Doanh thu</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(h.revenue)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Luỹ kế</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{fmt(h.cumRevenue)}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Người ở</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">{h.people}</p>
        </div>
        <div className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/60">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Phòng</p>
          <p className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
            {h.occupied}/{h.roomCount}
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="text-slate-400 dark:text-slate-500">Thu tiền tháng {displayKy(h.cur_ky)}</span>
          <span className={"font-semibold " + (rate >= 100 ? "text-emerald-600 dark:text-emerald-400" : rate >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-500")}>
            {rate}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${rate >= 100 ? "from-emerald-500 to-teal-500" : rate >= 50 ? "from-amber-400 to-orange-500" : "from-red-400 to-rose-500"}`}
            style={{ width: `${Math.max(rate, 2)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
        <span className="text-xs text-slate-400 dark:text-slate-500">Đã thu {fmt(h.paid)}</span>
        <span className="text-sm font-semibold text-indigo-600 opacity-80 transition group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-indigo-400">
          Quản lý →
        </span>
      </div>
    </Link>
  );
}

export default function HomeTabs({ active, houses, totalCumRevenue = 0, totalCumPaid = 0 }: { active: number; houses: HouseData[]; totalCumRevenue?: number; totalCumPaid?: number }) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formState, formAction, formPending] = useActionState(createHouse, null);

  const totalRev = houses.reduce((a, h) => a + h.revenue, 0);
  const totalPaid = houses.reduce((a, h) => a + h.paid, 0);
  const totalPeople = houses.reduce((a, h) => a + h.people, 0);
  const totalRooms = houses.reduce((a, h) => a + h.roomCount, 0);
  const occupied = houses.reduce((a, h) => a + h.occupied, 0);
  const kyLabel = houses[0]?.cur_ky ?? (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  const q = query.trim().toLowerCase();
  const filtered = q
    ? houses.filter((h) => h.name.toLowerCase().includes(q) || (h.address || "").toLowerCase().includes(q))
    : houses;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Tổng quan</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Doanh thu và nhà trọ của bạn · tháng {displayKy(kyLabel)}
        </p>
      </div>

      <section>
        <SectionLabel icon="💵" title="Doanh thu" sub={`Tháng ${displayKy(kyLabel)} · tổng hợp tất cả nhà trọ`} />
        <RevenuePanel
          totalRev={totalRev}
          totalPaid={totalPaid}
          totalCumRevenue={totalCumRevenue}
          totalCumPaid={totalCumPaid}
          totalPeople={totalPeople}
          occupied={occupied}
          totalRooms={totalRooms}
          kyLabel={displayKy(kyLabel)}
        />
      </section>

      <section className="mt-10">
        <SectionLabel
          icon="🏠"
          title="Quản lý nhà trọ"
          sub={`${filtered.length} nhà trọ`}
          actions={
            <>
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Tìm nhà trọ..."
                  className="w-56 rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
                />
              </div>
              <button
                onClick={() => setShowForm((v) => !v)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 active:scale-95"
              >
                {showForm ? "✕ Đóng" : "+ Thêm nhà trọ"}
              </button>
            </>
          }
        />

        {showForm && (
          <form
            action={formAction}
            className="mb-6 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-indigo-200/60 sm:flex-row sm:flex-wrap dark:bg-slate-900 dark:ring-indigo-500/30"
          >
            <input
              name="name"
              required
              placeholder="Tên nhà trọ (vd: Nhà trọ Bình Thạnh)"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            />
            <input
              name="address"
              placeholder="Địa chỉ (tuỳ chọn)"
              className="flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            />
            <button
              type="submit"
              disabled={formPending}
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {formPending ? "Đang tạo…" : "Tạo nhà"}
            </button>
            {formState?.error && (
              <p className="w-full text-sm font-medium text-red-500">{formState.error}</p>
            )}
          </form>
        )}

        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-white py-16 text-center shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
            <p className="text-4xl">🏠</p>
            <p className="mt-3 font-semibold text-slate-700 dark:text-slate-300">
              {houses.length === 0 ? "Chưa có nhà trọ nào" : "Không tìm thấy nhà nào"}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {houses.length === 0 ? 'Bấm "+ Thêm nhà trọ" để bắt đầu quản lý.' : "Thử tìm kiếm với từ khoá khác."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((h, i) => (
              <HouseCard key={h.id} h={h} active={active} idx={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}