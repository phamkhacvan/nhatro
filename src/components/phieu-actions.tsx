"use client";

import { useState } from "react";
import { sendPhieuEmail, confirmPayment } from "@/app/actions";
import { fmt, formatThousand, parseThousand } from "@/lib/calc";
import { showToast } from "@/components/toast";

export default function PhieuActions({ ky, room, remain }: { ky: string; room: string; remain: number }) {
  const [busy, setBusy] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState(() => formatThousand(String(remain)));

  function send() {
    setBusy(true);
    sendPhieuEmail(ky, room)
      .then((res) => {
        setBusy(false);
        if (!res.ok) showToast("error", "Gửi email thất bại: " + (res.error || "lỗi không xác định"));
        else showToast("success", "Đã gửi email đến người thuê");
      })
      .catch((err) => {
        setBusy(false);
        showToast("error", "Gửi email thất bại: " + (err?.message || "lỗi không xác định"));
      });
  }

  function confirm() {
    const val = parseThousand(amount);
    if (val <= 0) {
      showToast("error", "Số tiền nhận phải lớn hơn 0.");
      return;
    }
    if (val > remain) {
      showToast("error", `Số tiền nhận không được vượt quá ${fmt(remain)} (còn thiếu).`);
      return;
    }
    setBusy(true);
    confirmPayment(ky, room, val)
      .then((res) => {
        setBusy(false);
        if (!res.ok) showToast("error", res.error || "Lỗi xác nhận");
        else {
          showToast(
            "success",
            (res.remain ?? 0) > 0
              ? `Đã nhận ${fmt(val)} — người thuê còn thiếu ${fmt(res.remain ?? 0)}.${res.emailSent ? " Email đã gửi cho người thuê." : " Người thuê chưa có email nên không gửi được thông báo."}`
              : `Đã nhận ${fmt(val)} — tổng ${fmt(res.paid ?? 0)} đầy đủ.${res.emailSent ? " Email đã gửi cho người thuê." : " Người thuê chưa có email nên không gửi được thông báo."}`
          );
          window.location.reload();
        }
      })
      .catch((err) => {
        setBusy(false);
        showToast("error", "Lỗi xác nhận: " + (err?.message || "lỗi không xác định"));
      });
  }

  return (
    <div className="no-print mb-4 flex items-center justify-between">
      <a href={`/thang/${ky}`} className="text-sm font-medium text-slate-400 transition hover:text-indigo-600">
        ← Quay lại bảng tính
      </a>
      <div className="flex gap-2">
        {remain > 0 && (
          <button
            onClick={() => {
              setAmount(formatThousand(String(remain)));
              setPayOpen(true);
            }}
            disabled={busy}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-50"
          >
            {busy ? "Đang xử lý..." : "✓ Đã nhận tiền"}
          </button>
        )}
        <button
          onClick={send}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Đang gửi..." : "📧 Gửi email"}
        </button>
      </div>

      {payOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPayOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Nhận tiền phòng {room}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Còn thiếu {fmt(remain)}. Nhập số tiền nhận được thực tế — email thông báo cho người thuê.
            </p>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Số tiền nhận (đ)</label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                autoFocus
                onChange={(e) => setAmount(formatThousand(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-semibold tabular-nums focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
              <p className="mt-1 text-xs text-slate-400">Tối đa {fmt(remain)} — số còn thiếu.</p>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setPayOpen(false)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Hủy
              </button>
              <button
                onClick={confirm}
                disabled={busy}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-500 disabled:opacity-50"
              >
                {busy ? "Đang xử lý..." : `Xác nhận ${amount ? fmt(parseThousand(amount)) : ""}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}