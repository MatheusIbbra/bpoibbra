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
    default: "bg-accent/6 text-accent",
    success: "bg-success/6 text-success",
    warning: "bg-warning/6 text-warning",
    destructive: "bg-destructive/6 text-destructive",
  };

  const variantIndicator = {
    default: "",
    success: "after:absolute after:left-0 after:top-3 after:bottom-3 after:w-[2px] after:rounded-full after:bg-success/50",
    warning: "after:absolute after:left-0 after:top-3 after:bottom-3 after:w-[2px] after:rounded-full after:bg-warning/50",
    destructive: "after:absolute after:left-0 after:top-3 after:bottom-3 after:w-[2px] after:rounded-full after:bg-destructive/50",
  };

  const cardContent = (
    <Card
      className={cn(
        "relative transition-all duration-300 hover:shadow-executive-lg hover:-translate-y-0.5 group border-border/30 overflow-hidden card-glow",
        variantIndicator[variant],
        onClick && "cursor-pointer"
      )}
      onClick={onClick}
    >
      <CardContent className="px-4 py-3 sm:px-5 sm:py-3.5 h-full flex items-center">
        <div className="flex items-center justify-between gap-3 w-full">
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-[0.08em] leading-none">
              {title}
            </p>
            <p
              className="text-lg sm:text-xl font-bold tracking-tight truncate leading-tight"
              style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
            >
              <MaskedValue>{value}</MaskedValue>
            </p>
            {trend && (
              <div className="flex items-center gap-1">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-[10px] font-semibold",
                    trend.isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.isPositive ? "+" : ""}
                  {trend.value.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div
            className={cn(
              "hidden sm:flex h-8 w-8 items-center justify-center rounded-lg shrink-0",
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
        <HoverCardTrigger asChild>{cardContent}</HoverCardTrigger>
        <HoverCardContent className="w-72 p-0" side="bottom" align="start">
          {hoverContent}
        </HoverCardContent>
      </HoverCard>
    );
  }

  return cardContent;
}
