/**
 * Rich AI classification progress indicator.
 * Shows the 4-layer pipeline in sequence with estimated timing.
 */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Brain, BookOpen, Sparkles, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface Props {
  isRunning: boolean;
  currentSource?: "rule" | "pattern" | "ai" | "none" | null;
  className?: string;
}

const STEPS = [
  { key: "rule", label: "Verificando regras...", icon: BookOpen, duration: 400 },
  { key: "pattern", label: "Consultando padrões...", icon: Search, duration: 600 },
  { key: "ai", label: "Analisando com IA...", icon: Brain, duration: 2000 },
  { key: "done", label: "Classificação concluída", icon: Sparkles, duration: 0 },
] as const;

const SOURCE_BADGES = {
  rule: { label: "Regra correspondente", className: "bg-success/10 text-success border-success/30" },
  pattern: { label: "Padrão aprendido", className: "bg-primary/10 text-primary border-primary/30" },
  ai: { label: "Classificado por IA", className: "bg-accent/10 text-accent-foreground border-accent/30" },
  none: { label: "Sem classificação sugerida", className: "bg-warning/10 text-warning border-warning/30" },
} as const;

export function AIClassificationProgress({ isRunning, currentSource, className }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setActiveStep(0);
      setProgress(0);
      return;
    }

    let step = 0;
    setActiveStep(0);
    setProgress(0);

    // Animate progress bar during AI step
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 2, 95));
    }, 80);

    const advance = () => {
      step++;
      if (step < STEPS.length) {
        setActiveStep(step);
        setProgress((step / (STEPS.length - 1)) * 100);
        if (step < STEPS.length - 1) {
          setTimeout(advance, STEPS[step].duration);
        }
      }
    };

    const timer = setTimeout(advance, STEPS[0].duration);
    return () => {
      clearTimeout(timer);
      clearInterval(progressInterval);
    };
  }, [isRunning]);

  // When we get a result, jump to done
  useEffect(() => {
    if (!isRunning && currentSource) {
      setActiveStep(STEPS.length - 1);
      setProgress(100);
    }
  }, [isRunning, currentSource]);

  // Show result badge silently for 'rule' source (no progress UI needed)
  if (!isRunning && currentSource && currentSource !== "none") {
    const badge = SOURCE_BADGES[currentSource];
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", badge.className, className)}>
        <Check className="h-3 w-3" />
        {badge.label}
      </span>
    );
  }

  if (!isRunning && currentSource === "none") {
    const badge = SOURCE_BADGES.none;
    return (
      <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium", badge.className, className)}>
        {badge.label} — revise manualmente
      </span>
    );
  }

  if (!isRunning && !currentSource) return null;

  return (
    <div className={cn("space-y-2 py-3", className)}>
      {/* Progress bar during AI loading */}
      {isRunning && (
        <Progress value={progress} className="h-1 mb-3" />
      )}
      {STEPS.map((step, i) => {
        const isActive = i === activeStep && isRunning;
        const isDone = i < activeStep || (!isRunning && currentSource);
        const isPending = i > activeStep;
        const Icon = step.icon;

        return (
          <div
            key={step.key}
            className={cn(
              "flex items-center gap-2.5 text-xs transition-all duration-300",
              isActive && "text-primary font-medium",
              isDone && "text-success",
              isPending && "text-muted-foreground/40"
            )}
          >
            {isDone ? (
              <Check className="h-3.5 w-3.5 shrink-0" />
            ) : isActive ? (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

