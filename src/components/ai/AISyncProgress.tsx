/**
 * Real-time sync progress counter for Open Finance imports.
 */
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw } from "lucide-react";

interface Props {
  current: number;
  total: number;
  label?: string;
  className?: string;
}

export function AISyncProgress({ current, total, label = "Importando", className }: Props) {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-xs text-primary">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        <span className="font-medium">
          {label} transação {current} de {total}...
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
