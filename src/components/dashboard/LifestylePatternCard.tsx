import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useLifestylePattern } from "@/hooks/useLifestylePattern";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { ShoppingBag, TrendingUp, TrendingDown, Minus } from "lucide-react";

function getTrendIcon(trend: string) {
  if (trend === "increasing") return <TrendingUp className="h-3 w-3 text-destructive" />;
  if (trend === "decreasing") return <TrendingDown className="h-3 w-3 text-success" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function getTrendLabel(trend: string) {
  if (trend === "increasing") return "Crescente";
  if (trend === "decreasing") return "Decrescente";
  return "Estável";
}

export function LifestylePatternCard() {
  const { data, isLoading } = useLifestylePattern();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Padrão de Vida</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const variation = data.avg_monthly_12m > 0
    ? ((data.avg_monthly_3m - data.avg_monthly_12m) / data.avg_monthly_12m) * 100
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Padrão de Vida</CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {getTrendIcon(data.trend)}
            <Badge variant="outline" className="text-[10px]">{getTrendLabel(data.trend)}</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/50 space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              Média 12 meses
            </span>
            <p className="text-sm font-semibold">
              <MaskedValue>{formatCurrency(data.avg_monthly_12m)}</MaskedValue>
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/50 space-y-0.5">
            <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
              Média 3 meses
            </span>
            <p className="text-sm font-semibold">
              <MaskedValue>{formatCurrency(data.avg_monthly_3m)}</MaskedValue>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Volatilidade: {data.volatility.toFixed(1)}%</span>
          <span className={variation > 0 ? "text-destructive" : "text-success"}>
            {variation > 0 ? "+" : ""}{variation.toFixed(1)}% vs média
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
