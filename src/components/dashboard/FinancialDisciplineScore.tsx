import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisciplineScore, DisciplineIndicator } from "@/hooks/useDisciplineScore";
import { Target, CheckCircle2, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedMonth: Date;
}

function IndicatorRow({ ind }: { ind: DisciplineIndicator }) {
  const StatusIcon =
    ind.status === "ok" ? TrendingUp :
    ind.status === "warning" ? Minus :
    TrendingDown;

  const statusColor =
    ind.status === "ok" ? "text-success" :
    ind.status === "warning" ? "text-warning" :
    "text-destructive";

  const barColor =
    ind.status === "ok" ? "bg-success" :
    ind.status === "warning" ? "bg-warning" :
    "bg-destructive";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <StatusIcon className={cn("h-3 w-3 shrink-0", statusColor)} />
          <span className="font-medium text-foreground">{ind.label}</span>
        </div>
        <span className={cn("font-semibold tabular-nums", statusColor)}>
          {ind.points}/{ind.maxPoints}
        </span>
      </div>
      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${ind.pct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground leading-tight">{ind.detail}</p>
    </div>
  );
}

export function FinancialDisciplineScore({ selectedMonth }: Props) {
  const { score, indicators, tips, isLoading } = useDisciplineScore(selectedMonth);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Disciplina Financeira</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 py-4">
          <Skeleton className="h-28 w-28 rounded-full mx-auto" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  const color = score >= 70 ? "text-success" : score >= 40 ? "text-warning" : "text-destructive";
  const ringColor = score >= 70 ? "stroke-success" : score >= 40 ? "stroke-warning" : "stroke-destructive";
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-semibold">Disciplina Financeira</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 py-3">
        {/* Circle score */}
        <div className="flex justify-center">
          <div className="relative h-28 w-28">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="52" fill="none" className="stroke-muted/30" strokeWidth="8" />
              <circle
                cx="60" cy="60" r="52"
                fill="none"
                className={cn(ringColor, "transition-all duration-700")}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-bold", color)} style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
                {score}
              </span>
              <span className="text-[10px] text-muted-foreground">/100</span>
            </div>
          </div>
        </div>

        {/* Indicators */}
        {indicators.length > 0 && (
          <div className="space-y-3 border-t pt-3">
            {indicators.map((ind, i) => (
              <IndicatorRow key={i} ind={ind} />
            ))}
          </div>
        )}

        {/* Summary */}
        {tips.length === 0 ? (
          <div className="flex items-center gap-2 text-xs text-success border-t pt-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="font-medium">Disciplina perfeita neste mês!</span>
          </div>
        ) : (
          <div className="space-y-1 border-t pt-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              O que melhorar
            </p>
            {tips.slice(0, 3).map((tip, i) => (
              <div key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3 text-warning shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
