import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useStructuredLiquidity } from "@/hooks/useStructuredLiquidity";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Droplets } from "lucide-react";

export function StructuredLiquidityCard() {
  const { data, isLoading } = useStructuredLiquidity();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Droplets className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Liquidez Estruturada</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const layers = [
    { label: "Imediata", value: data.immediate, color: "bg-success" },
    { label: "30 dias", value: data.liquidity_30d, color: "bg-accent" },
    { label: "90 dias", value: data.liquidity_90d, color: "bg-primary" },
    { label: "Capital Comprometido", value: data.committed_capital, color: "bg-muted-foreground" },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-accent" />
          <CardTitle className="text-sm font-semibold">Liquidez Estruturada</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {layers.map((layer) => (
            <div key={layer.label} className="p-2.5 rounded-lg bg-muted/50 space-y-0.5">
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${layer.color}`} />
                <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                  {layer.label}
                </span>
              </div>
              <p className="text-sm font-semibold">
                <MaskedValue>{formatCurrency(layer.value)}</MaskedValue>
              </p>
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          {data.immediate_pct.toFixed(0)}% do patrimônio em liquidez imediata
        </div>
      </CardContent>
    </Card>
  );
}
