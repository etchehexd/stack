import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-8">
      <Skeleton className="h-48 w-full rounded-2xl" />
      <Skeleton className="h-7 w-44" />
      <CardGridSkeleton count={12} />
    </div>
  );
}
