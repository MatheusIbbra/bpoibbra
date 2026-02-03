import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Lightbulb, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  Clock,
  Sparkles,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  AlertCircle
} from "lucide-react";
import { useStrategicInsights } from "@/hooks/useStrategicInsights";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function StrategicInsightsCard() {
  const { 
    insights, 
    isLoading, 
    isGenerating, 
    generateInsights, 
    hasValidBase 
  } = useStrategicInsights();

  const [expanded, setExpanded] = useState(false);

  // Se não tem base selecionada
  if (!hasValidBase) {
    return (
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights Estratégicos
          </CardTitle>
          <CardDescription>
            Selecione uma base específica para visualizar insights personalizados.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Loading inicial
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Lightbulb className="h-5 w-5 text-amber-500" />
            Insights Estratégicos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const insightsList = insights?.insights || [];
  const metrics = insights?.metrics;
  const createdAt = insights?.created_at;
  const isCached = insights?.cached;

  const getSeverityIcon = (severity: string) => {
    return severity === "warning" ? (
      <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
    ) : (
      <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
    );
  };

  const getSeverityBadge = (severity: string) => {
    return severity === "warning" ? (
      <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 dark:bg-amber-950/20">
        Atenção
      </Badge>
    ) : (
      <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50 dark:bg-blue-950/20">
        Observação
      </Badge>
    );
  };

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return "recentemente";
    }
  };

  // Insights para exibir (limitado se não expandido)
  const displayInsights = expanded ? insightsList : insightsList.slice(0, 3);
  const hasMore = insightsList.length > 3;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Lightbulb className="h-5 w-5 text-amber-500" />
              Insights Estratégicos
              <Sparkles className="h-4 w-4 text-purple-500" />
            </CardTitle>
            {createdAt && (
              <CardDescription className="flex items-center gap-1 text-xs">
                <Clock className="h-3 w-3" />
                Gerado {formatRelativeTime(createdAt)}
                {isCached && (
                  <Badge variant="secondary" className="ml-2 text-xs py-0">
                    Cache
                  </Badge>
                )}
              </CardDescription>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateInsights(true)}
            disabled={isGenerating}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            {isGenerating ? "Analisando..." : "Atualizar"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Métricas resumidas */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <PiggyBank className="h-4 w-4 text-emerald-500" />
                <span className="text-xs text-muted-foreground">Poupança</span>
              </div>
              <p className={`text-sm font-semibold ${metrics.savings_rate >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {metrics.savings_rate.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <span className="text-xs text-muted-foreground">Receita</span>
              </div>
              <p className={`text-sm font-semibold ${metrics.revenue_growth >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {metrics.revenue_growth >= 0 ? "+" : ""}{metrics.revenue_growth.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingDown className="h-4 w-4 text-orange-500" />
                <span className="text-xs text-muted-foreground">Despesas</span>
              </div>
              <p className={`text-sm font-semibold ${metrics.expense_growth <= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                {metrics.expense_growth >= 0 ? "+" : ""}{metrics.expense_growth.toFixed(1)}%
              </p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <AlertCircle className="h-4 w-4 text-purple-500" />
                <span className="text-xs text-muted-foreground">Orçamento</span>
              </div>
              <p className={`text-sm font-semibold ${Math.abs(metrics.budget_deviation) <= 10 ? "text-emerald-600" : "text-amber-600"}`}>
                {metrics.budget_deviation >= 0 ? "+" : ""}{metrics.budget_deviation.toFixed(1)}%
              </p>
            </div>
          </div>
        )}

        {/* Lista de insights */}
        {insightsList.length === 0 ? (
          <div className="text-center py-6">
            <Lightbulb className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-3">
              Nenhum insight gerado ainda para este período.
            </p>
            <Button
              variant="default"
              size="sm"
              onClick={() => generateInsights(false)}
              disabled={isGenerating}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? "Gerando..." : "Gerar Análise"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayInsights.map((insight, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg border transition-colors ${
                  insight.severity === "warning"
                    ? "bg-amber-50/50 border-amber-200 dark:bg-amber-950/10 dark:border-amber-800"
                    : "bg-blue-50/50 border-blue-200 dark:bg-blue-950/10 dark:border-blue-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(insight.severity)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-medium truncate">
                        {insight.title}
                      </h4>
                      {getSeverityBadge(insight.severity)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Botão expandir/recolher */}
            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="w-full text-muted-foreground"
              >
                {expanded 
                  ? "Mostrar menos" 
                  : `Ver mais ${insightsList.length - 3} insight${insightsList.length - 3 > 1 ? "s" : ""}`
                }
              </Button>
            )}
          </div>
        )}

        {/* Alerta de fluxo de caixa */}
        {metrics?.cashflow_risk && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Alerta de Fluxo de Caixa
                </p>
                <p className="text-xs text-red-600 dark:text-red-500">
                  As despesas estão acima de 90% das receitas neste período.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
