import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useCurrencyExposure } from "@/hooks/useCurrencyExposure";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { Globe } from "lucide-react";

export function CurrencyExposureCard() {
  const { data, isLoading } = useCurrencyExposure();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Exposição Cambial</CardTitle>
          </div>
        </CardHeader>
        <CardContent><Skeleton className="h-24 w-full" /></CardContent>
      </Card>
    );
  }

  if (!data || !data.has_foreign_currency) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-accent" />
            <CardTitle className="text-sm font-semibold">Exposição Cambial</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px]">
            Base: {data.base_currency}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-lg font-bold" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
          <MaskedValue>{formatCurrency(data.total_patrimony)}</MaskedValue>
        </div>
        <div className="space-y-2">
          {data.exposures.map((exp) => (
            <div key={exp.currency} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">
                  {exp.currency}
                </span>
                <span className="text-xs text-muted-foreground">
                  {exp.account_count} conta{exp.account_count > 1 ? "s" : ""}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">
                  <MaskedValue>{formatCurrency(exp.balance_original)}</MaskedValue>
                </p>
                <p className="text-[10px] text-muted-foreground">{exp.percentage.toFixed(1)}%</p>
              </div>
            </div>
          ))}
        </div>
        {/* Exposure bar */}
        <div className="flex h-2 rounded-full overflow-hidden bg-muted">
          {data.exposures.map((exp, i) => {
            const colors = ["bg-primary", "bg-accent", "bg-success", "bg-warning", "bg-destructive"];
            return (
              <div
                key={exp.currency}
                className={`${colors[i % colors.length]} transition-all`}
                style={{ width: `${exp.percentage}%` }}
              />
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
