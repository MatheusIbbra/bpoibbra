import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, AlertTriangle, Bell, X } from "lucide-react";
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
  selectedMonth?: Date;
}

export function BudgetAlerts({ showNotifications = true, compact = false, selectedMonth }: BudgetAlertsProps) {
  const refDate = selectedMonth || new Date();
  const { data } = useBudgetAnalysis(refDate.getMonth() + 1, refDate.getFullYear());
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const alerts = data?.items.filter(
    (item) => (item.status === "warning" || item.status === "over") && !dismissed.has(item.category_id)
  ) || [];

  const warningAlerts = alerts.filter((a) => a.status === "warning");
  const overAlerts = alerts.filter((a) => a.status === "over");

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

  const handleDismiss = (categoryId: string) => {
    setDismissed(prev => new Set([...prev, categoryId]));
  };

  if (alerts.length === 0) {
    return compact ? null : (
      <div className="text-center py-2">
        <p className="text-[11px] text-muted-foreground">Nenhum alerta</p>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="space-y-1.5">
        {overAlerts.map((alert) => {
          const now = new Date();
          const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
          const remaining = alert.budget_amount - alert.actual_amount;
          
          return (
            <div key={alert.category_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-center gap-2 min-w-0">
                <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{alert.category_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Excedido em {formatCurrency(Math.abs(alert.variance))}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleDismiss(alert.category_id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
        {warningAlerts.map((alert) => {
          const now = new Date();
          const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
          const remaining = alert.budget_amount - alert.actual_amount;
          const dailyAvg = daysLeft > 0 ? remaining / daysLeft : 0;

          return (
            <div key={alert.category_id} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{alert.category_name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {alert.variance_percentage.toFixed(0)}% · Restam {formatCurrency(remaining)} ({formatCurrency(dailyAvg)}/dia)
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={() => handleDismiss(alert.category_id)}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
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
        {overAlerts.map((alert) => {
          const now = new Date();
          const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
          
          return (
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
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-destructive">
                    {formatCurrency(alert.actual_amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {formatCurrency(alert.budget_amount)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDismiss(alert.category_id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}

        {warningAlerts.map((alert) => {
          const now = new Date();
          const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
          const remaining = alert.budget_amount - alert.actual_amount;
          const dailyAvg = daysLeft > 0 ? remaining / daysLeft : 0;
          
          return (
            <div
              key={alert.category_id}
              className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/10 p-3"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
                <div>
                  <p className="font-medium text-sm">{alert.category_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {alert.variance_percentage.toFixed(0)}% utilizado · {formatCurrency(dailyAvg)}/dia restante
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <p className="text-sm font-semibold text-warning">
                    {formatCurrency(alert.actual_amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    de {formatCurrency(alert.budget_amount)}
                  </p>
                </div>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDismiss(alert.category_id)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
