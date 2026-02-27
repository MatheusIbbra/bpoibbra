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
  // Capitalize first letter
  const capitalizedLabel = label.charAt(0).toUpperCase() + label.slice(1);

  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={handlePrev}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm font-medium text-foreground min-w-[180px] text-center select-none">
        {capitalizedLabel}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleNext}
        className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
