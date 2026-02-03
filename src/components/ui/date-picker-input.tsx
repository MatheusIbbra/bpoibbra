import { useState } from "react";
import { format, parse, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerInputProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function DatePickerInput({
  date,
  onDateChange,
  label,
  placeholder = "Selecione a data",
  className,
  disabled = false,
}: DatePickerInputProps) {
  const [inputValue, setInputValue] = useState(date ? format(date, "dd/MM/yyyy") : "");
  const [open, setOpen] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    // Remove non-digits
    const digits = value.replace(/\D/g, "");
    
    // Format as dd/MM/yyyy
    if (digits.length <= 2) {
      value = digits;
    } else if (digits.length <= 4) {
      value = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    } else {
      value = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    }
    
    setInputValue(value);
    
    // Try to parse the date when we have 8 digits
    if (digits.length === 8) {
      const parsed = parse(value, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onDateChange(parsed);
      }
    }
  };

  const handleCalendarSelect = (newDate: Date | undefined) => {
    onDateChange(newDate);
    if (newDate) {
      setInputValue(format(newDate, "dd/MM/yyyy"));
    }
    setOpen(false);
  };

  const handleInputBlur = () => {
    if (inputValue) {
      const parsed = parse(inputValue, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onDateChange(parsed);
        setInputValue(format(parsed, "dd/MM/yyyy"));
      } else {
        // Reset to current date value if invalid
        setInputValue(date ? format(date, "dd/MM/yyyy") : "");
      }
    }
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <div className="relative">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            disabled={disabled}
            className="pr-10"
            maxLength={10}
          />
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              disabled={disabled}
            >
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
        </div>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleCalendarSelect}
            initialFocus
            locale={ptBR}
            className="pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
