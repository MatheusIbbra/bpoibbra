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
    <Card className={cn("transition-all hover:shadow-sm", item.status === "over" && "border-destructive/50")}>
      <CardContent className="py-3 px-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ backgroundColor: item.category_color }}
            />
            <span className="text-sm font-medium truncate">
              {item.category_name}
            </span>
          </div>
          <Badge className={cn("gap-1 text-[10px] px-1.5 py-0 shrink-0", config.bgColor, config.color, "border-0")}>
            <StatusIcon className="h-3 w-3" />
            {config.label}
          </Badge>
        </div>

        {item.cost_center_name && (
          <p className="text-[10px] text-muted-foreground -mt-1">
            CC: {item.cost_center_name}
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <p className="text-muted-foreground">Planejado</p>
            <p className="font-semibold text-sm">{formatCurrency(item.budget_amount)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Realizado</p>
            <p className={cn("font-semibold text-sm", item.status === "over" && "text-destructive")}>
              {formatCurrency(item.actual_amount)}
            </p>
          </div>
        </div>

        <Progress
          value={Math.min(item.variance_percentage, 100)}
          className={cn("h-1.5", config.progressColor)}
        />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {item.variance_percentage.toFixed(1)}%
          </span>
          <span className={cn(
            "font-medium",
            item.variance >= 0 ? "text-success" : "text-destructive"
          )}>
            {item.variance >= 0 ? "+" : "-"}{formatCurrency(Math.abs(item.variance))}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
