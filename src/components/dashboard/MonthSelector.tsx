import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  variant?: "default" | "overlay" | "overlay-mobile";
}

export function MonthSelector({ selectedMonth, onMonthChange, variant = "default" }: MonthSelectorProps) {
  const handlePrev = () => onMonthChange(subMonths(selectedMonth, 1));
  const handleNext = () => onMonthChange(addMonths(selectedMonth, 1));

  const label = format(selectedMonth, "MMM yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const isOverlay = variant === "overlay";
  const isMobileOverlay = variant === "overlay-mobile";

  const btnClass = isOverlay
    ? "flex items-center justify-center w-4 h-4 text-white/50 hover:text-white transition-colors"
    : isMobileOverlay
    ? "flex items-center justify-center w-4 h-4 text-white/50 md:text-foreground/30 hover:text-white md:hover:text-foreground transition-colors"
    : "flex items-center justify-center w-4 h-4 text-foreground/30 hover:text-foreground/70 transition-colors";

  const labelClass = isOverlay
    ? "text-[9px] font-semibold tracking-[0.15em] uppercase text-white/80 w-[62px] text-center select-none"
    : isMobileOverlay
    ? "text-[9px] font-semibold tracking-[0.15em] uppercase text-white/80 md:text-foreground/60 w-[62px] text-center select-none"
    : "text-[9px] font-semibold tracking-[0.15em] uppercase text-foreground/55 w-[62px] text-center select-none";

  return (
    <div className="flex items-center gap-px">
      <button onClick={handlePrev} className={btnClass} aria-label="Mês anterior">
        <ChevronLeft className="h-2 w-2 stroke-[2]" />
      </button>
      <span className={labelClass}>{capitalizedLabel}</span>
      <button onClick={handleNext} className={btnClass} aria-label="Próximo mês">
        <ChevronRight className="h-2 w-2 stroke-[2]" />
      </button>
    </div>
  );
}
