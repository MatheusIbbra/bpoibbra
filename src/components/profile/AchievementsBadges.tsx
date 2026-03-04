import { useAchievements, ACHIEVEMENT_DEFINITIONS } from "@/hooks/useAchievements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function AchievementsBadges() {
  const { data: achievements, isLoading } = useAchievements();

  const allKeys = Object.keys(ACHIEVEMENT_DEFINITIONS);
  const unlockedKeys = new Set(achievements?.map((a) => a.achievement_key) || []);

  if (isLoading) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-warning" />
          <CardTitle className="text-sm font-semibold">Conquistas</CardTitle>
          <span className="text-xs text-muted-foreground ml-auto">
            {unlockedKeys.size}/{allKeys.length}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <TooltipProvider delayDuration={200}>
          <div className="flex flex-wrap gap-3 justify-center">
            {allKeys.map((key) => {
              const def = ACHIEVEMENT_DEFINITIONS[key];
              const unlocked = unlockedKeys.has(key);
              const achievement = achievements?.find((a) => a.achievement_key === key);

              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-14 w-14 rounded-full flex items-center justify-center text-2xl transition-all duration-300 cursor-default select-none",
                        unlocked
                          ? "shadow-fintech-lg scale-100"
                          : "grayscale opacity-30 scale-90"
                      )}
                      style={{
                        backgroundColor: unlocked
                          ? `${def.color}15`
                          : "hsl(var(--muted))",
                        border: unlocked
                          ? `2px solid ${def.color}40`
                          : "2px solid transparent",
                      }}
                    >
                      {def.icon}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-center">
                    <p className="font-semibold text-xs">{def.label}</p>
                    <p className="text-[10px] text-muted-foreground">{def.description}</p>
                    {unlocked && achievement && (
                      <p className="text-[10px] text-success mt-1">
                        Conquistado em {format(new Date(achievement.achieved_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                    {!unlocked && (
                      <p className="text-[10px] text-muted-foreground mt-1">Ainda não conquistado</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
