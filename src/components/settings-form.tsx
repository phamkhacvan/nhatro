"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { House } from "@/lib/types";
import { updateSettings, upsertPrices, getBanks } from "@/app/actions";
import { formatThousand, parseThousand } from "@/lib/calc";
import { showToast } from "@/components/toast";
import { Bank } from "@/lib/banks";

const label = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400";

function sKey(s: Record<string, string>, p: { occupancy: number; price: string }[]): string {
  return JSON.stringify({
    ...s,
    prices: p.map((x) => [x.occupancy, x.price]),
  });
}

export default function SettingsForm({
  house,
  prices,
}: {
  house: House;
  prices: { occupancy: number; price: number }[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [banks, setBanks] = useState<Bank[] | null>(null);
  const [s, setS] = useState<Record<string, string>>({
    ...(house as unknown as Record<string, string>),
    elec_rate: formatThousand(String(house.elec_rate ?? 0)),
    water_rate: formatThousand(String(house.water_rate ?? 0)),
    wifi_rate: formatThousand(String(house.wifi_rate ?? 0)),
  });
  const [p, setP] = useState<{ occupancy: number; price: string }[]>(() => {
    const base = [1, 2];
    return base.map((o) => {
      const found = prices.find((x) => x.occupancy === o);
      return { occupancy: o, price: found ? formatThousand(String(found.price)) : "0" };
    });
  });
  const [savedSnap, setSavedSnap] = useState<string>(() => {
    const initS = {
      ...(house as unknown as Record<string, string>),
      elec_rate: formatThousand(String(house.elec_rate ?? 0)),
      water_rate: formatThousand(String(house.water_rate ?? 0)),
      wifi_rate: formatThousand(String(house.wifi_rate ?? 0)),
    };
    const initP = [1, 2].map((o) => {
      const found = prices.find((x) => x.occupancy === o);
      return { occupancy: o, price: found ? formatThousand(String(found.price)) : "0" };
    });
    return sKey(initS, initP);
  });

  const dirty = savedSnap !== sKey(s, p);

  useEffect(() => {
    let live = true;
    getBanks().then((b) => {
      if (live) setBanks(b);
    });
    return () => {
      live = false;
    };
  }, []);

  function setRate(key: string, val: string) {
    setS((prev) => ({ ...prev, [key]: formatThousand(val) }));
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    Promise.all([
      updateSettings({
        name: s.name,
        address: s.address,
        due_text: s.due_text,
        transfer_note: s.transfer_note,
        note: s.note,
        elec_rate: parseThousand(s.elec_rate),
        water_rate: parseThousand(s.water_rate),
        wifi_rate: parseThousand(s.wifi_rate),
        max_occupancy: Number(s.max_occupancy) || 2,
        bank_code: s.bank_code || null,
        bank_account: s.bank_account || null,
        bank_name: s.bank_name || null,
      }),
      upsertPrices(p.map((x) => ({ occupancy: Number(x.occupancy), price: parseThousand(x.price) }))),
    ])
      .then(([r1, r2]) => {
        setSaving(false);
        if (!r1.ok || !r2.ok) {
          const reason = !r1.ok ? r1.error : r2.error;
          showToast("error", "Lưu thất bại: " + (reason || "lỗi không xác định"));
        } else {
          showToast("success", "Lưu thành công");
          setSavedSnap(sKey(s, p));
          router.refresh();
        }
      })
      .catch((err) => {
        setSaving(false);
        showToast("error", "Lưu thất bại: " + (err?.message || "lỗi không xác định"));
      });
  }

  return (
    <form onSubmit={save} className="grid max-w-3xl gap-4 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
      <div>
        <label className={label}>Tên nhà trọ</label>
        <input className={input} value={s.name} onChange={(e) => setS({ ...s, name: e.target.value })} />
      </div>
      <div>
        <label className={label}>Địa chỉ nhà trọ</label>
        <input className={input} value={s.address} onChange={(e) => setS({ ...s, address: e.target.value })} />
      </div>
      <div>
        <label className={label}>Hạn thanh toán</label>
        <input className={input} value={s.due_text} onChange={(e) => setS({ ...s, due_text: e.target.value })} />
      </div>
      <div>
        <label className={label}>Thông tin chuyển khoản</label>
        <input className={input} value={s.transfer_note} onChange={(e) => setS({ ...s, transfer_note: e.target.value })} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className={label}>Ngân hàng</label>
          <select
            className={input}
            value={s.bank_code ?? ""}
            onChange={(e) => setS({ ...s, bank_code: e.target.value })}
          >
            <option value="">— Chọn ngân hàng —</option>
            {s.bank_code && !(banks ?? []).some((b) => b.bin === s.bank_code) && (
              <option value={s.bank_code}>Ngân hàng hiện tại ({s.bank_code})</option>
            )}
            {!banks
              ? <option disabled>Đang tải danh sách ngân hàng...</option>
              : (banks || []).map((b) => (
                  <option key={b.bin} value={b.bin}>
                    {b.shortName} ({b.bin})
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label className={label}>Số tài khoản</label>
          <input className={input} value={s.bank_account ?? ""} onChange={(e) => setS({ ...s, bank_account: e.target.value })} placeholder="1234567890" />
        </div>
        <div>
          <label className={label}>Chủ tài khoản</label>
          <input className={input} value={s.bank_name ?? ""} onChange={(e) => setS({ ...s, bank_name: e.target.value })} placeholder="NGUYEN VAN A" />
        </div>
      </div>

      {s.bank_code && s.bank_account && /^\d{6}$/.test(s.bank_code.trim()) && /^\d{6,20}$/.test(s.bank_account.trim()) && (
        <div className="flex items-start gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <img
            src={`/api/qr-preview?bank=${encodeURIComponent(s.bank_code.trim())}&acc=${encodeURIComponent(s.bank_account.trim())}&amount=1000000&ref=P-PREVIEW`}
            alt="QR xem thử"
            width={132}
            height={132}
            className="rounded-lg border border-slate-200 bg-white dark:border-slate-600"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
          />
          <div className="text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-medium text-slate-800 dark:text-slate-100">Xem thử mã QR chuyển khoản</p>
            <p className="mt-1">
              QR này dùng mẫu <strong>1.000.000đ</strong>. Trên phiếu thu của từng phòng, hệ thống tự nhúng{" "}
              <strong>số tiền còn thiếu</strong> và nội dung <code>NT{`{phòng}`} {`{tháng}`}</code> tương ứng.
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              Bấm <strong>Lưu</strong> để áp dụng cho email và phiếu thu.
            </p>
          </div>
        </div>
      )}

      <div>
        <label className={label}>Ghi chú</label>
        <input className={input} value={s.note} onChange={(e) => setS({ ...s, note: e.target.value })} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={label}>Tiền điện (đ/kWh)</label>
          <input type="text" inputMode="numeric" className={input} value={s.elec_rate} onChange={(e) => setRate("elec_rate", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={label}>Tiền nước (đ/người)</label>
          <input type="text" inputMode="numeric" className={input} value={s.water_rate} onChange={(e) => setRate("water_rate", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={label}>Wifi + Rác (đ/người)</label>
          <input type="text" inputMode="numeric" className={input} value={s.wifi_rate} onChange={(e) => setRate("wifi_rate", e.target.value)} placeholder="0" />
        </div>
        <div>
          <label className={label}>Số người tối đa/phòng</label>
          <input type="number" className={input} value={s.max_occupancy} onChange={(e) => setS({ ...s, max_occupancy: e.target.value })} />
        </div>
      </div>

      <div>
        <p className={label}>Giá phòng theo số người (đ/tháng)</p>
        <div className="space-y-2">
          {p.map((x, i) => (
            <div key={x.occupancy} className="flex items-center gap-3">
              <span className="w-28 text-sm text-slate-600 dark:text-slate-400">{x.occupancy} người</span>
              <input
                type="text"
                inputMode="numeric"
                className={input + " w-48"}
                value={x.price}
                onChange={(e) =>
                  setP((prev) => prev.map((y, j) => (j === i ? { ...y, price: formatThousand(e.target.value) } : y)))
                }
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || !dirty}
        className="w-40 rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
      >
        {saving ? "Đang lưu..." : dirty ? "Lưu" : "Đã lưu"}
      </button>
    </form>
  );
}