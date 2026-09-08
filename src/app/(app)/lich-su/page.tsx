import Link from "next/link";
import { getAuditLogs } from "@/app/actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

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
  deposit: "Tiền cọc",
  email: "Email",
};

function formatVal(field: string, val: string): string {
  if (!val) return "—";
  if (field === "paid" || field === "deposit") {
    const n = Number(val);
    return isNaN(n) ? val : new Intl.NumberFormat("vi-VN").format(n) + "đ";
  }
  return val;
}

export default async function LichSuPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const sp = await searchParams;
  const wantPage = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  let res = await getAuditLogs(PAGE_SIZE, (wantPage - 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(res.total / PAGE_SIZE));
  const page = Math.min(wantPage, totalPages);
  if (page !== wantPage) {
    res = await getAuditLogs(PAGE_SIZE, (page - 1) * PAGE_SIZE);
  }
  const logs = res.logs;
  const total = res.total;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const grouped: Record<string, typeof logs> = {};
  for (const log of logs) {
    const date = new Date(log.created_at).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  }

  const pageBtn = (n: number, label: string, active = false, disabled = false) => {
    const cls =
      "min-w-9 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition " +
      (disabled
        ? "cursor-not-allowed text-slate-300 dark:text-slate-600"
        : active
          ? "bg-indigo-600 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-200/70 dark:text-slate-300 dark:hover:bg-slate-700/70");
    if (disabled) return <span key={label} className={cls}>{label}</span>;
    return active ? (
      <span key={label} className={cls}>{label}</span>
    ) : (
      <Link key={label} href={`/lich-su?page=${n}`} className={cls}>{label}</Link>
    );
  };
  const pages: (number | "…")[] = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) pages.push(i);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }

  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <h1 className="text-lg font-bold text-blue-900 dark:text-indigo-400">Nhật ký thay đổi</h1>
        {total > 0 && (
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {from}–{to} / <strong className="font-semibold text-slate-600 dark:text-slate-300">{total}</strong> bản ghi
          </span>
        )}
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">Chưa có thay đổi nào được ghi nhận.</p>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, entries]) => (
            <div key={date}>
              <h2 className="mb-2 text-sm font-bold text-slate-600 dark:text-slate-400">{date}</h2>
              <div className="overflow-hidden rounded-xl bg-white shadow dark:bg-slate-900">
                {entries.map((e, i) => {
                  const time = new Date(e.created_at).toLocaleTimeString("vi-VN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  return (
                    <div
                      key={e.id ?? i}
                      className={"flex items-start gap-3 px-4 py-2.5 text-sm" + (i < entries.length - 1 ? " border-b border-slate-100 dark:border-slate-800" : "")}
                    >
                      <span className="mt-0.5 shrink-0 text-xs tabular-nums text-slate-400">{time}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">{e.room}</span>
                        {e.ky && (
                          <span className="ml-1.5 text-xs text-slate-400">tháng {e.ky}</span>
                        )}
                        <span className="ml-2 text-slate-500 dark:text-slate-400">
                          {FIELD_LABELS[e.field] || e.field}
                        </span>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-red-500 line-through">{formatVal(e.field, e.old_val)}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <span className="font-medium text-emerald-600">{formatVal(e.field, e.new_val)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-1.5">
          {pageBtn(page - 1, "← Trước", false, page <= 1)}
          {pages.map((p, i) => (p === "…" ? <span key={`dots-${i}`}>…</span> : pageBtn(p, String(p), p === page)))}
          {pageBtn(page + 1, "Sau →", false, page >= totalPages)}
        </div>
      )}
    </div>
  );
}