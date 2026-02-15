import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useFinancialHealthScore } from "@/hooks/useFinancialHealthScore";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";
import { 
  Activity, 
  TrendingDown, 
  TrendingUp, 
  Clock, 
  Flame,
  PiggyBank,
  Target
} from "lucide-react";

function getScoreColor(score: number) {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-warning";
  return "text-destructive";
}

function getScoreLabel(score: number) {
  if (score >= 80) return "Excelente";
  if (score >= 65) return "Bom";
  if (score >= 50) return "Regular";
  if (score >= 35) return "Atenção";
  return "Crítico";
}

function getScoreBadgeVariant(score: number): "default" | "secondary" | "destructive" | "outline" {
  if (score >= 65) return "default";
  if (score >= 50) return "secondary";
  return "destructive";
}

export function FinancialHealthCard() {
  const { data: health, isLoading } = useFinancialHealthScore();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Saúde Financeira</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!health) return null;

  const metrics = [
    {
      label: "Runway",
      value: health.runway_months >= 99 ? "∞" : `${health.runway_months} meses`,
      icon: <Clock className="h-3.5 w-3.5" />,
      detail: "Meses até o caixa zerar",
    },
    {
      label: "Burn Rate",
      value: formatCurrency(health.burn_rate),
      icon: <Flame className="h-3.5 w-3.5" />,
      detail: "Média mensal de saídas (3m)",
    },
    {
      label: "Taxa de Poupança",
      value: `${health.savings_rate.toFixed(1)}%`,
      icon: <PiggyBank className="h-3.5 w-3.5" />,
      detail: "Receita retida no período",
    },
    {
      label: "Concentração",
      value: `${health.expense_concentration.toFixed(1)}%`,
      icon: <Target className="h-3.5 w-3.5" />,
      detail: "Maior categoria de saída",
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Saúde Financeira</CardTitle>
          </div>
          <Badge variant={getScoreBadgeVariant(health.score)}>
            {getScoreLabel(health.score)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-3xl font-bold ${getScoreColor(health.score)}`} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {health.score}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <Progress value={health.score} className="h-2" />
          </div>
        </div>

        {/* Growth indicators */}
        <div className="flex gap-3">
          <div className="flex items-center gap-1 text-xs">
            {health.revenue_growth >= 0 ? (
              <TrendingUp className="h-3 w-3 text-success" />
            ) : (
              <TrendingDown className="h-3 w-3 text-destructive" />
            )}
            <span className={health.revenue_growth >= 0 ? "text-success" : "text-destructive"}>
              {health.revenue_growth >= 0 ? "+" : ""}{health.revenue_growth.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">receitas</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {health.expense_growth <= 0 ? (
              <TrendingDown className="h-3 w-3 text-success" />
            ) : (
              <TrendingUp className="h-3 w-3 text-destructive" />
            )}
            <span className={health.expense_growth <= 0 ? "text-success" : "text-destructive"}>
              {health.expense_growth >= 0 ? "+" : ""}{health.expense_growth.toFixed(1)}%
            </span>
            <span className="text-muted-foreground">despesas</span>
          </div>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 gap-2">
          {metrics.map((metric) => (
            <div key={metric.label} className="p-2.5 rounded-lg bg-muted/50 space-y-0.5">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                {metric.icon}
                <span className="text-[10px] uppercase tracking-wider font-medium">{metric.label}</span>
              </div>
              <p className="text-sm font-semibold">
                <MaskedValue>{metric.value}</MaskedValue>
              </p>
              <p className="text-[10px] text-muted-foreground">{metric.detail}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
