import { fmt } from "@/lib/calc";

type MonthSummary = { ky: string; total: number; paid: number; count: number };

function short(v: number) {
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1).replace(".", ",") + "tr";
  if (v > 0) return Math.round(v / 1000) + "k";
  return "0";
}

function label(ky: string) {
  const [, m] = ky.split("-");
  return "T" + Number(m);
}

export default function RevenueChart({ months }: { months: MonthSummary[] }) {
  const data = [...months].sort((a, b) => a.ky.localeCompare(b.ky)).slice(-12);
  if (data.length === 0) return null;
  const max = Math.max(...data.map((x) => Math.max(x.total, x.paid)), 1);

  return (
    <div className="mb-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Doanh thu theo tháng</h2>
        <div className="flex items-center gap-4 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-indigo-500"></span> Phải thu
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500"></span> Đã đóng
          </span>
        </div>
      </div>
      <div className="overflow-x-auto pb-1">
        <div className="flex min-w-[480px] items-end gap-2">
          {data.map((mo) => {
            const th = Math.max((mo.total / max) * 100, mo.total > 0 ? 3 : 0);
            const ph = Math.max((mo.paid / max) * 100, mo.paid > 0 ? 3 : 0);
            const due = Math.max(0, mo.total - mo.paid);
            return (
              <div key={mo.ky} className="group flex min-w-0 flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold tabular-nums text-slate-400 opacity-0 transition group-hover:opacity-100 dark:text-slate-500">
                  {short(mo.total)}
                </span>
                <div className="flex h-44 w-full items-end justify-center gap-[3px]">
                  <div
                    title={`Phải thu: ${fmt(mo.total)}`}
                    style={{ height: `${th}%` }}
                    className={
                      "w-1/2 max-w-[22px] rounded-t-md bg-indigo-500 transition group-hover:bg-indigo-400 " +
                      (due > 0 && mo.total > 0 ? "" : "")
                    }
                  ></div>
                  <div
                    title={`Đã đóng: ${fmt(mo.paid)}`}
                    style={{ height: `${ph}%` }}
                    className="w-1/2 max-w-[22px] rounded-t-md bg-emerald-500 transition group-hover:bg-emerald-400"
                  ></div>
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">{label(mo.ky)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
