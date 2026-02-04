import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Lightbulb, 
  RefreshCw, 
  AlertTriangle, 
  Info, 
  ChevronDown,
  ChevronUp,
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

  const [isOpen, setIsOpen] = useState(false);

  // Se não tem base selecionada
  if (!hasValidBase) {
    return null;
  }

  // Loading inicial
  if (isLoading) {
    return (
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-semibold">Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3">
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const insightsList = insights?.insights || [];
  const createdAt = insights?.created_at;

  const getSeverityIcon = (severity: string) => {
    return severity === "warning" ? (
      <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
    ) : (
      <Info className="h-3 w-3 text-blue-500 flex-shrink-0" />
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

  // Show only first insight, rest in collapsible
  const firstInsight = insightsList[0];
  const remainingInsights = insightsList.slice(1, 3);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="shadow-sm">
        <CardHeader className="py-2 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-semibold">Insights</CardTitle>
              {createdAt && (
                <span className="text-[10px] text-muted-foreground">
                  {formatRelativeTime(createdAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateInsights(true)}
                disabled={isGenerating}
                className="h-6 w-6 p-0"
              >
                <RefreshCw className={`h-3 w-3 ${isGenerating ? "animate-spin" : ""}`} />
              </Button>
              {insightsList.length > 1 && (
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  </Button>
                </CollapsibleTrigger>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-3 pt-0">
          {insightsList.length === 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateInsights(false)}
              disabled={isGenerating}
              className="w-full h-8 text-xs"
            >
              {isGenerating ? "Gerando..." : "Gerar Análise"}
            </Button>
          ) : (
            <div className="space-y-2">
              {/* First insight always visible */}
              {firstInsight && (
                <div className="flex items-start gap-2 p-2 rounded bg-muted/50">
                  {getSeverityIcon(firstInsight.severity)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{firstInsight.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {firstInsight.description}
                    </p>
                  </div>
                </div>
              )}

              {/* Remaining insights in collapsible */}
              <CollapsibleContent className="space-y-2">
                {remainingInsights.map((insight, index) => (
                  <div key={index} className="flex items-start gap-2 p-2 rounded bg-muted/50">
                    {getSeverityIcon(insight.severity)}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{insight.title}</p>
                      <p className="text-[10px] text-muted-foreground line-clamp-2">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                ))}
              </CollapsibleContent>

              {insightsList.length > 1 && !isOpen && (
                <p className="text-[10px] text-muted-foreground text-center">
                  +{insightsList.length - 1} mais
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Collapsible>
  );
}
