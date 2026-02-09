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
  const variantStyles = {
    default: "border-border",
    success: "border-l-2 border-l-success",
    warning: "border-l-2 border-l-warning",
    destructive: "border-l-2 border-l-destructive",
  };

  const iconVariantStyles = {
    default: "bg-muted/50 text-primary",
    success: "bg-muted/50 text-success",
    warning: "bg-muted/50 text-warning",
    destructive: "bg-muted/50 text-destructive",
  };

  const cardContent = (
    <Card 
      className={cn(
        "shadow-sm transition-all duration-200", 
        variantStyles[variant],
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground truncate">{title}</p>
            <p className="text-lg font-bold tracking-tight mt-0.5 truncate"><MaskedValue>{value}</MaskedValue></p>
            {trend && (
              <div className="flex items-center gap-1 mt-0.5">
                {trend.isPositive ? (
                  <TrendingUp className="h-3 w-3 text-success" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-destructive" />
                )}
                <span
                  className={cn(
                    "text-[10px] font-medium",
                    trend.isPositive ? "text-success" : "text-destructive"
                  )}
                >
                  {trend.isPositive ? "+" : ""}{trend.value.toFixed(1)}%
                </span>
              </div>
            )}
            {description && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ml-2",
              iconVariantStyles[variant]
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
