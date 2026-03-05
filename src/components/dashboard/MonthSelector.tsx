import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  /** "overlay" = white text (dark bg), "overlay-mobile" = white on mobile / normal on desktop */
  variant?: "default" | "overlay" | "overlay-mobile";
}

export function MonthSelector({ selectedMonth, onMonthChange, variant = "default" }: MonthSelectorProps) {
  const handlePrev = () => onMonthChange(subMonths(selectedMonth, 1));
  const handleNext = () => onMonthChange(addMonths(selectedMonth, 1));

  const label = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const btnClass = variant === "overlay"
    ? "h-5 w-5 rounded-full text-white/80 hover:text-white hover:bg-white/15"
    : variant === "overlay-mobile"
    ? "h-5 w-5 rounded-full text-white/80 md:text-foreground hover:text-white md:hover:text-foreground hover:bg-white/15 md:hover:bg-muted/60"
    : "h-4 w-4 rounded-full text-foreground/60 hover:text-foreground hover:bg-muted/60";
  const labelClass = variant === "overlay"
    ? "text-[10px] font-semibold text-white min-w-[100px] text-center select-none"
    : variant === "overlay-mobile"
    ? "text-[10px] font-semibold text-white md:text-foreground min-w-[100px] text-center select-none"
    : "text-[9px] font-semibold text-foreground min-w-[90px] text-center select-none";

  return (
    <div className="flex items-center gap-0.5">
      <Button variant="ghost" size="icon" onClick={handlePrev} className={btnClass}>
        <ChevronLeft className="h-2.5 w-2.5" />
      </Button>
      <span className={labelClass}>{capitalizedLabel}</span>
      <Button variant="ghost" size="icon" onClick={handleNext} className={btnClass}>
        <ChevronRight className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
