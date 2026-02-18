/**
 * IBBRA Premium Skeleton Card
 * Reusable shimmer skeleton loader with multiple variants.
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

type SkeletonVariant = "card" | "table" | "chart" | "stat" | "donut" | "progress" | "account-balances";

interface SkeletonCardProps {
  variant: SkeletonVariant;
  className?: string;
  rows?: number;
}

export function SkeletonCard({ variant, className, rows }: SkeletonCardProps) {
  switch (variant) {
    case "stat":
      return <StatSkeleton className={className} />;
    case "card":
      return <GenericCardSkeleton className={className} />;
    case "table":
      return <TableSkeleton className={className} rows={rows ?? 10} />;
    case "chart":
      return <ChartSkeleton className={className} />;
    case "donut":
      return <DonutSkeleton className={className} />;
    case "progress":
      return <ProgressSkeleton className={className} />;
    case "account-balances":
      return <AccountBalancesSkeleton className={className} />;
    default:
      return <GenericCardSkeleton className={className} />;
  }
}

function StatSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("border-border/30 overflow-hidden", className)}>
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

function GenericCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <ShimmerBar className="h-4 w-36" />
      </CardHeader>
      <CardContent className="space-y-3">
        <ShimmerBar className="h-4 w-full" />
        <ShimmerBar className="h-4 w-3/4" />
        <ShimmerBar className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton({ className, rows }: { className?: string; rows: number }) {
  const widths = ["w-3/4", "w-1/2", "w-5/6", "w-2/3", "w-3/5", "w-4/5", "w-1/2", "w-2/3", "w-3/4", "w-5/6"];
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border p-3 md:p-4">
          <ShimmerBar className="hidden sm:block h-10 w-10 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <ShimmerBar className={cn("h-3.5", widths[i % widths.length])} />
            <ShimmerBar className="h-2.5 w-1/3" />
          </div>
          <ShimmerBar className="h-4 w-20 shrink-0" />
          <ShimmerBar className="h-8 w-8 rounded shrink-0" />
        </div>
      ))}
    </div>
  );
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShimmerBar className="h-4 w-4 rounded" />
            <ShimmerBar className="h-4 w-40" />
          </div>
          <ShimmerBar className="h-5 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-2 rounded-lg bg-muted/20 space-y-1.5 text-center">
              <ShimmerBar className="h-2.5 w-16 mx-auto" />
              <ShimmerBar className="h-4 w-20 mx-auto" />
            </div>
          ))}
        </div>
        <ShimmerBar className="h-48 w-full rounded-lg" />
      </CardContent>
    </Card>
  );
}

function DonutSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-1 pt-3 px-4">
        <div className="flex items-center gap-2">
          <ShimmerBar className="h-4 w-4 rounded" />
          <ShimmerBar className="h-4 w-40" />
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-4">
        {/* Income section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <ShimmerBar className="h-3 w-16" />
            <ShimmerBar className="h-3 w-24" />
          </div>
          <div className="flex items-start gap-4">
            <ShimmerBar className="h-[100px] w-[100px] rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <ShimmerBar className="h-2.5 w-2.5 rounded-full shrink-0" />
                  <ShimmerBar className="h-2.5 flex-1" />
                  <ShimmerBar className="h-2.5 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Expense section */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <ShimmerBar className="h-3 w-16" />
            <ShimmerBar className="h-3 w-24" />
          </div>
          <div className="flex items-start gap-4">
            <ShimmerBar className="h-[100px] w-[100px] rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <ShimmerBar className="h-2.5 w-2.5 rounded-full shrink-0" />
                  <ShimmerBar className="h-2.5 flex-1" />
                  <ShimmerBar className="h-2.5 w-16 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProgressSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex flex-row items-center justify-between">
        <ShimmerBar className="h-5 w-44" />
        <ShimmerBar className="h-5 w-16 rounded-full" />
      </CardHeader>
      <CardContent className="space-y-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShimmerBar className="h-8 w-8 rounded-lg" />
                <ShimmerBar className="h-3.5 w-24" />
              </div>
              <ShimmerBar className="h-3.5 w-32" />
            </div>
            <ShimmerBar className="h-2 w-full rounded-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function AccountBalancesSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      <ShimmerBar className="h-4 w-24" />
      <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="card-executive overflow-hidden">
            <CardContent className="p-4 space-y-3">
              <ShimmerBar className="h-9 w-9 rounded-xl" />
              <ShimmerBar className="h-2.5 w-32" />
              <ShimmerBar className="h-7 w-28" />
              <ShimmerBar className="h-2.5 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
