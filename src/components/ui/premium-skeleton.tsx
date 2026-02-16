/**
 * IBBRA Premium Skeleton Loaders
 * Institutional shimmer-effect loading states.
 */
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-md bg-gradient-to-r from-muted/60 via-muted/30 to-muted/60 bg-[length:200%_100%] animate-[shimmer_1.8s_ease-in-out_infinite]",
        className
      )}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <Card className="border-border/30 overflow-hidden">
      <CardContent className="px-5 py-[18px] sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-2.5">
            <ShimmerBar className="h-3 w-24" />
            <ShimmerBar className="h-7 w-32" />
            <ShimmerBar className="h-3 w-20" />
          </div>
          <ShimmerBar className="hidden sm:block h-10 w-10 rounded-lg" />
        </div>
      </CardContent>
    </Card>
  );
}

export function ChartCardSkeleton({ title }: { title?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShimmerBar className="h-4 w-4 rounded" />
          {title ? (
            <span className="text-sm font-semibold text-muted-foreground">{title}</span>
          ) : (
            <ShimmerBar className="h-4 w-32" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <ShimmerBar className="h-16 flex-1 rounded-lg" />
          <ShimmerBar className="h-16 flex-1 rounded-lg" />
          <ShimmerBar className="h-16 flex-1 rounded-lg" />
        </div>
        <ShimmerBar className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

export function TransactionListSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <ShimmerBar className="h-4 w-40" />
        <ShimmerBar className="h-5 w-16 rounded" />
      </CardHeader>
      <CardContent className="space-y-1">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-2 py-1.5 px-1.5">
            <ShimmerBar className="h-6 w-6 rounded-full shrink-0" />
            <div className="flex-1 space-y-1">
              <ShimmerBar className="h-3 w-3/4" />
              <ShimmerBar className="h-2.5 w-1/2" />
            </div>
            <ShimmerBar className="h-3 w-16" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function MetricsGridSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ShimmerBar className="h-4 w-4 rounded" />
          <ShimmerBar className="h-4 w-36" />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <ShimmerBar className="h-10 w-24" />
        <ShimmerBar className="h-2 w-full rounded" />
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-2.5 rounded-lg bg-muted/20 space-y-1.5">
              <ShimmerBar className="h-3 w-16" />
              <ShimmerBar className="h-4 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
