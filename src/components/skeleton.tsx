export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/50 ${className}`} />;
}

export function SkeletonTitle({ className = "" }: { className?: string }) {
  return <Skeleton className={`mb-4 h-6 w-56 ${className}`} />;
}

export function SkeletonStatGrid({ n = 4, className = "" }: { n?: number; className?: string }) {
  return (
    <div className={`mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 ${className}`}>
      {Array.from({ length: n }).map((_, i) => (
        <Skeleton key={i} className="h-24 rounded-2xl" />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 10, className = "" }: { rows?: number; className?: string }) {
  return (
    <div className={`space-y-2.5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60 dark:bg-slate-900 dark:ring-slate-700/60 ${className}`}>
      <Skeleton className="h-11 w-full rounded-xl" />
      {Array.from({ length: rows }).map((_, r) => {
        const w1 = 22 + ((r * 13) % 40);
        const w2 = 12 + ((r * 17) % 28);
        return (
          <div key={r} className="flex flex-nowrap items-center gap-4 px-1">
            <div className="h-3 flex-none animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/50" style={{ width: `${w1}%` }} />
            <div className="h-3 flex-none animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700/50" style={{ width: `${w2}%` }} />
            <div className="flex-1" />
            <Skeleton className="h-3 w-24 flex-none" />
            <Skeleton className="h-3 w-16 flex-none" />
          </div>
        );
      })}
    </div>
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return <Skeleton className={`h-40 rounded-2xl ${className}`} />;
}

export function SkeletonList({ items = 6, className = "" }: { items?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: items }).map((_, i) => (
        <Skeleton key={i} className="h-16 rounded-2xl" />
      ))}
    </div>
  );
}