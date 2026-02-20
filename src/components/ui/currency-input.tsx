import * as React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  prefix?: string;
}

/**
 * Masked currency input that displays values as R$ 1.234,56
 * Internally works with number (float) values.
 */
const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, className, placeholder = "R$ 0,00", disabled, prefix = "R$ " }, ref) => {
    const [displayValue, setDisplayValue] = React.useState("");

    // Format number to BRL display string (without prefix, just digits with separators)
    const formatToDisplay = React.useCallback(
      (num: number): string => {
        if (num === 0) return "";
        const formatted = num.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
        return formatted;
      },
      []
    );

    // Sync display when value changes externally
    React.useEffect(() => {
      setDisplayValue(formatToDisplay(value));
    }, [value, formatToDisplay]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;

      // Strip everything except digits
      const digits = raw.replace(/\D/g, "");

      if (digits === "") {
        setDisplayValue("");
        onChange(0);
        return;
      }

      // Convert to cents then to float
      const cents = parseInt(digits, 10);
      const numericValue = cents / 100;

      // Cap at a reasonable max to prevent overflow
      if (numericValue > 999999999.99) return;

      setDisplayValue(formatToDisplay(numericValue));
      onChange(numericValue);
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      // Select all on focus for easy replacement
      setTimeout(() => e.target.select(), 0);
    };

    return (
      <div className="relative">
        {displayValue && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none text-sm">
            {prefix}
          </span>
        )}
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={cn(
            "flex h-11 w-full rounded-xl border border-input bg-background px-4 py-2.5 text-base ring-offset-background placeholder:text-muted-foreground/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/20 focus-visible:ring-offset-0 focus-visible:border-accent/40 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all duration-200",
            displayValue && "pl-12",
            className
          )}
        />
      </div>
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };
