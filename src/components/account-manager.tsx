"use client";

import { useState, useTransition } from "react";
import {
  changeOwnPassword,
  listUsers,
  adminResetPassword,
} from "@/app/actions";

type UserAccount = {
  id: number;
  email: string;
  name: string;
  is_admin: boolean;
  created_at: string;
  houseCount: number;
};

export default function AccountManager({
  me,
  initialUsers,
}: {
  me: { id: number; email: string; name: string; is_admin: boolean };
  initialUsers: UserAccount[];
}) {
  const [users, setUsers] = useState<UserAccount[]>(initialUsers);
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  function changePass(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await changeOwnPassword(cur, next);
      if (res.ok) {
        setMsg({ ok: true, text: "Đã đổi mật khẩu thành công." });
        setCur("");
        setNext("");
      } else {
        setMsg({ ok: false, text: res.error || "Lỗi." });
      }
    });
  }

  function refresh() {
    start(async () => {
      const u = await listUsers();
      setUsers(u);
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
        <h3 className="mb-1 text-sm font-bold text-slate-900 dark:text-slate-100">Tài khoản của bạn</h3>
        <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
          {me.name || me.email} <span className="text-slate-400">· {me.email}</span>
          {me.is_admin && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300">Quản trị</span>}
        </p>
        <form onSubmit={changePass} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Mật khẩu hiện tại</label>
            <input
              type="password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Mật khẩu mới</label>
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            />
          </div>
          <button
            type="submit"
            disabled={pending || !cur || !next}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            Đổi mật khẩu
          </button>
        </form>
        {msg && (
          <p className={`mt-3 text-sm ${msg.ok ? "text-emerald-600" : "text-red-600"}`}>{msg.text}</p>
        )}
      </section>

      {me.is_admin && (
        <section className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Tài khoản người dùng</h3>
            <button
              type="button"
              onClick={refresh}
              className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Làm mới
            </button>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {users.map((u) => (
              <UserRow key={u.id} u={u} isSelf={u.id === me.id} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function UserRow({ u, isSelf }: { u: UserAccount; isSelf: boolean }) {
  const [reset, setReset] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function doReset(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    start(async () => {
      const res = await adminResetPassword(u.id, reset);
      setMsg(res.ok ? "Đã đặt lại mật khẩu." : res.error || "Lỗi.");
      if (res.ok) setReset("");
    });
  }

  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            {u.name || u.email}
            {isSelf && <span className="ml-2 text-[11px] text-slate-400">(bạn)</span>}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {u.email} · {u.houseCount} nhà
            {u.is_admin && " · Quản trị"}
          </p>
        </div>
      </div>
      {!isSelf && (
        <form onSubmit={doReset} className="mt-2 flex items-center gap-2">
          <input
            type="password"
            value={reset}
            onChange={(e) => setReset(e.target.value)}
            placeholder="Mật khẩu mới"
            className="w-44 rounded-lg border border-slate-300 px-3 py-1.5 text-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={pending || !reset}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Đặt lại mật khẩu
          </button>
          {msg && <span className="text-xs text-slate-500">{msg}</span>}
        </form>
      )}
    </li>
  );
}
