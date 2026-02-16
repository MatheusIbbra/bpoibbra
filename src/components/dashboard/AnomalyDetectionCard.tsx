import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ShieldAlert, TrendingUp } from "lucide-react";
import { useAnomalyDetection } from "@/hooks/useAnomalyDetection";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useValuesVisibility } from "@/contexts/ValuesVisibilityContext";

export function AnomalyDetectionCard() {
  const { selectedOrganizationId } = useBaseFilter();
  const { showValues } = useValuesVisibility();
  const { data: anomalies, isLoading } = useAnomalyDetection();

  if (!selectedOrganizationId || selectedOrganizationId === "all") return null;

  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="py-3 px-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm font-semibold">Detecção de Anomalias</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const outliers = anomalies?.transaction_outliers || [];
  const spikes = anomalies?.daily_spikes || [];
  const totalAnomalies = outliers.length + spikes.length;

  if (totalAnomalies === 0) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "destructive";
      case "high": return "default";
      default: return "secondary";
    }
  };

  const formatCurrency = (value: number) => {
    if (!showValues) return "•••••";
    return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
  };

  return (
    <Card className="shadow-sm border-destructive/20">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <CardTitle className="text-sm font-semibold">Anomalias Detectadas</CardTitle>
          </div>
          <Badge variant="destructive" className="text-[10px]">
            {totalAnomalies} alerta{totalAnomalies !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-3 pt-0 space-y-2">
        {outliers.slice(0, 3).map((outlier, i) => (
          <div key={i} className="flex items-start gap-2 p-2 rounded bg-destructive/5 border border-destructive/10">
            <AlertTriangle className="h-3.5 w-3.5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium truncate">{outlier.description}</p>
                <Badge variant={getSeverityColor(outlier.severity)} className="text-[9px] px-1 py-0">
                  {outlier.severity === "critical" ? "Crítico" : outlier.severity === "high" ? "Alto" : "Moderado"}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(outlier.amount)} — média {formatCurrency(outlier.avg_amount)} ({outlier.category})
              </p>
            </div>
          </div>
        ))}

        {spikes.slice(0, 2).map((spike, i) => (
          <div key={`spike-${i}`} className="flex items-start gap-2 p-2 rounded bg-warning/5 border border-warning/10">
            <TrendingUp className="h-3.5 w-3.5 text-warning flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-medium">Pico de despesa em {new Date(spike.date).toLocaleDateString("pt-BR")}</p>
                <Badge variant={getSeverityColor(spike.severity)} className="text-[9px] px-1 py-0">
                  {spike.z_score.toFixed(1)}σ
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {formatCurrency(spike.total)} — média diária {formatCurrency(spike.avg_daily)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
