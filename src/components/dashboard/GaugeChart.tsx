import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

type GaugeVariant = "income" | "investment" | "expense" | "blue" | "success" | "destructive";

interface GaugeChartProps {
  label: string;
  valorPlanejado: number;
  valorRealizado: number;
  variant?: GaugeVariant;
  compact?: boolean;
}

/**
 * Returns stroke gradient colors and text color based on variant and percentage.
 *
 * income / investment: more is BETTER — never red
 *   0–50%   → amber/warning
 *   50–100% → green
 *   >100%   → premium dark-green (extra bonus)
 *
 * expense: more is WORSE
 *   0–50%   → green
 *   50–80%  → amber
 *   80–100% → orange
 *   >100%   → red
 */
function resolveGaugeColors(variant: GaugeVariant, pct: number): {
  gradStart: string;
  gradEnd: string;
  textClass: string;
} {
  if (variant === "expense" || variant === "destructive") {
    // Expenses: lower = better
    if (pct > 100) return { gradStart: "hsl(0 84% 52%)", gradEnd: "hsl(0 72% 38%)",      textClass: "text-destructive" };
    if (pct > 80)  return { gradStart: "hsl(25 95% 55%)", gradEnd: "hsl(15 90% 40%)",    textClass: "text-orange-500" };
    if (pct > 50)  return { gradStart: "hsl(var(--warning))", gradEnd: "hsl(38 92% 40%)", textClass: "text-warning" };
    return { gradStart: "hsl(var(--fi-income))", gradEnd: "hsl(142 71% 30%)",             textClass: "text-success" };
  }

  // income / investment / blue / success: higher = better — never red
  if (pct > 130) return { gradStart: "hsl(142 80% 38%)", gradEnd: "hsl(155 90% 25%)",   textClass: "text-emerald-500" };
  if (pct > 100) return { gradStart: "hsl(142 71% 45%)", gradEnd: "hsl(142 71% 30%)",   textClass: "text-success" };
  if (pct > 50)  return { gradStart: "hsl(var(--fi-income))", gradEnd: "hsl(142 71% 30%)", textClass: "text-success" };
  return { gradStart: "hsl(var(--warning))", gradEnd: "hsl(38 92% 42%)",                textClass: "text-warning" };
}

export function GaugeChart({
  label,
  valorPlanejado,
  valorRealizado,
  variant = "blue",
  compact = false,
}: GaugeChartProps) {
  const realPct    = valorPlanejado > 0 ? (valorRealizado / valorPlanejado) * 100 : 0;
  const displayPct = Math.min(realPct, 100);

  const radius        = 52;
  const circumference = 2 * Math.PI * radius;
  const gaugeArc      = circumference * 0.75; // 270°
  const filledArc     = (displayPct / 100) * gaugeArc;
  const startAngle    = 135;

  const gradientId = `gauge-gradient-${label.replace(/\s/g, "")}`;
  const { gradStart, gradEnd, textClass } = resolveGaugeColors(variant, realPct);

  const isExpense = variant === "expense" || variant === "destructive";
  const isOverBudget = isExpense && realPct > 100;

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {/* 1. Label */}
      <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground text-center">
        {label}
      </p>

      {/* 2. Gauge — fixed 110×110 */}
      <div className="relative" style={{ width: 110, height: 110, flexShrink: 0 }}>
        <svg width="110" height="110" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradStart} />
              <stop offset="100%" stopColor={gradEnd} />
            </linearGradient>
          </defs>
          {/* Track */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            className="stroke-muted/20"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${gaugeArc} ${circumference - gaugeArc}`}
            transform={`rotate(${startAngle} 60 60)`}
          />
          {/* Fill */}
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filledArc} ${circumference - filledArc}`}
            strokeDashoffset="0"
            transform={`rotate(${startAngle} 60 60)`}
            className="transition-all duration-700"
          />
        </svg>
      </div>

      {/* 3. Valor principal */}
      <span
        className={cn("leading-none tabular-nums text-center", textClass)}
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 600 }}
      >
        <MaskedValue>{formatCurrency(valorRealizado)}</MaskedValue>
      </span>

      {/* 4. Meta */}
      <span className="tabular-nums text-center" style={{ fontSize: 12, opacity: 0.7, color: "hsl(var(--muted-foreground))" }}>
        de <MaskedValue>{formatCurrency(valorPlanejado)}</MaskedValue>
      </span>

      {/* 5. Percentual — expense shows "do orçamento", others show "da meta" */}
      <span
        className={cn("tabular-nums font-medium text-center", textClass)}
        style={{ fontSize: 12 }}
      >
        {realPct >= 1000
          ? `${Math.round(realPct).toLocaleString("pt-BR")}%`
          : `${realPct.toFixed(0)}%`}{" "}
        {isExpense ? "do orçamento" : "da meta"}
        {!isExpense && realPct > 100 && " 🎯"}
      </span>
    </div>
  );
}
