"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "🏠 Trang chủ" },
];

export default function NavTabs() {
  const path = usePathname();
  function isActive(t: (typeof tabs)[number]) {
    if (t.href === "/") return path === "/" || path.startsWith("/nha");
    return path.startsWith(t.href);
  }
  return (
    <nav className="flex items-center gap-1 text-sm">
      {tabs.map((t) => (
        <Link
          key={t.href}
          href="/"
          prefetch
          className={
            isActive(t)
              ? "rounded-lg bg-indigo-50 px-3.5 py-1.5 font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400"
              : "rounded-lg px-3.5 py-1.5 font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          }
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}