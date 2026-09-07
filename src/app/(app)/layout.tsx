import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { getCurrentUser } from "@/lib/auth-server";
import { logout } from "@/app/actions";
import NavTabs from "@/components/nav-tabs";
import Toaster from "@/components/toast";
import ThemeToggle from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

export const metadata = { title: "Quản lý tiền trọ" };

async function Nav() {
  const store = await cookies();
  const ok = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!ok) redirect("/login");
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
      <div className="mx-auto flex h-14 max-w-[1900px] items-center gap-4 px-4">
        <div className="flex select-none items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white shadow-sm">
            L
          </span>
          <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Legaleader
            <span className="ml-1.5 hidden font-medium text-slate-400 sm:inline">
              · Quản lý nhà trọ
            </span>
          </span>
        </div>
        <NavTabs />
        {user && (
          <span className="hidden max-w-[180px] truncate text-xs text-slate-400 md:inline dark:text-slate-500">
            {user.name || user.email}
          </span>
        )}
        <form action={logout} className="ml-auto">
          <button className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-red-400">
            Đăng xuất
          </button>
        </form>
        <ThemeToggle />
      </div>
    </header>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1220]">
      <Nav />
      <main className="mx-auto w-full max-w-[1900px] px-4 py-6">{children}</main>
      <Toaster />
    </div>
  );
}