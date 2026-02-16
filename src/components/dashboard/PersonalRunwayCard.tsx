import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { usePersonalRunway } from "@/hooks/usePersonalRunway";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Shield } from "lucide-react";

function getRiskBadge(level: string) {
  switch (level) {
    case "critical": return <Badge variant="destructive" className="text-[10px]">Crítico</Badge>;
    case "warning": return <Badge variant="secondary" className="text-[10px]">Atenção</Badge>;
    case "moderate": return <Badge variant="outline" className="text-[10px]">Moderado</Badge>;
    default: return <Badge variant="default" className="text-[10px]">Seguro</Badge>;
  }
}

export function PersonalRunwayCard() {
  const { data, isLoading } = usePersonalRunway();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Runway Pessoal</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-20 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Runway Pessoal</CardTitle>
          </div>
          {getRiskBadge(data.risk_level)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center">
          <span
            className={`text-4xl font-bold ${data.runway_months >= 12 ? "text-success" : data.runway_months >= 6 ? "text-warning" : "text-destructive"}`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {data.runway_months >= 99 ? "∞" : data.runway_months}
          </span>
          <span className="text-sm text-muted-foreground ml-1">meses</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Patrimônio Líquido</p>
            <p className="text-xs font-semibold">
              <MaskedValue>{formatCurrency(data.liquid_assets)}</MaskedValue>
            </p>
          </div>
          <div className="p-2 rounded-lg bg-muted/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Despesa Média/Mês</p>
            <p className="text-xs font-semibold">
              <MaskedValue>{formatCurrency(data.avg_monthly_expense)}</MaskedValue>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
