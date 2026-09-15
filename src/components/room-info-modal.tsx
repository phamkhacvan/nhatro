"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Room } from "@/lib/types";
import { getRoomInfo, upsertRooms } from "@/app/actions";
import { isoToVi, viToIso, maskDate, maskMonth, viMonthToKy, kyToViMonth, formatThousand, parseThousand } from "@/lib/calc";
import { showToast } from "@/components/toast";
import ContractControl from "@/components/contract-control";
import { emitRefresh } from "@/lib/refresh";

const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400";
const label = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";

type Draft = Omit<Room, "house_id" | "initial_index" | "room_price"> & {
  initial_index: string;
  room_price: string;
};

function draftKey(d: Draft): string {
  return JSON.stringify({
    room: d.room.trim(),
    tenant: d.tenant || "",
    phone: d.phone || "",
    cccd: d.cccd?.trim() || "",
    gender: d.gender || "",
    birth_year: d.birth_year || "",
    occupation: d.occupation || "",
    occupancy: Number(d.occupancy) || 0,
    washing_machine: Boolean(d.washing_machine),
    move_in: d.move_in || "",
    contract_end: d.contract_end || "",
    tam_tru_date: d.tam_tru_date || "",
    email: d.email?.trim() || null,
    deposit: formatThousand(String(d.deposit ?? 0)),
    deposit_date: d.deposit_date || "",
    exempt_elec: Boolean(d.exempt_elec),
    exempt_wifi: Boolean(d.exempt_wifi),
    exempt_water: Boolean(d.exempt_water),
    exempt_penalty: Boolean(d.exempt_penalty),
    exempt_from: d.exempt_from || "",
    exempt_until: d.exempt_until || "",
    room_price: formatThousand(String(d.room_price ?? "")),
  });
}

export default function RoomInfoModal({ room, onClose }: { room: string; onClose: () => void }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Draft | null | "loading">("loading");
  const [savedSnap, setSavedSnap] = useState<string | null>(null);
  const dirty = draft !== null && draft !== "loading" && savedSnap !== null && savedSnap !== draftKey(draft);

  useEffect(() => {
    let live = true;
    const startedAt = Date.now();
    const MIN_MS = 400;
    getRoomInfo(room).then((res) => {
const apply = () => {
          if (!live) return;
          if (!res.ok || !res.room) {
            setDraft(null);
            return;
          }
          const d: Draft = {
            room: res.room.room,
            tenant: res.room.tenant,
            phone: res.room.phone,
            cccd: res.room.cccd ?? "",
            gender: res.room.gender ?? "",
            birth_year: res.room.birth_year ?? "",
            occupation: res.room.occupation ?? "",
            email: res.room.email,
            occupancy: res.room.occupancy,
            move_in: isoToVi(res.room.move_in),
            contract_end: isoToVi(res.room.contract_end),
            tam_tru_date: isoToVi(res.room.tam_tru_date),
            deposit: res.room.deposit,
            deposit_date: isoToVi(res.room.deposit_date),
            washing_machine: res.room.washing_machine,
            active: res.room.active,
            initial_index:
              res.room.initial_index == null ? "" : String(res.room.initial_index),
            exempt_elec: Boolean(res.room.exempt_elec),
            exempt_wifi: Boolean(res.room.exempt_wifi),
            exempt_water: Boolean(res.room.exempt_water),
            exempt_penalty: Boolean(res.room.exempt_penalty),
            exempt_from: kyToViMonth(res.room.exempt_from),
            exempt_until: kyToViMonth(res.room.exempt_until),
            room_price: res.room.room_price == null ? "" : String(res.room.room_price),
          };
          setSavedSnap(draftKey(d));
          setDraft(d);
        };
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_MS) setTimeout(apply, MIN_MS - elapsed);
      else apply();
    });
    return () => {
      live = false;
    };
  }, [room]);

  function set<K extends keyof Draft>(key: K, val: string | number) {
    setDraft((d) => (d && d !== "loading" ? { ...d, [key]: val } : d));
  }

  function save() {
    if (!draft || draft === "loading") return;
    const bad =
      (draft.move_in && !viToIso(draft.move_in)) ||
      (draft.contract_end && !viToIso(draft.contract_end)) ||
      (draft.tam_tru_date && !viToIso(draft.tam_tru_date)) ||
      (draft.deposit_date && !viToIso(draft.deposit_date));
    if (bad) {
      showToast("error", "Ngày chưa đúng định dạng dd/mm/yyyy.");
      return;
    }
    if ((Number(draft.occupancy) || 0) > 0 && !draft.move_in) {
      showToast("error", "Phải nhập ngày vào ở khi có người thuê.");
      return;
    }
    const exFrom = draft.exempt_from && draft.exempt_from.trim() ? viMonthToKy(draft.exempt_from) : null;
    const exUntil = draft.exempt_until && draft.exempt_until.trim() ? viMonthToKy(draft.exempt_until) : null;
    const hasExempt = Boolean(draft.exempt_elec) || Boolean(draft.exempt_wifi) || Boolean(draft.exempt_water) || Boolean(draft.exempt_penalty);
    if (hasExempt && !exFrom && !exUntil) {
      showToast("error", "Có khoản được miễn phí thì phải nhập khoảng tháng (từ → đến).");
      return;
    }
    if (draft.exempt_from && !exFrom) {
      showToast("error", "Tháng bắt đầu miễn phí chưa đúng định dạng mm/yyyy.");
      return;
    }
    if (draft.exempt_until && !exUntil) {
      showToast("error", "Tháng kết thúc miễn phí chưa đúng định dạng mm/yyyy.");
      return;
    }
    if (exFrom && exUntil && exFrom > exUntil) {
      showToast("error", "Tháng bắt đầu miễn phí phải trước hoặc bằng tháng kết thúc.");
      return;
    }
    if (draft.move_in && draft.contract_end && viToIso(draft.contract_end)! < viToIso(draft.move_in)!) {
      showToast("error", "Ngày kết thúc HĐ phải sau ngày vào ở.");
      return;
    }
    setSaving(true);
    upsertRooms([
      {
        ...draft,
        room: draft.room.trim(),
        occupancy: Number(draft.occupancy) || 0,
        move_in: viToIso(draft.move_in ?? ""),
        contract_end: viToIso(draft.contract_end ?? ""),
        tam_tru_date: viToIso(draft.tam_tru_date ?? ""),
        deposit_date: viToIso(draft.deposit_date ?? ""),
        email: draft.email?.trim() || null,
        deposit: parseThousand(draft.deposit),
        initial_index: draft.initial_index === "" ? null : Number(draft.initial_index),
        active: true,
        exempt_elec: Boolean(draft.exempt_elec),
        exempt_wifi: Boolean(draft.exempt_wifi),
        exempt_water: Boolean(draft.exempt_water),
        exempt_penalty: Boolean(draft.exempt_penalty),
        exempt_from: exFrom,
        exempt_until: exUntil,
        room_price: draft.room_price == null || draft.room_price === "" ? null : parseThousand(draft.room_price),
      },
    ])
      .then((res) => {
        setSaving(false);
        if (!res.ok) showToast("error", res.error || "Lưu thất bại.");
        else {
          showToast("success", "Đã lưu thông tin phòng");
          setSavedSnap(draftKey(draft));
          router.refresh();
          onClose();
          emitRefresh();
        }
      })
      .catch((err) => {
        setSaving(false);
        showToast("error", "Lưu thất bại: " + (err?.message || "lỗi không xác định"));
      });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-slate-100">Thông tin phòng {room}</h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Sửa trực tiếp — đồng bộ với phần quản lý phòng.</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
            ✕
          </button>
        </div>

        {draft === "loading" ? (
          <div className="space-y-3" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60"></div>
            ))}
          </div>
        ) : draft === null ? (
          <p className="py-8 text-center text-sm text-slate-500">Không có thông tin phòng này. Hãy nhập trong phần Cài đặt → Quản lý phòng.</p>
        ) : (
          <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Người thuê</label>
              <input className={input} value={draft.tenant} onChange={(e) => set("tenant", e.target.value)} placeholder="Tên người thuê" />
            </div>
            <div>
              <label className={label}>SĐT</label>
              <input className={input} value={draft.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Số điện thoại" />
            </div>
            <div>
              <label className={label}>CCCD</label>
              <input className={input} value={draft.cccd ?? ""} onChange={(e) => set("cccd", e.target.value)} placeholder="Số CCCD/CMND" />
            </div>
            <div>
              <label className={label}>Giới tính</label>
              <input className={input} value={draft.gender ?? ""} onChange={(e) => set("gender", e.target.value)} placeholder="Nam/Nữ" />
            </div>
            <div>
              <label className={label}>Năm sinh</label>
              <input className={input} value={draft.birth_year ?? ""} onChange={(e) => set("birth_year", e.target.value)} placeholder="1990" />
            </div>
            <div>
              <label className={label}>Nghề nghiệp</label>
              <input className={input} value={draft.occupation ?? ""} onChange={(e) => set("occupation", e.target.value)} placeholder="Sinh viên, nhân viên..." />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" className={input} value={draft.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="Email (để gửi phiếu)" />
            </div>
            <div>
              <label className={label}>Số người</label>
              <select className={input} value={draft.occupancy} onChange={(e) => set("occupancy", Number(e.target.value))}>
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Số điện lúc nhận phòng</label>
              <input
                type="number"
                className={input}
                value={draft.initial_index}
                onChange={(e) => set("initial_index", e.target.value)}
                placeholder="kWh (vd 19)"
                title="Chỉ số công tơ điện ghi nhận đúng ngày người thuê vào ở — hệ thống tự để làm 'Số điện cũ' tháng đầu."
              />
            </div>
            <div>
              <label className={label}>Ngày vào ở</label>
              <input type="text" inputMode="numeric" maxLength={10} className={input} value={draft.move_in ?? ""} onChange={(e) => set("move_in", maskDate(e.target.value))} placeholder="dd/mm/yyyy" />
            </div>
            <div>
              <label className={label}>Đăng ký tạm trú</label>
              <input type="text" inputMode="numeric" maxLength={10} className={input} value={draft.tam_tru_date ?? ""} onChange={(e) => set("tam_tru_date", maskDate(e.target.value))} placeholder="dd/mm/yyyy" />
            </div>
            <div>
              <label className={label}>Kết thúc HĐ</label>
              <input type="text" inputMode="numeric" maxLength={10} className={input} value={draft.contract_end ?? ""} onChange={(e) => set("contract_end", maskDate(e.target.value))} placeholder="dd/mm/yyyy" />
            </div>
            <div>
              <label className={label}>Ngày nhận cọc</label>
              <input type="text" inputMode="numeric" maxLength={10} className={input} value={draft.deposit_date ?? ""} onChange={(e) => set("deposit_date", maskDate(e.target.value))} placeholder="dd/mm/yyyy" />
            </div>
            <div>
              <label className={label}>Tiền cọc (đ)</label>
              <input
                type="text"
                inputMode="numeric"
                className={input}
                value={formatThousand(String(draft.deposit))}
                onChange={(e) => set("deposit", formatThousand(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>Giá thuê riêng (đ)</label>
              <input
                type="text"
                inputMode="numeric"
                className={input}
                value={formatThousand(String(draft.room_price ?? ""))}
                onChange={(e) => set("room_price", formatThousand(e.target.value))}
                placeholder="Để trống = theo bảng giá"
              />
            </div>
            <div className="flex items-end rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(draft.washing_machine)}
                  onChange={(e) => set("washing_machine", e.target.checked ? 1 : 0)}
                  className="h-4 w-4 accent-indigo-600"
                />
                <span>
                  Có sử dụng máy giặt{" "}
                  <span className="text-slate-400">(nước tính 150.000đ/người/tháng)</span>
                </span>
              </label>
            </div>

            <div className="col-span-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
              <p className="mb-2 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                🎁 Miễn phí theo thỏa thuận
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {([
                  ["exempt_elec", "Điện"],
                  ["exempt_wifi", "Wifi + Rác"],
                  ["exempt_water", "Nước"],
                  ["exempt_penalty", "Phụ phí"],
                ] as const).map(([key, labelText]) => (
                  <label key={key} className="flex cursor-pointer items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={Boolean(draft[key])}
                      onChange={(e) => set(key, e.target.checked ? 1 : 0)}
                      className="h-4 w-4 accent-emerald-600"
                    />
                    {labelText}
                  </label>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Từ tháng</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    className={input}
                    value={draft.exempt_from ?? ""}
                    onChange={(e) => set("exempt_from", maskMonth(e.target.value))}
                    placeholder="mm/yyyy"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">Đến tháng</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={7}
                    className={input}
                    value={draft.exempt_until ?? ""}
                    onChange={(e) => set("exempt_until", maskMonth(e.target.value))}
                    placeholder="mm/yyyy"
                  />
                </div>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                Tự động áp dụng trên các kỳ từ tháng bắt đầu đến tháng kết thúc; phiếu in sẽ ghi rõ phần được ưu đãi.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-dashed border-slate-200 p-3 dark:border-slate-700">
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              Hợp đồng phòng {room}
            </p>
            <ContractControl room={room} />
          </div>
          </>
        )}

        {draft && draft !== "loading" && (
          <div className="mt-5 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Đóng
            </button>
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu thay đổi"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}