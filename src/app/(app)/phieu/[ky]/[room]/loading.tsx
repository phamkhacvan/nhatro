import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto max-w-xl">
      <Skeleton className="mb-4 h-10 w-full rounded-2xl" />
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900">
        <div className="flex flex-col items-center gap-2 bg-indigo-600/90 px-8 py-6">
          <Skeleton className="h-5 w-48 bg-white/40" />
          <Skeleton className="h-3 w-28 bg-white/40" />
        </div>
        <div className="p-8 pt-6">
          <Skeleton className="mx-auto h-3 w-52" />
          <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className={"space-y-1 " + (i % 2 === 0 ? "" : "text-right")}>
                <Skeleton className={"h-2.5 " + (i % 2 === 0 ? "w-12" : "ml-auto w-20")} />
              </div>
            ))}
          </div>
          <div className="mt-5 space-y-2.5">
            {Array.from({ length: 6 }).map((_, r) => (
              <div key={r} className="flex items-center gap-3">
                <Skeleton className="h-3 w-28" />
                <div className="flex-1" />
                <Skeleton className="h-3 w-20" />
              </div>
            ))}
          </div>
          <Skeleton className="mx-auto mt-6 h-40 w-40 rounded-xl" />
          <Skeleton className="mx-auto mt-2 h-3 w-36" />
        </div>
      </div>
    </div>
  );
}