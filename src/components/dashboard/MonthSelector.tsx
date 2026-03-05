import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  /** "overlay" = white text (dark bg), "overlay-mobile" = white on mobile / normal on desktop */
  variant?: "default" | "overlay" | "overlay-mobile";
}

export function MonthSelector({ selectedMonth, onMonthChange, variant = "default" }: MonthSelectorProps) {
  const handlePrev = () => onMonthChange(subMonths(selectedMonth, 1));
  const handleNext = () => onMonthChange(addMonths(selectedMonth, 1));

  const label = format(selectedMonth, "MMM yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const isOverlay = variant === "overlay";
  const isMobileOverlay = variant === "overlay-mobile";

  const btnBase = "flex items-center justify-center w-5 h-5 rounded-full transition-colors duration-150";
  const btnClass = isOverlay
    ? `${btnBase} text-white/60 hover:text-white hover:bg-white/10`
    : isMobileOverlay
    ? `${btnBase} text-white/60 md:text-foreground/40 hover:text-white md:hover:text-foreground hover:bg-white/10 md:hover:bg-foreground/5`
    : `${btnBase} text-foreground/35 hover:text-foreground hover:bg-foreground/5`;

  const labelClass = isOverlay
    ? "text-[10px] font-medium tracking-widest uppercase text-white w-[76px] text-center select-none tabular-nums"
    : isMobileOverlay
    ? "text-[9px] md:text-[10px] font-medium tracking-widest uppercase text-white md:text-foreground w-[64px] md:w-[76px] text-center select-none tabular-nums"
    : "text-[9px] font-medium tracking-widest uppercase text-foreground/60 w-[72px] text-center select-none tabular-nums";

  return (
    <div className="flex items-center gap-0.5">
      <button onClick={handlePrev} className={btnClass} aria-label="Mês anterior">
        <ChevronLeft className="h-2.5 w-2.5 stroke-[1.8]" />
      </button>
      <span className={labelClass}>{capitalizedLabel}</span>
      <button onClick={handleNext} className={btnClass} aria-label="Próximo mês">
        <ChevronRight className="h-2.5 w-2.5 stroke-[1.8]" />
      </button>
    </div>
  );
}
