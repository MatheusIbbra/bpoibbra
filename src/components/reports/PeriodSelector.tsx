import { useState } from "react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarRange, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { DatePickerInput } from "@/components/ui/date-picker-input";

interface DateRange {
  start: Date;
  end: Date;
}

interface PeriodSelectorProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

const QUICK_PERIODS = [
  { 
    label: "Mês Atual", 
    getValue: () => ({ 
      start: startOfMonth(new Date()), 
      end: endOfMonth(new Date()) 
    })
  },
  { 
    label: "Mês Passado", 
    getValue: () => {
      const lastMonth = subMonths(new Date(), 1);
      return { 
        start: startOfMonth(lastMonth), 
        end: endOfMonth(lastMonth) 
      };
    }
  },
  { 
    label: "Últimos 3 Meses", 
    getValue: () => ({ 
      start: startOfMonth(subMonths(new Date(), 2)), 
      end: endOfMonth(new Date()) 
    })
  },
  { 
    label: "Últimos 6 Meses", 
    getValue: () => ({ 
      start: startOfMonth(subMonths(new Date(), 5)), 
      end: endOfMonth(new Date()) 
    })
  },
  { 
    label: "Este Ano", 
    getValue: () => ({ 
      start: startOfYear(new Date()), 
      end: endOfMonth(new Date()) 
    })
  },
  { 
    label: "Ano Passado", 
    getValue: () => {
      const lastYear = new Date().getFullYear() - 1;
      return { 
        start: new Date(lastYear, 0, 1), 
        end: new Date(lastYear, 11, 31) 
      };
    }
  },
];

export function PeriodSelector({ dateRange, onDateRangeChange, className }: PeriodSelectorProps) {
  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | undefined>(dateRange.start);
  const [tempEnd, setTempEnd] = useState<Date | undefined>(dateRange.end);

  const handleQuickPeriod = (getValue: () => DateRange) => {
    const range = getValue();
    onDateRangeChange(range);
    setTempStart(range.start);
    setTempEnd(range.end);
    setOpen(false);
  };

  const handleApply = () => {
    if (tempStart && tempEnd) {
      onDateRangeChange({ start: tempStart, end: tempEnd });
      setOpen(false);
    }
  };

  const formatDisplayRange = () => {
    return `${format(dateRange.start, "dd/MM/yyyy")} - ${format(dateRange.end, "dd/MM/yyyy")}`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between min-w-[280px]", className)}>
          <div className="flex items-center gap-2">
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
            <span>{formatDisplayRange()}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="start">
        <div className="p-4">
          <h4 className="font-medium mb-3">Selecionar Período</h4>
          
          {/* Quick Periods */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {QUICK_PERIODS.map((period) => (
              <Button
                key={period.label}
                variant="outline"
                size="sm"
                className="justify-start text-xs"
                onClick={() => handleQuickPeriod(period.getValue)}
              >
                {period.label}
              </Button>
            ))}
          </div>

          <Separator className="my-4" />

          {/* Custom Range */}
          <div className="space-y-4">
            <h5 className="text-sm font-medium text-muted-foreground">Período Personalizado</h5>
            
            <div className="grid grid-cols-2 gap-4">
              <DatePickerInput
                date={tempStart}
                onDateChange={setTempStart}
                label="Data Inicial"
                placeholder="DD/MM/AAAA"
              />
              <DatePickerInput
                date={tempEnd}
                onDateChange={setTempEnd}
                label="Data Final"
                placeholder="DD/MM/AAAA"
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleApply}
              disabled={!tempStart || !tempEnd}
            >
              Aplicar Período
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
