import { useEffect } from "react";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { cn } from "@/lib/utils";

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

interface BudgetAlertsProps {
  showNotifications?: boolean;
  compact?: boolean;
}

export function BudgetAlerts({ showNotifications = true, compact = false }: BudgetAlertsProps) {
  const { data } = useBudgetAnalysis();

  const alerts = data?.items.filter(
    (item) => item.status === "warning" || item.status === "over"
  ) || [];

  const warningAlerts = alerts.filter((a) => a.status === "warning");
  const overAlerts = alerts.filter((a) => a.status === "over");

  // Show toast notifications for over-budget items
  useEffect(() => {
    if (showNotifications && overAlerts.length > 0) {
      overAlerts.forEach((alert) => {
        toast.error(`Orçamento excedido: ${alert.category_name}`, {
          description: `Gasto ${formatCurrency(alert.actual_amount)} de ${formatCurrency(alert.budget_amount)}`,
          duration: 5000,
        });
      });
    }
  }, [overAlerts.length, showNotifications]);

  if (alerts.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {overAlerts.length > 0 && (
          <Badge variant="destructive" className="gap-1">
            <AlertCircle className="h-3 w-3" />
            {overAlerts.length} excedido{overAlerts.length > 1 ? "s" : ""}
          </Badge>
        )}
        {warningAlerts.length > 0 && (
          <Badge variant="outline" className="gap-1 border-warning text-warning">
            <AlertTriangle className="h-3 w-3" />
            {warningAlerts.length} atenção
          </Badge>
        )}
      </div>
    );
  }

  return (
    <Card className="border-warning/50 bg-warning/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4 text-warning" />
          Alertas de Orçamento
          <Badge variant="secondary" className="ml-auto">
            {alerts.length} alerta{alerts.length > 1 ? "s" : ""}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {overAlerts.map((alert) => (
          <div
            key={alert.category_id}
            className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/10 p-3"
          >
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="font-medium text-sm">{alert.category_name}</p>
                <p className="text-xs text-muted-foreground">
                  Excedido em {formatCurrency(Math.abs(alert.variance))}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-destructive">
                {formatCurrency(alert.actual_amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                de {formatCurrency(alert.budget_amount)}
              </p>
            </div>
          </div>
        ))}

        {warningAlerts.map((alert) => (
          <div
            key={alert.category_id}
            className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
              <div>
                <p className="font-medium text-sm">{alert.category_name}</p>
                <p className="text-xs text-muted-foreground">
                  {alert.variance_percentage.toFixed(0)}% do orçamento utilizado
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-warning">
                {formatCurrency(alert.actual_amount)}
              </p>
              <p className="text-xs text-muted-foreground">
                de {formatCurrency(alert.budget_amount)}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
