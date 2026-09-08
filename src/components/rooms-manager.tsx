"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Room, ContractMeta } from "@/lib/types";
import { upsertRooms } from "@/app/actions";
import { isoToVi, viToIso, maskDate, formatThousand, parseThousand } from "@/lib/calc";
import { showToast } from "@/components/toast";
import ContractControl from "@/components/contract-control";

const label = "mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300";
const input =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400";

type DisplayRoom = {
  room: string;
  tenant: string;
  phone: string;
  occupancy: number;
  washing_machine: boolean;
  move_in: string;
  contract_end: string;
  tam_tru_date: string;
  email: string | null;
  deposit: number | string;
  deposit_date: string;
};

function displayOf(r: DisplayRoom): string {
  return JSON.stringify({
    room: r.room.trim(),
    tenant: r.tenant || "",
    phone: r.phone || "",
    occupancy: Number(r.occupancy) || 0,
    washing_machine: Boolean(r.washing_machine),
    move_in: r.move_in || "",
    contract_end: r.contract_end || "",
    tam_tru_date: r.tam_tru_date || "",
    email: r.email?.trim() || null,
    deposit: formatThousand(String(r.deposit ?? 0)),
    deposit_date: r.deposit_date || "",
  });
}

export default function RoomsManager({
  rooms,
  contracts,
}: {
  rooms: Room[];
  contracts: Record<string, ContractMeta>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [list, setList] = useState<DisplayRoom[]>(() =>
    rooms.map((r) => ({
      ...r,
      move_in: isoToVi(r.move_in),
      contract_end: isoToVi(r.contract_end),
      tam_tru_date: isoToVi(r.tam_tru_date),
      deposit_date: isoToVi(r.deposit_date),
    }))
  );
  const [savedSnap, setSavedSnap] = useState<string>(() =>
    JSON.stringify(
      rooms.map((r) => displayOf({ ...r, move_in: isoToVi(r.move_in), contract_end: isoToVi(r.contract_end), tam_tru_date: isoToVi(r.tam_tru_date), deposit_date: isoToVi(r.deposit_date) }))
    )
  );

  const listKey = JSON.stringify(list.map(displayOf));
  const dirty = savedSnap !== listKey;

  function update(i: number, key: keyof Room, val: string) {
    setList((prev) => prev.map((r, j) => (j === i ? { ...r, [key]: val } : r)));
  }

  function addRoom() {
    setList((prev) => [
      ...prev,
      { room: "", tenant: "", phone: "", email: "", occupancy: 1, move_in: "", contract_end: "", tam_tru_date: "", deposit: 0, deposit_date: "", active: true, washing_machine: false },
    ]);
  }

  function remove(i: number) {
    setList((prev) => prev.filter((_, j) => j !== i));
  }

  function save() {
    if (list.some((r) => !r.room.trim())) {
      showToast("error", "Lưu thất bại: mỗi phòng phải có mã số phòng.");
      return;
    }
    if (list.some((r) => parseThousand(r.deposit) < 0)) {
      showToast("error", "Lưu thất bại: tiền cọc không được âm.");
      return;
    }
    const noMoveIn = list.find((r) => (Number(r.occupancy) || 0) > 0 && !r.move_in);
    if (noMoveIn) {
      showToast("error", `Phòng ${noMoveIn.room}: Ngày vào ở là bắt buộc khi có người ở.`);
      return;
    }
    const badEnd = list.find((r) => r.move_in && r.contract_end && viToIso(r.contract_end)! < viToIso(r.move_in)!);
    if (badEnd) {
      showToast("error", `Phòng ${badEnd.room}: Ngày kết thúc HĐ phải sau ngày vào ở.`);
      return;
    }
    const bad = list.find(
      (r) =>
        (r.move_in && !viToIso(r.move_in)) ||
        (r.contract_end && !viToIso(r.contract_end)) ||
        (r.tam_tru_date && !viToIso(r.tam_tru_date)) ||
        (r.deposit_date && !viToIso(r.deposit_date))
    );
    if (bad) {
      showToast("error", `Ngày ở phòng ${bad.room} chưa đúng định dạng dd/mm/yyyy.`);
      return;
    }
    start(async () => {
      const res = await upsertRooms(
        list.map((r) => ({
          ...r,
          room: r.room.trim(),
          occupancy: Number(r.occupancy) || 0,
          washing_machine: Boolean(r.washing_machine),
          move_in: viToIso(r.move_in ?? ""),
          contract_end: viToIso(r.contract_end ?? ""),
          tam_tru_date: viToIso(r.tam_tru_date ?? ""),
          email: r.email?.trim() || null,
          deposit: parseThousand(r.deposit),
          deposit_date: viToIso(r.deposit_date ?? ""),
          active: true,
        }))
      );
      if (!res.ok) showToast("error", res.error || "Lưu thất bại.");
      else {
        showToast("success", "Lưu thành công");
        setSavedSnap(listKey);
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-bold text-blue-900 dark:text-indigo-300">Danh sách phòng & người thuê</h2>
        <div className="flex gap-2">
          <button
            onClick={addRoom}
            className="rounded-lg border border-blue-900 px-3 py-1.5 text-sm font-semibold text-blue-900 hover:bg-blue-50 dark:border-indigo-500 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
          >
            + Thêm phòng
          </button>
          <button
            onClick={save}
            disabled={pending || !dirty}
            className="rounded-lg bg-blue-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-indigo-500"
          >
            {pending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {list.map((r, i) => (
          <div key={i} className="rounded-lg border border-slate-100 p-2 dark:border-slate-800">
            <div className="grid grid-cols-[64px_1fr_1fr_1fr_58px_100px_122px_122px_122px_115px_130px_36px] items-end gap-2">
            <div>
              <label className={label}>Phòng</label>
              <input className={input} value={r.room} onChange={(e) => update(i, "room", e.target.value)} />
            </div>
            <div>
              <label className={label}>Người thuê</label>
              <input className={input} value={r.tenant} onChange={(e) => update(i, "tenant", e.target.value)} />
            </div>
            <div>
              <label className={label}>SĐT</label>
              <input className={input} value={r.phone} onChange={(e) => update(i, "phone", e.target.value)} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input type="email" className={input} value={r.email ?? ""} onChange={(e) => update(i, "email", e.target.value)} />
            </div>
            <div>
              <label className={label}>Số người</label>
              <select className={input} value={r.occupancy} onChange={(e) => update(i, "occupancy", e.target.value)}>
                {[0, 1, 2].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-2 py-2 text-sm dark:border-slate-600">
                <input
                  type="checkbox"
                  checked={Boolean(r.washing_machine)}
                  onChange={(e) =>
                    setList((prev) =>
                      prev.map((rx, jx) =>
                        jx === i ? { ...rx, washing_machine: e.target.checked } : rx
                      )
                    )
                  }
                  className="h-4 w-4 accent-indigo-600"
                />
                <span className="leading-tight">Máy giặt</span>
              </label>
            </div>
            <div>
              <label className={label}>Ngày vào ở</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={input}
                value={r.move_in ?? ""}
                onChange={(e) => update(i, "move_in", maskDate(e.target.value))}
                placeholder="dd/mm/yyyy"
              />
            </div>            <div>
              <label className={label}>Kết thúc HĐ</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={input}
                value={r.contract_end ?? ""}
                onChange={(e) => update(i, "contract_end", maskDate(e.target.value))}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div>
              <label className={label}>Hoàn thành ĐKTT</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={input}
                value={r.tam_tru_date ?? ""}
                onChange={(e) => update(i, "tam_tru_date", maskDate(e.target.value))}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <div>
              <label className={label}>Tiền cọc (đ)</label>
              <input
                type="text"
                inputMode="numeric"
                className={input}
                value={formatThousand(String(r.deposit))}
                onChange={(e) => update(i, "deposit", formatThousand(e.target.value))}
                placeholder="0"
              />
            </div>
            <div>
              <label className={label}>Ngày nhận cọc</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                className={input}
                value={r.deposit_date ?? ""}
                onChange={(e) => update(i, "deposit_date", maskDate(e.target.value))}
                placeholder="dd/mm/yyyy"
              />
            </div>
            <button
              onClick={() => remove(i)}
              className="rounded-lg border border-red-200 px-2 py-2 text-sm text-red-600 hover:bg-red-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
              title="Xóa phòng"
            >
              ✕
            </button>
            </div>
            {r.room.trim() ? (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
                <span className="whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                  Hợp đồng:
                </span>
                <ContractControl room={r.room.trim()} initial={contracts[r.room.trim()] ?? null} />
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2 border-t border-dashed border-slate-200 pt-2 dark:border-slate-700">
                <span className="whitespace-nowrap text-xs font-medium text-slate-500 dark:text-slate-400">
                  Hợp đồng:
                </span>
                <span className="text-xs text-slate-400">Lưu phòng trước để tải hợp đồng.</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}