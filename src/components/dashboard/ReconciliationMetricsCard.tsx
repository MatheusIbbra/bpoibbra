import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useReconciliationMetrics } from "@/hooks/useReconciliationMetrics";
import { useIsAdmin } from "@/hooks/useUserRoles";
import { 
  Brain, 
  Zap, 
  Clock, 
  CheckCircle2, 
  Scale, 
  Sparkles,
  TrendingUp,
  Loader2
} from "lucide-react";

export function ReconciliationMetricsCard() {
  const { isAdmin, isLoading: checkingAdmin } = useIsAdmin();
  const { data: metrics, isLoading } = useReconciliationMetrics();

  // Only show to admins
  if (checkingAdmin) return null;
  if (!isAdmin) return null;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!metrics) return null;

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  };

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-primary" />
            Motor de Conciliação
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Admin
          </Badge>
        </div>
        <CardDescription>
          Performance do sistema de auto-classificação
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Auto-validation Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="h-4 w-4" />
              Taxa de Auto-Validação
            </span>
            <span className="font-bold text-primary">
              {metrics.autoValidationRate.toFixed(1)}%
            </span>
          </div>
          <Progress 
            value={metrics.autoValidationRate} 
            className="h-2"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{metrics.autoValidated} automáticas</span>
            <span>{metrics.manuallyValidated} manuais</span>
          </div>
        </div>

        {/* Classification Sources */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <Scale className="h-4 w-4 text-blue-500 mb-1" />
            <span className="text-lg font-bold">{metrics.autoByRule}</span>
            <span className="text-[10px] text-muted-foreground text-center">Por Regra</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <TrendingUp className="h-4 w-4 text-green-500 mb-1" />
            <span className="text-lg font-bold">{metrics.autoByPattern}</span>
            <span className="text-[10px] text-muted-foreground text-center">Aprendido</span>
          </div>
          <div className="flex flex-col items-center p-2 rounded-lg bg-muted/50">
            <Sparkles className="h-4 w-4 text-purple-500 mb-1" />
            <span className="text-lg font-bold">{metrics.autoByAI}</span>
            <span className="text-[10px] text-muted-foreground text-center">Por IA</span>
          </div>
        </div>

        {/* Time Saved & Patterns */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <Clock className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-green-600 dark:text-green-400">
                {formatTime(metrics.estimatedTimeSaved)}
              </p>
              <p className="text-[10px] text-muted-foreground">Tempo economizado</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">
                {metrics.highConfidencePatterns}/{metrics.totalPatterns}
              </p>
              <p className="text-[10px] text-muted-foreground">Padrões confiáveis</p>
            </div>
          </div>
        </div>

        {/* Pending Alert */}
        {metrics.pending > 0 && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-warning/10 border border-warning/20">
            <CheckCircle2 className="h-4 w-4 text-warning" />
            <span className="text-xs">
              <strong>{metrics.pending}</strong> transações aguardando validação
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
