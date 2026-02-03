import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, AlertTriangle, CheckCircle, TrendingDown } from "lucide-react";
import { BudgetAnalysisItem } from "@/hooks/useBudgetAnalysis";
import { cn } from "@/lib/utils";

interface BudgetAnalysisCardProps {
  item: BudgetAnalysisItem;
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

const statusConfig = {
  under: {
    icon: TrendingDown,
    label: "Abaixo",
    color: "text-blue-500",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    progressColor: "",
  },
  on_track: {
    icon: CheckCircle,
    label: "No caminho",
    color: "text-success",
    bgColor: "bg-success/10",
    progressColor: "",
  },
  warning: {
    icon: AlertTriangle,
    label: "Atenção",
    color: "text-warning",
    bgColor: "bg-warning/10",
    progressColor: "[&>div]:bg-warning",
  },
  over: {
    icon: AlertCircle,
    label: "Excedido",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
    progressColor: "[&>div]:bg-destructive",
  },
};

export function BudgetAnalysisCard({ item }: BudgetAnalysisCardProps) {
  const config = statusConfig[item.status];
  const StatusIcon = config.icon;

  return (
    <Card className={cn("transition-all hover:shadow-md", item.status === "over" && "border-destructive/50")}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: item.category_color }}
            />
            <CardTitle className="text-base font-medium">
              {item.category_name}
            </CardTitle>
          </div>
          <Badge className={cn("gap-1", config.bgColor, config.color, "border-0")}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>
        {item.cost_center_name && (
          <p className="text-xs text-muted-foreground">
            Centro de custo: {item.cost_center_name}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Planejado</p>
            <p className="font-semibold">{formatCurrency(item.budget_amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Realizado</p>
            <p className={cn("font-semibold", item.status === "over" && "text-destructive")}>
              {formatCurrency(item.actual_amount)}
            </p>
          </div>
        </div>

        <Progress
          value={Math.min(item.variance_percentage, 100)}
          className={cn("h-2", config.progressColor)}
        />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {item.variance_percentage.toFixed(1)}% utilizado
          </span>
          <span className={cn(
            "font-medium",
            item.variance >= 0 ? "text-success" : "text-destructive"
          )}>
            {item.variance >= 0 ? "Saldo: " : "Excedido: "}
            {formatCurrency(Math.abs(item.variance))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
