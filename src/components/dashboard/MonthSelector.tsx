import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MonthSelectorProps {
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
}

export function MonthSelector({ selectedMonth, onMonthChange }: MonthSelectorProps) {
  const handlePrev = () => onMonthChange(subMonths(selectedMonth, 1));
  const handleNext = () => onMonthChange(addMonths(selectedMonth, 1));

  const label = format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="h-5 w-5 rounded-full text-muted-foreground md:text-muted-foreground text-white/70 hover:text-white md:hover:text-foreground hover:bg-white/10 md:hover:bg-muted/60"
      >
        <ChevronLeft className="h-3 w-3" />
      </Button>
      <span className="text-[11px] font-medium text-white md:text-foreground min-w-[120px] text-center select-none">
        {capitalizedLabel}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-5 w-5 rounded-full text-muted-foreground md:text-muted-foreground text-white/70 hover:text-white md:hover:text-foreground hover:bg-white/10 md:hover:bg-muted/60"
      >
        <ChevronRight className="h-3 w-3" />
      </Button>
    </div>
  );
}
