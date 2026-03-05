/**
 * Rich AI classification progress indicator.
 * Shows the 4-layer pipeline in sequence with estimated timing.
 */
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Check, Loader2, Brain, BookOpen, Sparkles, Search } from "lucide-react";

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

export function AIClassificationProgress({ isRunning, currentSource, className }: Props) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isRunning) {
      setActiveStep(0);
      return;
    }

    let step = 0;
    setActiveStep(0);

    const advance = () => {
      step++;
      if (step < STEPS.length) {
        setActiveStep(step);
        if (step < STEPS.length - 1) {
          setTimeout(advance, STEPS[step].duration);
        }
      }
    };

    const timer = setTimeout(advance, STEPS[0].duration);
    return () => clearTimeout(timer);
  }, [isRunning]);

  // When we get a result, jump to done
  useEffect(() => {
    if (!isRunning && currentSource) {
      setActiveStep(STEPS.length - 1);
    }
  }, [isRunning, currentSource]);

  if (!isRunning && !currentSource) return null;

  return (
    <div className={cn("space-y-2 py-3", className)}>
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
