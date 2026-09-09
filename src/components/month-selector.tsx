"use client";

import { setCurrentMonth } from "@/app/actions";
import { parseKy, formatKy, nextKy } from "@/lib/calc";

export default function MonthSelector({
  ky,
  setCurrent = false,
  minKy = null,
  onSelect,
}: {
  ky: string;
  setCurrent?: boolean;
  minKy?: string | null;
  onSelect?: (ky: string) => void;
}) {
  const { m, y } = parseKy(ky);
  const now = new Date();
  const realYear = now.getFullYear();
  const realMonth = now.getMonth() + 1;
  const years = [...new Set([y - 1, y, y + 1])]
    .sort((a, b) => a - b)
    .filter((yy) => yy <= realYear);
  const maxMonthFor = (yy: number) => (yy === realYear ? realMonth : 12);

  function go(mm: number, yy: number) {
    const nk = formatKy(mm, yy);
    if (nk === ky) return;
    if (minKy && nk < minKy) return;
    if (nk > formatKy(realMonth, realYear)) return;
    if (setCurrent && nk === nextKy(ky)) setCurrentMonth(nk).catch(() => {});
    if (onSelect) {
      onSelect(nk);
      return;
    }
  }

  function blocked(mm: number, yy: number) {
    if (minKy && formatKy(mm, yy) < minKy) return true;
    return formatKy(mm, yy) > formatKy(realMonth, realYear);
  }

  const mm = Math.min(m, maxMonthFor(y)) || 1;

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-medium text-slate-600 dark:text-slate-300">Tháng</span>
      <select
        value={mm}
        onChange={(e) => go(Number(e.target.value), y)}
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {Array.from({ length: maxMonthFor(y) }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n} disabled={blocked(n, y)}>
            {n}
          </option>
        ))}
      </select>
      <span className="font-medium text-slate-600 dark:text-slate-300">Năm</span>
      <select
        value={y}
        onChange={(e) => go(mm, Number(e.target.value))}
        className="rounded border border-slate-300 bg-white px-2 py-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {years.map((yy) => (
          <option key={yy} value={yy} disabled={blocked(mm, yy)}>
            {yy}
          </option>
        ))}
      </select>
    </div>
  );
}