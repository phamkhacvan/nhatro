import { Skeleton, SkeletonTitle, SkeletonStatGrid, SkeletonCard, SkeletonList } from "@/components/skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonTitle className="w-72" />
      <SkeletonStatGrid />
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonList items={2} className="mt-4" />
    </div>
  );
}