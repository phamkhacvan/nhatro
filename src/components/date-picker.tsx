"use client";

import { useEffect, useRef, useState } from "react";
import { maskDate, viToIso, isoToVi } from "@/lib/calc";

type YM = { m: number; y: number };

const pad = (n: number) => String(n).padStart(2, "0");

function todayIsoVN(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return `${get("year")}-${pad(get("month"))}-${pad(get("day"))}`;
}

function ymFromIso(iso: string | null): YM {
  if (iso && /^\d{4}-\d{2}$/.test(iso)) return { m: Number(iso.slice(5, 7)), y: Number(iso.slice(0, 4)) };
  const t = todayIsoVN();
  return { m: Number(t.slice(5, 7)), y: Number(t.slice(0, 4)) };
}

const DOW = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * Ô nhập ngày có lịch popup, hiển thị theo định dạng Việt Nam dd/mm/yyyy.
 * Giữ nguyên format giá trị dd/mm/yyyy như các ô nhập tay trước đây nên
 * logic validate/lưu ở component cha không phải đổi.
 * min/max nhận theo dd/mm/yyyy (đều tuỳ chọn).
 */
export default function DatePicker({
  value,
  onChange,
  className = "",
  placeholder = "dd/mm/yyyy",
  title,
  min = null,
  max = null,
  ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
  title?: string;
  min?: string | null;
  max?: string | null;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState<YM>(() => ymFromIso(value ? viToIso(value) : null));

  const curIso = value ? viToIso(value) : null;

  // giá trị đổi từ ngoài (reset form, chọn preset) -> lịch nhảy theo.
  // Chỉnh state trong render (React khuyến nghị) thay vì setState trong effect.
  const [lastVal, setLastVal] = useState(value);
  if (value !== lastVal) {
    setLastVal(value);
    const iso = value ? viToIso(value) : null;
    if (iso) setView(ymFromIso(iso));
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (inputRef.current?.parentElement?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // định vị popup dạng fixed để không bị cắt bởi overflow của bảng
  const place = () => {
    const el = inputRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const w = 268;
    const h = 306;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = Math.max(8, window.innerWidth - w - 8);
    let top = r.bottom + 4;
    if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 4);
    setPos({ top, left });
  };

  const openPop = () => {
    place();
    setOpen((o) => !o);
  };

  const minIso = min ? viToIso(min) : null;
  const maxIso = max ? viToIso(max) : null;

  const pick = (iso: string) => {
    if (minIso && iso < minIso) return;
    if (maxIso && iso > maxIso) return;
    onChange(isoToVi(iso));
    setOpen(false);
  };

  const first = new Date(Date.UTC(view.y, view.m - 1, 1));
  const startDow = (first.getUTCDay() + 6) % 7; // thứ 2 = 0
  const total = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: startDow }, () => null);
  for (let d = 1; d <= total; d++) cells.push(`${view.y}-${pad(view.m)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);

  const today = todayIsoVN();
  const shift = (dm: number) => {
    let m = view.m + dm;
    let y = view.y;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    setView({ m, y });
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        maxLength={10}
        aria-label={ariaLabel}
        value={value}
        title={title}
        placeholder={placeholder}
        onChange={(e) => onChange(maskDate(e.target.value))}
        onFocus={() => {
          place();
          setOpen(true);
        }}
        onBlur={(e) => {
          // nếu focus chuyển sang nút lịch thì giữ popup mở
          if (popRef.current?.contains(e.relatedTarget as Node)) return;
          setOpen(false);
        }}
        className={`${className} pr-7 ${open ? "ring-2 ring-blue-500/40" : ""}`}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="Mở lịch"
        title="Chọn ngày"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openPop}
        className="absolute right-0 top-0 flex h-full w-7 items-center justify-center text-slate-400 hover:text-blue-600 dark:text-slate-500 dark:hover:text-blue-400"
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
          <path
            fillRule="evenodd"
            d="M5.75 2a.75.75 0 01.75.75V4h6.5V2.75a.75.75 0 011.5 0V4h1.25A2.25 2.25 0 0117.75 6.25v9.5A2.25 2.25 0 0115.5 18h-11A2.25 2.25 0 012.25 15.75v-9.5A2.25 2.25 0 014.5 4h1.25V2.75A.75.75 0 015.75 2zM3.75 8v7.75c0 .14.11.25.25.25h11a.25.25 0 00.25-.25V8H3.75z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={popRef}
          style={{
            position: "fixed",
            top: pos?.top ?? 0,
            left: pos?.left ?? 0,
          }}
          className="z-[70] w-[268px] rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-800"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => shift(-1)}
              className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              aria-label="Tháng trước"
            >
              ‹
            </button>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Tháng {pad(view.m)}/{view.y}
            </span>
            <button
              type="button"
              onClick={() => shift(1)}
              className="rounded px-2 py-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-slate-100"
              aria-label="Tháng sau"
            >
              ›
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {DOW.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
            {cells.map((iso, i) => {
              if (!iso) return <div key={`e${i}`} />;
              const day = Number(iso.slice(8, 10));
              const disabled = Boolean((minIso && iso < minIso) || (maxIso && iso > maxIso));
              const selected = curIso === iso;
              const isToday = today === iso;
              return (
                <button
                  key={iso}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(iso)}
                  className={[
                    "rounded py-1.5",
                    selected
                      ? "bg-blue-600 font-semibold text-white"
                      : disabled
                        ? "text-slate-300 dark:text-slate-600"
                        : "text-slate-700 hover:bg-blue-50 dark:text-slate-200 dark:hover:bg-slate-700",
                    isToday && !selected ? "ring-1 ring-blue-400" : " ",
                  ].join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-slate-700">
            <button
              type="button"
              onClick={() => pick(today)}
              className="rounded px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700"
            >
              Hôm nay
            </button>
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="rounded px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              Xóa
            </button>
          </div>
        </div>
      )}
    </div>
  );
}