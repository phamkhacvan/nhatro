"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadContract, deleteContract, getContractMeta } from "@/app/actions";
import { ContractMeta } from "@/lib/types";
import { showToast } from "@/components/toast";

function fmtSize(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

export default function ContractControl({
  room,
  initial,
}: {
  room: string;
  initial?: ContractMeta | null;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState<ContractMeta | null>(initial ?? null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initial !== undefined) return;
    let live = true;
    getContractMeta(room).then((m) => {
      if (live) setMeta(m);
    });
    return () => {
      live = false;
    };
  }, [room, initial]);

  function onUpload(file: File | null) {
    if (!file) return;
    if (file.size === 0 || file.size > 4 * 1024 * 1024) {
      showToast("error", "File phải từ 1 byte đến 4MB.");
      return;
    }
    const ok = /^(application\/pdf|image\/(jpeg|png|webp)|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/.test(
      file.type
    );
    if (!ok) {
      showToast("error", "Chỉ hỗ trợ PDF, Word (.doc/.docx), JPG, PNG, WEBP.");
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    setSaving(true);
    uploadContract(room, fd)
      .then((res) => {
        setSaving(false);
        if (!res.ok) {
          showToast("error", res.error || "Tải lên thất bại.");
          return;
        }
        showToast("success", "Đã upload hợp đồng");
        setMeta({ file_name: file.name, mime: file.type, size: file.size });
        router.refresh();
      })
      .catch((err) => {
        setSaving(false);
        showToast("error", "Tải lên thất bại: " + (err?.message || "lỗi không xác định"));
      });
  }

  function onDelete() {
    if (!window.confirm(`Xóa hợp đồng "${meta?.file_name}" của phòng ${room}?`)) return;
    setSaving(true);
    deleteContract(room)
      .then((res) => {
        setSaving(false);
        if (!res.ok) {
          showToast("error", res.error || "Xóa thất bại.");
          return;
        }
        showToast("success", "Đã xóa hợp đồng");
        setMeta(null);
        router.refresh();
      })
      .catch((err) => {
        setSaving(false);
        showToast("error", "Xóa thất bại: " + (err?.message || "lỗi không xác định"));
      });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          e.target.value = "";
          onUpload(f);
        }}
      />
      {meta ? (
        <>
          <button
            onClick={() => window.open(`/api/contract/${encodeURIComponent(room)}`, "_blank", "noopener,noreferrer")}
            className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800 hover:bg-blue-100 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300"
            title={`${meta.file_name} (${fmtSize(meta.size)})`}
          >
            📄 {meta.file_name}
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {saving ? "Đang tải..." : "Thay"}
          </button>
          <button
            onClick={onDelete}
            disabled={saving}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-500/30 dark:text-red-400 dark:hover:bg-red-500/10"
          >
            ✕ Xóa
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={saving}
            className="rounded-lg border border-dashed border-blue-300 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:border-indigo-500/50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
          >
            {saving ? "Đang tải..." : "＋ Upload hợp đồng"}
          </button>
          <span className="text-xs text-slate-400">PDF/Word/JPG/PNG · tối đa 4MB</span>
        </>
      )}
    </div>
  );
}