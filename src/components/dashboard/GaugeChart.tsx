import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

interface GaugeChartProps {
  label: string;
  valorPlanejado: number;
  valorRealizado: number;
  /** Optional color override, defaults to fintech blue gradient */
  variant?: "blue" | "success" | "destructive";
  compact?: boolean;
}

export function GaugeChart({
  label,
  valorPlanejado,
  valorRealizado,
  variant = "blue",
  compact = false,
}: GaugeChartProps) {
  // Real percentage — no cap on displayed number (mathematical accuracy)
  const realPct = valorPlanejado > 0 ? (valorRealizado / valorPlanejado) * 100 : 0;
  // Visual arc capped at 100% so layout doesn't break, but number shows real %
  const displayPct = Math.min(realPct, 100);

  // 270° gauge = 3/4 circle
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const gaugeArc = circumference * 0.75; // 270°
  const filledArc = (displayPct / 100) * gaugeArc;

  // Rotation: start from bottom-left (135°)
  const startAngle = 135;

  const gradientId = `gauge-gradient-${label.replace(/\s/g, "")}`;

  const gradientColors = variant === "success"
    ? { start: "hsl(142, 76%, 60%)", end: "hsl(142, 76%, 36%)" }
    : variant === "destructive"
    ? { start: "hsl(0, 84%, 65%)", end: "hsl(0, 84%, 45%)" }
    : { start: "hsl(210, 100%, 72%)", end: "hsl(210, 100%, 36%)" };

  const isOver = realPct > 100;
  const size = compact ? "h-36 w-36" : "h-44 w-44";

  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      {/* 1. Label */}
      <p className="text-[10px] uppercase tracking-[0.15em] font-medium text-muted-foreground">
        {label}
      </p>
      {/* 2. Gauge — fixed 110×110 */}
      <div className="relative" style={{ width: 110, height: 110, flexShrink: 0 }}>
        <svg width="110" height="110" viewBox="0 0 120 120">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={gradientColors.start} />
              <stop offset="100%" stopColor={gradientColors.end} />
            </linearGradient>
          </defs>
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            className="stroke-muted/20"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${gaugeArc} ${circumference - gaugeArc}`}
            transform={`rotate(${startAngle} 60 60)`}
          />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={isOver ? "hsl(0, 84%, 60%)" : `url(#${gradientId})`}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${filledArc} ${circumference - filledArc}`}
            strokeDashoffset="0"
            transform={`rotate(${startAngle} 60 60)`}
            className="transition-all duration-700"
          />
        </svg>
        {/* Internal value removed — shown below for consistent hierarchy */}
      </div>
      {/* 3. Valor principal */}
      <span
        className={cn(
          "leading-none tabular-nums",
          isOver ? "text-destructive" : "text-foreground"
        )}
        style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 18, fontWeight: 600 }}
      >
        <MaskedValue>{formatCurrency(valorRealizado)}</MaskedValue>
      </span>
      {/* 4. Meta */}
      <span className="text-muted-foreground tabular-nums" style={{ fontSize: 12, opacity: 0.7 }}>
        de <MaskedValue>{formatCurrency(valorPlanejado)}</MaskedValue>
      </span>
      {/* 5. Percentual */}
      <span
        className={cn("tabular-nums font-medium", isOver ? "text-destructive" : "text-muted-foreground")}
        style={{ fontSize: 12 }}
      >
        {realPct >= 1000 ? `${Math.round(realPct).toLocaleString("pt-BR")}%` : `${realPct.toFixed(0)}%`} da meta
      </span>
    </div>
  );
}
