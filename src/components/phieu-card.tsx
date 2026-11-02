"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import { House, ComputedRow } from "@/lib/types";
import { fmt, guestDayVi, guestNightRows } from "@/lib/calc";
import { showToast } from "@/components/toast";

type Item = { label: string; value: string; note: string };

export default function PhieuCard({
  house,
  c,
  items,
  qrUrl,
  reference,
  address,
  kyLabel,
  exSummary,
}: {
  house: House;
  c: ComputedRow;
  items: Item[];
  qrUrl: string | null;
  reference: string;
  address: string;
  kyLabel: string;
  exSummary?: string | null;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [img, setImg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function copyImage() {
    if (!cardRef.current || busy) return;
    setBusy(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        style: { margin: "0", padding: "0", borderRadius: "0" },
      });
      try {
        const blob = await (await fetch(dataUrl)).blob();
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast("success", "Đã copy ảnh phiếu — dán vào Zalo để gửi cho người thuê.");
      } catch {
        setImg(dataUrl);
      }
    } catch {
      showToast("error", "Không chụp được phiếu thu.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="no-print mb-3 flex justify-end">
        <button
          onClick={copyImage}
          disabled={busy}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Đang chụp..." : "📋 Copy ảnh phiếu"}
        </button>
      </div>

      <div ref={cardRef} className="phieu-card overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-5 py-4 text-center sm:px-8 sm:py-5">
          <h1 className="text-base font-bold tracking-wide text-white sm:text-lg">PHIẾU THU TIỀN TRỌ</h1>
          <p className="mt-0.5 text-xs font-medium text-indigo-100 sm:text-sm">Tháng {kyLabel}</p>
        </div>
        <div className="p-5 pt-4 sm:p-8 sm:pt-6">
          <p className="text-center text-[11px] leading-snug text-slate-400 sm:text-xs">{address}</p>

          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-[13px] sm:mt-5 sm:gap-y-1.5 sm:p-4 sm:text-sm">
            <span className="text-slate-500">Phòng</span>
            <span className="font-bold text-slate-900">{c.room}</span>
            <span className="text-slate-500">Người thuê</span>
            <span className="font-semibold text-slate-800">{c.tenant || "—"}</span>
            <span className="text-slate-500">SĐT</span>
            <span className="font-semibold text-slate-800">{c.phone || "—"}</span>
            <span className="text-slate-500">Số người</span>
            <span className="font-semibold text-slate-800">{c.occupancy}</span>
          </div>

          <table className="mt-3 w-full border-collapse text-[13px] sm:mt-5 sm:text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 text-[11px] uppercase tracking-wide text-slate-400 sm:text-xs">
                <th className="px-2 py-1.5 text-left font-semibold sm:px-3 sm:py-2">Khoản mục</th>
                <th className="px-2 py-1.5 text-right font-semibold sm:px-3 sm:py-2">Số tiền</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const isElec = it.label.startsWith("Tiền điện");
                return (
                  <tr key={it.label} className="border-b border-slate-100">
                    <td className="px-2 py-2 text-slate-700 sm:px-3 sm:py-2.5">
                      {it.label}{" "}
                      {it.note && (
                        <span
                          className={
                            isElec
                              ? "mt-0.5 block pl-0.5 text-[11px] font-medium leading-snug text-slate-500 sm:pl-1 sm:text-xs"
                              : "text-[11px] text-slate-400 sm:text-xs"
                          }
                        >
                          {it.note}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-medium tabular-nums text-slate-800 sm:px-3 sm:py-2.5">{it.value}</td>
                  </tr>
                );
              })}
              <tr className="bg-indigo-50">
                <td className="rounded-l-lg px-2 py-2.5 font-bold text-slate-900 sm:px-3 sm:py-3">TỔNG CỘNG</td>
                <td className="rounded-r-lg px-2 py-2.5 text-right text-[15px] font-bold tabular-nums text-indigo-700 sm:px-3 sm:py-3 sm:text-base">
                  {fmt(c.total)}
                </td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="px-2 py-1.5 text-slate-500 sm:px-3 sm:py-2">Đã thu</td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700 sm:px-3 sm:py-2">{fmt(c.paid)}</td>
              </tr>
              <tr>
                <td className="px-2 py-1.5 font-semibold text-slate-700 sm:px-3 sm:py-2">Còn lại</td>
                <td className={"px-2 py-1.5 text-right font-bold tabular-nums sm:px-3 sm:py-2 " + (c.remain > 0 ? "text-red-600" : "text-emerald-600")}>
                  {fmt(c.remain)}
                </td>
              </tr>
            </tbody>
          </table>

          {c.prevGuestDates.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 text-[12px] sm:mt-4 sm:text-[13px]">
              <div className="flex items-center justify-between border-b border-slate-200 bg-indigo-50/70 px-3 py-1.5">
                <span className="font-bold text-slate-800">
                  Diễn giải chi tiết phụ phí - khách qua đêm
                </span>
                <span className="font-semibold tabular-nums text-indigo-700">
                  {c.prevGuestMode === "rieng" ? "200.000đ/người/đêm" : ""}
                </span>
              </div>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-400">
                    <th className="px-3 py-1 text-left font-semibold">Ngày</th>
                    <th className="px-2 py-1 text-left font-semibold">Khách</th>
                    <th className="px-2 py-1 text-center font-semibold">Số người</th>
                    <th className="px-3 py-1 text-right font-semibold">Tiền đêm</th>
                  </tr>
                </thead>
                <tbody>
                  {guestNightRows(c.prevGuestDates, c.prevGuestMode).map((r, i) => (
                    <tr key={r.date} className={i % 2 === 1 ? "bg-slate-50/60" : ""}>
                      <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-500">{guestDayVi(r.date)}</td>
                      <td className="px-2 py-1.5 font-medium text-slate-800">
                        {r.people.map((p) => [p.name, p.relation].filter(Boolean).join(" · ") || "—").join(" + ")}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums text-slate-600">{r.people.length} người</td>
                      <td className="w-1/6 px-3 py-1.5 text-right tabular-nums text-slate-700">
                        {c.prevGuestMode === "chung" && r.fee === 0 ? "miễn phí" : fmt(r.fee)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {exSummary && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-center text-[12px] font-medium text-emerald-700 sm:text-[13px]">
              {exSummary}
            </div>
          )}

          <div className="mt-3 space-y-1 rounded-xl bg-slate-50 p-3 text-[13px] text-slate-600 sm:mt-5 sm:p-4 sm:text-sm">
            <p>🗓 Hạn thanh toán: {house.due_text}</p>
            <p>🏦 Chuyển khoản: {house.transfer_note}</p>
          </div>

          <div className="mt-4 flex justify-center sm:mt-6">
            {qrUrl ? (
              <img
                src={qrUrl}
                alt="QR chuyển khoản"
                width={130}
                height={130}
                className="rounded-xl border border-slate-200 p-1 sm:h-[180px] sm:w-[180px]"
              />
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-center text-[11px] text-amber-700 sm:text-xs">
                ⚠ Chưa cấu hình số tài khoản ngân hàng trong <strong>Cài đặt</strong>.<br />
                QR chưa hiển thị được số tiền cần chuyển.
              </div>
            )}
          </div>
          <p className="mt-1 text-center text-[11px] text-slate-400 sm:text-xs">Nội dung: {reference}</p>
          <p className="mt-3 text-center text-sm italic text-slate-400 sm:mt-5">Cảm ơn bạn đã thanh toán đúng hạn!</p>
        </div>
      </div>

      {img && (
        <div
          className="no-print fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/70 p-4"
          onClick={() => setImg(null)}
        >
          <div className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <img src={img} alt="Phiếu thu" className="w-full rounded-lg" />
            </div>
            <button
              onClick={() => setImg(null)}
              className="mt-3 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Đóng
            </button>
            <p className="mt-3 text-center text-xs text-slate-400">
              Trình duyệt này chưa hỗ trợ copy ảnh. Hãy <strong>nhấn giữ ảnh</strong> → chọn <strong>Copy</strong> → dán vào Zalo, hoặc
              chụp màn hình trực tiếp.
            </p>
          </div>
        </div>
      )}
    </>
  );
}