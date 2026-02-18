import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Zap, Building2, MessageCircle } from "lucide-react";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";

const TRIGGER_MESSAGES: Record<string, string> = {
  transactions: "Você atingiu o limite de transações do seu plano.",
  ai: "Você atingiu o limite de requisições de IA do seu plano.",
  connections: "Você atingiu o limite de conexões bancárias do seu plano.",
  forecast: "Projeção de fluxo de caixa disponível em planos superiores.",
  simulator: "Simulador financeiro disponível em planos superiores.",
  anomaly: "Detecção de anomalias disponível em planos superiores.",
  benchmarking: "Benchmarking disponível em planos superiores.",
  general: "Desbloqueie todo o potencial do IBBRA com um plano superior.",
};

const PLAN_ICONS: Record<string, typeof Crown> = {
  starter: Zap,
  professional: Crown,
  enterprise: Building2,
};

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
  return n.toLocaleString("pt-BR");
}

export function UpgradeModal() {
  const { isOpen, trigger, closeUpgradeModal } = useUpgradeModal();
  const { plans, currentPlan } = useSubscription();

  const sortedPlans = plans.length > 0 ? plans : [];

  const handleContact = () => {
    const message = encodeURIComponent(
      "Olá! Gostaria de saber mais sobre os planos do IBBRA para fazer upgrade da minha conta."
    );
    window.open(`https://wa.me/5511999999999?text=${message}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-0">
        {/* Header */}
        <div className="bg-[hsl(var(--brand-deep))] text-white px-6 py-8 rounded-t-lg">
          <DialogHeader>
            <DialogTitle
              className="text-2xl md:text-3xl text-white text-center"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Evolua seu plano IBBRA
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-white/70 text-sm mt-2 max-w-lg mx-auto">
            {TRIGGER_MESSAGES[trigger] || TRIGGER_MESSAGES.general}
          </p>
        </div>

        {/* Plans Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {sortedPlans.map((plan) => {
            const isCurrentPlan = currentPlan?.id === plan.id;
            const Icon = PLAN_ICONS[plan.slug] || Zap;

            return (
              <div
                key={plan.id}
                className={cn(
                  "relative rounded-xl border-2 p-5 flex flex-col transition-all duration-300",
                  isCurrentPlan
                    ? "border-[hsl(var(--brand-highlight))] bg-[hsl(var(--brand-light-blue))] shadow-lg scale-[1.02]"
                    : "border-border bg-card hover:border-[hsl(var(--brand-highlight))]/50 hover:shadow-md"
                )}
              >
                {isCurrentPlan && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--brand-highlight))] text-white border-0 px-3">
                    Plano Atual
                  </Badge>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div className="h-10 w-10 rounded-lg bg-[hsl(var(--brand-deep))] flex items-center justify-center">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3
                      className="text-lg font-semibold text-foreground"
                      style={{ fontFamily: "'Playfair Display', serif" }}
                    >
                      {plan.name}
                    </h3>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-4">
                  {plan.price === 0 ? (
                    <span className="text-2xl font-bold text-foreground">Gratuito</span>
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-bold text-foreground">
                        R$ {plan.price.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                  )}
                  {plan.description && (
                    <p className="text-xs text-muted-foreground mt-1">{plan.description}</p>
                  )}
                </div>

                {/* Features */}
                <div className="space-y-2.5 flex-1 text-sm">
                  <FeatureRow
                    label={`${formatNumber(plan.max_transactions)} transações/mês`}
                    enabled
                  />
                  <FeatureRow
                    label={`${formatNumber(plan.max_ai_requests)} requisições IA`}
                    enabled
                  />
                  <FeatureRow
                    label={`${plan.max_bank_connections} conexões bancárias`}
                    enabled
                  />
                  <FeatureRow label="Projeção de caixa" enabled={plan.allow_forecast} />
                  <FeatureRow label="Simulador financeiro" enabled={plan.allow_simulator} />
                  <FeatureRow label="Detecção de anomalias" enabled={plan.allow_anomaly_detection} />
                  <FeatureRow label="Benchmarking" enabled={plan.allow_benchmarking} />
                </div>

                {/* CTA */}
                <div className="mt-5">
                  {isCurrentPlan ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-[hsl(var(--brand-deep))] hover:bg-[hsl(var(--brand-deep))]/90 text-white"
                      onClick={handleContact}
                    >
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Falar com consultor
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 text-center">
          <p className="text-xs text-muted-foreground">
            Precisa de um plano personalizado?{" "}
            <button
              className="text-[hsl(var(--brand-highlight))] hover:underline font-medium"
              onClick={handleContact}
            >
              Entre em contato com nossa equipe
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <Check className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
      ) : (
        <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      )}
      <span className={cn("text-sm", !enabled && "text-muted-foreground/50")}>{label}</span>
    </div>
  );
}
