import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, Crown, Zap, MessageCircle, Loader2, Gift, Sparkles } from "lucide-react";
import { useUpgradeModal } from "@/contexts/UpgradeModalContext";
import { useSubscription } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TRIGGER_MESSAGES: Record<string, string> = {
  transactions: "Você atingiu o limite de transações do seu plano.",
  ai: "Você atingiu o limite de requisições de IA do seu plano.",
  connections: "Você atingiu o limite de conexões bancárias do seu plano.",
  forecast: "Projeção de fluxo de caixa disponível em planos superiores.",
  simulator: "Simulador financeiro disponível em planos superiores.",
  anomaly: "Detecção de anomalias disponível em planos superiores.",
  general: "Desbloqueie todo o potencial do IBBRA com um plano superior.",
};

const PLAN_ICONS: Record<string, typeof Zap> = {
  starter: Sparkles,
  plus: Zap,
  pro: Crown,
};

// These slugs can be purchased via Stripe checkout
const PURCHASABLE_SLUGS = ["plus", "pro"];

function formatLimit(value: number, suffix: string): string {
  if (value >= 999999) return `Ilimitado`;
  if (value >= 10000) return `${(value / 1000).toFixed(0)}k ${suffix}`;
  return `${value.toLocaleString("pt-BR")} ${suffix}`;
}

export function UpgradeModal() {
  const { isOpen, trigger, closeUpgradeModal } = useUpgradeModal();
  const { currentPlan, plans } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  // Show all plans sorted by price
  const allPlans = [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
  const purchasablePlans = allPlans; // keep variable name for compatibility

  const handleContact = () => {
    const message = encodeURIComponent(
      "Olá! Gostaria de saber mais sobre os planos do IBBRA para fazer upgrade da minha conta."
    );
    window.open(`https://wa.me/5511999999999?text=${message}`, "_blank");
  };

  const handleCheckout = async (planSlug: string) => {
    setLoadingPlan(planSlug);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Faça login para continuar.");
        setLoadingPlan(null);
        return;
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ plan: planSlug.toLowerCase() }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error || "Erro ao criar sessão de checkout");
      if (data.url) {
        closeUpgradeModal();
        window.location.href = data.url;
      }
    } catch (err) {
      toast.error((err as Error).message);
      setLoadingPlan(null);
    }
  };

  const buildFeatureList = (plan: typeof plans[0]) => {
    const features: string[] = [];
    features.push(formatLimit(plan.max_transactions, "transações/mês"));
    features.push(formatLimit(plan.max_ai_requests, "requisições de IA"));
    features.push(formatLimit(plan.max_bank_connections, "conexões bancárias"));
    if (plan.allow_forecast) features.push("Projeção de fluxo de caixa");
    if (plan.allow_simulator) features.push("Simulador financeiro");
    if (plan.allow_anomaly_detection) features.push("Detecção de anomalias");
    return features;
  };

  const buildNotIncluded = (plan: typeof plans[0]) => {
    const notIncluded: string[] = [];
    if (!plan.allow_forecast) notIncluded.push("Projeção de fluxo de caixa");
    if (!plan.allow_simulator) notIncluded.push("Simulador financeiro");
    if (!plan.allow_anomaly_detection) notIncluded.push("Detecção de anomalias");
    return notIncluded;
  };

  // Determine which plan is "highlight" (most popular = Pro, the most expensive)
  const highlightSlug = purchasablePlans.length > 0
    ? purchasablePlans[purchasablePlans.length - 1].slug
    : "Pro";

  // Current plan slug for comparison
  const currentSlugLower = (currentPlan?.slug || "starter").toLowerCase();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeUpgradeModal()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-0 [&>button.absolute]:text-white [&>button.absolute]:hover:text-white/80">
        {/* Header */}
        <div className="bg-[hsl(var(--brand-deep))] text-white px-4 py-6 md:px-8 md:py-8 rounded-t-lg">
          <DialogHeader>
            <DialogTitle
              className="text-xl md:text-3xl text-white text-center"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              Evolua seu plano IBBRA
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-white/70 text-xs md:text-sm mt-2 max-w-lg mx-auto">
            {TRIGGER_MESSAGES[trigger] || TRIGGER_MESSAGES.general}
          </p>
          {/* Trial badge */}
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-1.5 bg-white/10 text-white rounded-full px-3 py-1.5 text-xs font-medium">
              <Gift className="h-3.5 w-3.5" />
              2 dias grátis nos planos pagos — sem cobrança imediata
            </div>
          </div>
        </div>

        {/* Plans Grid — always 3 columns on md+ */}
        <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {purchasablePlans.map((plan) => {
            const slugLower = plan.slug.toLowerCase();
            const Icon = PLAN_ICONS[slugLower] || Zap;
            const isCurrent = currentSlugLower === slugLower;
            const isLoading = loadingPlan === plan.slug;
            const isHighlight = plan.slug === highlightSlug;
            const isStarter = slugLower === "starter";
            const features = buildFeatureList(plan);
            const notIncluded = buildNotIncluded(plan);

            return (
              <div
                key={plan.slug}
                className={cn(
                  "relative rounded-xl border-2 p-5 flex flex-col transition-all duration-300",
                  isCurrent
                    ? "border-[hsl(var(--brand-highlight))] shadow-lg bg-[hsl(var(--brand-light-blue))] dark:bg-accent/10"
                    : isHighlight
                    ? "border-[hsl(var(--brand-highlight))]/60 shadow-md"
                    : "border-border hover:border-[hsl(var(--brand-highlight))]/50 hover:shadow-md"
                )}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--brand-highlight))] text-white border-0 px-3 text-xs">
                    Plano atual
                  </Badge>
                )}
                {!isCurrent && isHighlight && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[hsl(var(--brand-deep))] text-white border-0 px-3 text-xs">
                    Mais popular
                  </Badge>
                )}

                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-lg bg-[hsl(var(--brand-deep))] flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="flex items-baseline gap-1">
                    {plan.price === 0 ? (
                      <span className="text-3xl font-bold text-foreground">Grátis</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-foreground">
                          R$ {plan.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </span>
                        <span className="text-sm text-muted-foreground">/mês</span>
                      </>
                    )}
                  </div>
                  {!isStarter && (
                    <p className="text-xs text-[hsl(var(--brand-highlight))] font-medium mt-1">
                      Primeiros 2 dias grátis
                    </p>
                  )}
                </div>

                <div className="space-y-2 flex-1 text-sm">
                  {features.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-[hsl(var(--success))] shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                  {notIncluded.map((f) => (
                    <div key={f} className="flex items-center gap-2">
                      <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                      <span className="text-muted-foreground/50">{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-5">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano atual
                    </Button>
                  ) : isStarter ? (
                    <Button variant="outline" className="w-full" disabled>
                      Plano gratuito
                    </Button>
                  ) : (
                    <Button
                      className={cn(
                        "w-full text-white",
                        isHighlight
                          ? "bg-[hsl(var(--brand-highlight))] hover:bg-[hsl(var(--brand-highlight))]/90"
                          : "bg-[hsl(var(--brand-deep))] hover:bg-[hsl(var(--brand-deep))]/90"
                      )}
                      onClick={() => handleCheckout(plan.slug)}
                      disabled={!!loadingPlan}
                    >
                      {isLoading ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Aguarde...</>
                      ) : (
                        <>Começar trial grátis</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Enterprise footer */}
        <div className="px-4 pb-5 md:px-6 md:pb-6 text-center border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            Precisa de um plano Enterprise personalizado?{" "}
            <button
              className="text-[hsl(var(--brand-highlight))] hover:underline font-medium"
              onClick={handleContact}
            >
              <MessageCircle className="inline h-3 w-3 mr-1" />
              Fale com um consultor
            </button>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}