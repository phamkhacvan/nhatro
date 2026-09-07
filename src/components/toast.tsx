"use client";

import { useEffect, useState } from "react";

type ToastType = "success" | "error";
type Toast = { id: number; type: ToastType; message: string };

const TOAST_EVENT = "nhatro:toast";

export function showToast(type: ToastType, message: string) {
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: { type, message } }));
}

export default function Toaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { type, message } = (e as CustomEvent<{ type: ToastType; message: string }>).detail;
      const id = ++n;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    return () => window.removeEventListener(TOAST_EVENT, onToast);
  }, []);

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-80 flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={
            "rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg " +
            (t.type === "success" ? "bg-green-600" : "bg-red-600")
          }
        >
          {t.type === "success" ? "✅ " : "❌ "}
          {t.message}
        </div>
      ))}
    </div>
  );
}