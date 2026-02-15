import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { MaskedValue } from "@/contexts/ValuesVisibilityContext";

interface StatCardProps {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  onClick?: () => void;
  hoverContent?: ReactNode;
}

export function StatCard({
  title,
  value,
  icon,
  trend,
  description,
  variant = "default",
  onClick,
  hoverContent,
}: StatCardProps) {
  const variantAccent = {
    default: "bg-accent/8 text-accent",
    success: "bg-success/8 text-success",
    warning: "bg-warning/8 text-warning",
    destructive: "bg-destructive/8 text-destructive",
  };

  const variantBorder = {
    default: "",
    success: "border-l-[3px] border-l-success",
    warning: "border-l-[3px] border-l-warning",
    destructive: "border-l-[3px] border-l-destructive",
  };

  const cardContent = (
    <Card 
      className={cn(
        "transition-all duration-300 hover:shadow-executive-lg hover:-translate-y-0.5 group border-border/40",
        variantBorder[variant],
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="px-5 py-4 sm:px-6 sm:py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-[11px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
            <p className="text-xl sm:text-2xl font-bold tracking-tight truncate" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
              <MaskedValue>{value}</MaskedValue>
            </p>
            {trend && (
              <div className="flex items-center gap-1.5 mt-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-xs font-semibold",
                    trend.isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
                </span>
              </div>
            )}
            {description && (
              <p className="text-[11px] text-muted-foreground mt-1">{description}</p>
            )}
          </div>
          <div
            className={cn(
              "hidden sm:flex h-10 w-10 items-center justify-center rounded-xl shrink-0 transition-transform duration-300 group-hover:scale-110",
              variantAccent[variant]
            )}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (hoverContent) {
    return (
      <HoverCard openDelay={1500} closeDelay={300}>
        <HoverCardTrigger asChild>
          {cardContent}
        </HoverCardTrigger>
        <HoverCardContent className="w-72 p-0" side="bottom" align="start">
          {hoverContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return cardContent;
}
