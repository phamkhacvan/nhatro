import { Skeleton, SkeletonTitle } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonTitle />
      {Array.from({ length: 2 }).map((_, g) => (
        <div key={g} className="mb-6">
          <Skeleton className="mb-2 h-4 w-28" />
          <div className="space-y-2.5 rounded-2xl bg-white p-2 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60">
            {Array.from({ length: 5 }).map((_, r) => (
              <div key={r} className="flex items-center gap-3 px-2 py-1">
                <Skeleton className="h-3 w-10" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-24" />
                <div className="flex-1" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}