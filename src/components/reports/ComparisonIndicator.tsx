import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonIndicatorProps {
  current: number;
  previous: number;
  label?: string;
  invertColors?: boolean; // For expenses, decrease is good
  className?: string;
}

export function ComparisonIndicator({ current, previous, label, invertColors = false, className }: ComparisonIndicatorProps) {
  if (previous === 0 && current === 0) return null;
  
  const diff = current - previous;
  const percentChange = previous !== 0 ? ((diff / Math.abs(previous)) * 100) : current > 0 ? 100 : 0;
  
  const isPositive = diff > 0;
  const isNeutral = Math.abs(percentChange) < 0.5;
  
  const colorClass = isNeutral
    ? "text-muted-foreground"
    : (isPositive !== invertColors)
      ? "text-success"
      : "text-destructive";

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", signDisplay: "always" }).format(v);

  return (
    <div className={cn("flex items-center gap-1.5 text-xs", className)}>
      {isNeutral ? (
        <Minus className="h-3 w-3 text-muted-foreground" />
      ) : isPositive ? (
        <TrendingUp className={cn("h-3 w-3", colorClass)} />
      ) : (
        <TrendingDown className={cn("h-3 w-3", colorClass)} />
      )}
      <span className={cn("font-medium tabular-nums", colorClass)}>
        {isNeutral ? "0%" : `${percentChange > 0 ? "+" : ""}${percentChange.toFixed(1)}%`}
      </span>
      {label && <span className="text-muted-foreground">vs {label}</span>}
    </div>
  );
}
