import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useBankConcentration } from "@/hooks/useBankConcentration";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Building2 } from "lucide-react";

function getRiskBadge(level: string) {
  switch (level) {
    case "critical": return <Badge variant="destructive" className="text-[10px]">Crítico</Badge>;
    case "high": return <Badge variant="destructive" className="text-[10px]">Alto</Badge>;
    case "moderate": return <Badge variant="secondary" className="text-[10px]">Moderado</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">Baixo</Badge>;
  }
}

export function BankConcentrationCard() {
  const { data, isLoading } = useBankConcentration();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Concentração Bancária</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || data.banks.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Concentração Bancária</CardTitle>
          </div>
          {getRiskBadge(data.risk_level)}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          {data.banks.slice(0, 5).map((bank) => (
            <div key={bank.bank_name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium truncate max-w-[140px]">{bank.bank_name}</span>
                <span className="text-muted-foreground">
                  <MaskedValue>{formatCurrency(bank.balance)}</MaskedValue>
                  <span className="ml-1">({bank.percentage.toFixed(1)}%)</span>
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${bank.percentage > 40 ? "bg-destructive" : bank.percentage > 25 ? "bg-warning" : "bg-accent"}`}
                  style={{ width: `${Math.min(bank.percentage, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {data.max_concentration_pct > 40 && (
          <p className="text-[10px] text-destructive">
            ⚠ Concentração acima de 40% em um único banco aumenta o risco patrimonial
          </p>
        )}
      </CardContent>
    </Card>
  );
}
