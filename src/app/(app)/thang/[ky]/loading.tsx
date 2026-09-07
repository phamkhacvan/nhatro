import { Skeleton, SkeletonStatGrid, SkeletonTable } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-64" />
        <Skeleton className="h-4 w-40" />
      </div>
      <SkeletonStatGrid n={4} />
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-72 rounded-xl" />
        <Skeleton className="h-10 w-44 rounded-xl" />
      </div>
      <SkeletonTable rows={10} />
    </div>
  );
}