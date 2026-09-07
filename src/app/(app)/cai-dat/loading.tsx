import { Skeleton } from "@/components/skeleton";

export default function Loading() {
  return (
    <div className="grid max-w-3xl gap-4">
      <Skeleton className="mb-2 h-6 w-64" />
      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <Skeleton className="h-9 w-40 rounded-t-lg" />
        <Skeleton className="h-9 w-44 rounded-t-lg" />
      </div>
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow dark:bg-slate-900">
        <div className="grid gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    </div>
  );
}