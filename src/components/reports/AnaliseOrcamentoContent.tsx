import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBaseFilter } from "@/contexts/BaseFilterContext";
import { useBudgetAnalysis } from "@/hooks/useBudgetAnalysis";
import { BudgetVsActualChart } from "@/components/budget/BudgetVsActualChart";
import { BudgetAnalysisCard } from "@/components/budget/BudgetAnalysisCard";
import { BudgetAlerts } from "@/components/budget/BudgetAlerts";
import { BaseRequiredAlert } from "@/components/common/BaseRequiredAlert";
import {
  TrendingUp,
  TrendingDown,
  Target,
  Loader2,
  Calendar,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function AnaliseOrcamentoContent() {
  const { requiresBaseSelection } = useBaseFilter();
  const navigate = useNavigate();
  const currentDate = new Date();
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [year, setYear] = useState(currentDate.getFullYear());

  const { data, isLoading } = useBudgetAnalysis(month, year);

  const years = Array.from({ length: 5 }, (_, i) => currentDate.getFullYear() - 2 + i);

  if (requiresBaseSelection) {
    return (
      <div className="space-y-4">
        <BaseRequiredAlert action="analisar orçamentos" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          {data && (
            <>
              {data.overBudgetCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {data.overBudgetCount} excedido{data.overBudgetCount > 1 ? "s" : ""}
                </Badge>
              )}
              {data.warningCount > 0 && (
                <Badge variant="outline" className="gap-1 border-warning text-warning">
                  {data.warningCount} atenção
                </Badge>
              )}
              {data.overBudgetCount === 0 && data.warningCount === 0 && data.items.length > 0 && (
                <Badge variant="outline" className="gap-1 border-success text-success">
                  <CheckCircle className="h-3 w-3" />
                  Todos no limite
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Planejado
                </CardTitle>
                <Target className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className="text-lg font-bold">
                  {formatCurrency(data?.totalBudget || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total Realizado
                </CardTitle>
                <TrendingDown className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={cn(
                  "text-lg font-bold",
                  (data?.totalActual || 0) > (data?.totalBudget || 0) && "text-destructive"
                )}>
                  {formatCurrency(data?.totalActual || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Saldo Disponível
                </CardTitle>
                <TrendingUp className={cn(
                  "h-4 w-4",
                  (data?.totalVariance || 0) >= 0 ? "text-success" : "text-destructive"
                )} />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={cn(
                  "text-lg font-bold",
                  (data?.totalVariance || 0) >= 0 ? "text-success" : "text-destructive"
                )}>
                  {formatCurrency(data?.totalVariance || 0)}
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between py-2 px-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  % Utilizado
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="py-2 px-3">
                <p className={cn(
                  "text-lg font-bold",
                  data?.totalBudget && (data.totalActual / data.totalBudget) > 1 
                    ? "text-destructive" 
                    : (data?.totalBudget && (data.totalActual / data.totalBudget) > 0.8 
                      ? "text-warning" 
                      : "text-success")
                )}>
                  {data?.totalBudget 
                    ? ((data.totalActual / data.totalBudget) * 100).toFixed(1) 
                    : 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <BudgetAlerts showNotifications={false} />
          <BudgetVsActualChart month={month} year={year} />

          <div>
            <h3 className="text-base font-semibold mb-3">Detalhamento por Categoria</h3>
            {data?.items && data.items.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.items.map((item) => (
                  <BudgetAnalysisCard key={item.category_id} item={item} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Target className="h-10 w-10 text-muted-foreground mb-3" />
                  <h4 className="text-base font-semibold">Nenhum orçamento definido</h4>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Defina orçamentos na página de Orçamentos para visualizar a análise.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="mt-3"
                    onClick={() => navigate("/orcamentos")}
                  >
                    Ir para Orçamentos
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}
