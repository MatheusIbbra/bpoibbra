import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  /** When true, uses light text for overlay on dark backgrounds (dashboard). Default: false */
  variant?: "default" | "overlay";
}

export function MonthSelector({ selectedMonth, onMonthChange, variant = "default" }: MonthSelectorProps) {
  const handlePrev = () => onMonthChange(subMonths(selectedMonth, 1));
  const handleNext = () => onMonthChange(addMonths(selectedMonth, 1));

  const label = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  const isOverlay = variant === "overlay";
  const btnClass = isOverlay
    ? "h-5 w-5 rounded-full text-white/70 hover:text-white hover:bg-white/10"
    : "h-5 w-5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60";
  const labelClass = isOverlay
    ? "text-[11px] font-medium text-white min-w-[120px] text-center select-none"
    : "text-[11px] font-medium text-foreground min-w-[120px] text-center select-none";

  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={handlePrev} className={btnClass}>
        <ChevronLeft className="h-3 w-3" />
      </Button>
      <span className={labelClass}>{capitalizedLabel}</span>
      <Button variant="ghost" size="icon" onClick={handleNext} className={btnClass}>
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
