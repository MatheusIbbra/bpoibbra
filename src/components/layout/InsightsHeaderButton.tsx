import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Lightbulb,
  RefreshCw,
  AlertTriangle,
  Info,
} from "lucide-react";
import { useStrategicInsights } from "@/hooks/useStrategicInsights";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export function InsightsHeaderButton() {
  const {
    insights,
    isLoading,
    isGenerating,
    generateInsights,
    hasValidBase,
  } = useStrategicInsights();
  const { hasFeature } = useFeatureFlags();

  const [open, setOpen] = useState(false);

  if (!hasValidBase || !hasFeature("strategic_insights")) return null;

  const insightsList = insights?.insights || [];
  const createdAt = insights?.created_at;

  const getSeverityIcon = (severity: string) =>
    severity === "warning" ? (
      <AlertTriangle className="h-3.5 w-3.5 text-warning flex-shrink-0" />
    ) : (
      <Info className="h-3.5 w-3.5 text-info flex-shrink-0" />
    );

  const formatRelativeTime = (dateString: string) => {
    try {
      return formatDistanceToNow(new Date(dateString), {
        addSuffix: true,
        locale: ptBR,
      });
    } catch {
      return "recentemente";
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 text-sidebar-muted hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
        >
          <Lightbulb className="h-4 w-4" />
          {insightsList.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-warning text-[9px] font-bold text-warning-foreground flex items-center justify-center">
              {insightsList.length}
            </span>
          )}
          <span className="sr-only">Insights</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[380px] sm:w-[420px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-warning" />
              <SheetTitle className="text-base">Insights Estratégicos</SheetTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => generateInsights(true)}
              disabled={isGenerating}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
            </Button>
          </div>
          {createdAt && (
            <p className="text-xs text-muted-foreground">
              Atualizado {formatRelativeTime(createdAt)}
            </p>
          )}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : insightsList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Lightbulb className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhum insight disponível.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => generateInsights(false)}
                disabled={isGenerating}
              >
                {isGenerating ? "Gerando..." : "Gerar Análise"}
              </Button>
            </div>
          ) : (
            insightsList.map((insight: any, index: number) => (
              <div
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors"
              >
                {getSeverityIcon(insight.severity)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{insight.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
