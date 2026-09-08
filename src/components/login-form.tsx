"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, register, requestPasswordReset } from "@/app/actions";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [pending, start] = useTransition();
  const sp = useSearchParams();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (mode === "login") {
      start(async () => {
        const res = await login(email, pass);
        if (res.ok) {
          router.push(sp.get("next") || "/");
        } else {
          setError(res.error || "Lỗi đăng nhập.");
        }
      });
    } else if (mode === "register") {
      start(async () => {
        const res = await register({ name, email, password: pass });
        if (res.ok) {
          router.push("/");
        } else {
          setError(res.error || "Lỗi đăng ký.");
        }
      });
    }
  }

  function sendReset() {
    setForgotMsg("");
    start(async () => {
      const res = await requestPasswordReset();
      setForgotMsg(res.error || "Đã gửi yêu cầu về info@legaleader.com. Vui lòng chờ cập nhật mật khẩu mới.");
      if (res.ok) setMode("login");
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4 dark:from-[#0b1220] dark:to-slate-900">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl shadow-slate-200/60 dark:bg-slate-900 dark:shadow-black/40">
        <div className="mb-6 flex flex-col items-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white shadow-md shadow-indigo-200 dark:shadow-indigo-500/20">
            L
          </span>
          <h1 className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Legaleader
            {mode === "forgot" && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">Quên mật khẩu</span>}
          </h1>
          <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
            {mode === "login" && "Quản lý nhà trọ — đăng nhập để tiếp tục"}
            {mode === "register" && "Tạo tài khoản mới để quản lý nhà trọ riêng"}
            {mode === "forgot" && "Gửi yêu cầu đặt lại mật khẩu về email quản trị"}
          </p>
        </div>

        {forgotMsg && (
          <p className="mb-3 rounded-lg px-3 py-2.5 text-[13px] text-slate-600 dark:text-slate-300">{forgotMsg}</p>
        )}

        {mode === "forgot" ? (
          <>
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              Hệ thống sẽ gửi thông báo (kèm IP, vị trí, thiết bị) tới <strong>info@legaleader.com</strong> để chủ hệ thống đặt lại mật khẩu cho bạn.
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={sendReset}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
              >
                {pending ? "Đang gửi..." : "Gửi yêu cầu đặt lại"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setMode("login");
                  setForgotMsg("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Quay lại
              </button>
            </div>
          </>
        ) : (
          <>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              autoComplete="email"
              required
              autoFocus
              className="mb-3 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            />
            {mode === "register" && (
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tên của bạn"
                autoComplete="name"
                required
                className="mb-3 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
              />
            )}
            <input
              type="password"
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="Mật khẩu"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
              className="mb-4 w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-indigo-400 dark:focus:ring-indigo-500/20"
            />
            {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={pending || !email || !pass}
              className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              {pending ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}
            </button>
            <div className="mt-3 flex items-center justify-between text-[13px]">
              {mode === "login" ? (
                <>
                  <button type="button" onClick={() => { setMode("register"); setError(""); }} className="text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400">
                    Đăng ký tài khoản
                  </button>
                  <button type="button" onClick={() => { setMode("forgot"); setError(""); }} className="text-slate-500 transition hover:text-indigo-600 dark:text-slate-400">
                    Quên mật khẩu?
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-indigo-600 transition hover:text-indigo-500 dark:text-indigo-400">
                    ← Quay lại đăng nhập
                  </button>
                  {mode === "register" && (
                    <button type="button" onClick={() => { setMode("login"); setError(""); }} className="text-slate-500 transition hover:text-indigo-600 dark:text-slate-400">
                      Đã có tài khoản?
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </form>
    </div>
  );
}
