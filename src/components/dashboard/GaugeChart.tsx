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

// Map variant → CSS variable token (HSL values from design system)
const VARIANT_COLORS: Record<GaugeVariant, { start: string; end: string }> = {
  income:      { start: "hsl(var(--fi-income))",     end: "hsl(142 71% 30%)" },
  investment:  { start: "hsl(var(--fi-investment))", end: "hsl(217 91% 45%)" },
  expense:     { start: "hsl(var(--fi-expense))",    end: "hsl(0 84% 45%)" },
  // Legacy aliases kept for backwards compatibility
  success:     { start: "hsl(var(--fi-income))",     end: "hsl(142 71% 30%)" },
  destructive: { start: "hsl(var(--fi-expense))",    end: "hsl(0 84% 45%)" },
  blue:        { start: "hsl(var(--fi-investment))", end: "hsl(217 91% 45%)" },
};

export function GaugeChart({
  label,
  valorPlanejado,
  valorRealizado,
  variant = "blue",
  compact = false,
}: GaugeChartProps) {
  const realPct    = valorPlanejado > 0 ? (valorRealizado / valorPlanejado) * 100 : 0;
  const displayPct = Math.min(realPct, 100);

  const radius      = 52;
  const circumference = 2 * Math.PI * radius;
  const gaugeArc    = circumference * 0.75; // 270°
  const filledArc   = (displayPct / 100) * gaugeArc;
  const startAngle  = 135;

  const gradientId    = `gauge-gradient-${label.replace(/\s/g, "")}`;
  const gradientColors = VARIANT_COLORS[variant] ?? VARIANT_COLORS.blue;
  const isOver        = realPct > 100;

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
              <stop offset="0%" stopColor={isOver ? "hsl(var(--fi-expense))" : gradientColors.start} />
              <stop offset="100%" stopColor={isOver ? "hsl(0 84% 40%)" : gradientColors.end} />
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
        className={cn("leading-none tabular-nums text-center", isOver ? "text-destructive" : "text-foreground")}
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 600 }}
      >
        <MaskedValue>{formatCurrency(valorRealizado)}</MaskedValue>
      </span>

      {/* 4. Meta */}
      <span className="tabular-nums text-center" style={{ fontSize: 12, opacity: 0.7, color: "hsl(var(--muted-foreground))" }}>
        de <MaskedValue>{formatCurrency(valorPlanejado)}</MaskedValue>
      </span>

      {/* 5. Percentual */}
      <span
        className={cn("tabular-nums font-medium text-center", isOver ? "text-destructive" : "text-muted-foreground")}
        style={{ fontSize: 12 }}
      >
        {realPct >= 1000
          ? `${Math.round(realPct).toLocaleString("pt-BR")}%`
          : `${realPct.toFixed(0)}%`} da meta
      </span>
    </div>
  );
}
