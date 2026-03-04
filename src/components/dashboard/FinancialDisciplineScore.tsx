import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDisciplineScore } from "@/hooks/useDisciplineScore";
import { Target, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  selectedMonth: Date;
}

export function FinancialDisciplineScore({ selectedMonth }: Props) {
  const { score, tips, isLoading } = useDisciplineScore(selectedMonth);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Disciplina Financeira</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <Skeleton className="h-28 w-28 rounded-full" />
          <Skeleton className="h-4 w-40" />
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
      <CardContent className="flex flex-col items-center gap-4 py-4">
        {/* Circle score */}
        <div className="relative h-32 w-32">
          <svg className="h-32 w-32 -rotate-90" viewBox="0 0 120 120">
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

        {/* Tips */}
        {tips.length > 0 && (
          <div className="w-full space-y-1.5">
            {tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                <span>{tip}</span>
              </div>
            ))}
          </div>
        )}

        {tips.length === 0 && (
          <div className="flex items-center gap-2 text-xs text-success">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-medium">Disciplina perfeita!</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
