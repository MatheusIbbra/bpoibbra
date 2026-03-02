import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);

  useEffect(() => {
    // Poll for subscription update (webhook may take a few seconds)
    let attempts = 0;
    const maxAttempts = 10;

    const poll = async () => {
      attempts++;
      const { data } = await supabase
        .from("profiles")
        .select("plan, subscription_status")
        .eq("user_id", user?.id!)
        .single();

      if (data?.subscription_status === "active" || data?.subscription_status === "trialing") {
        setPlan(data.plan);
        setLoading(false);
      } else if (attempts >= maxAttempts) {
        setLoading(false);
      } else {
        setTimeout(poll, 2000);
      }
    };

    if (user) {
      setTimeout(poll, 1500);
    }
  }, [user]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {loading ? (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto" />
            <h1 className="text-2xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
              Ativando sua assinatura...
            </h1>
            <p className="text-muted-foreground">Aguarde alguns instantes enquanto confirmamos seu pagamento.</p>
          </>
        ) : (
          <>
            <div className="h-20 w-20 rounded-full bg-[hsl(var(--brand-deep))]/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-12 w-12 text-[hsl(var(--brand-highlight))]" />
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="h-5 w-5 text-[hsl(var(--brand-highlight))]" />
                <span className="text-sm font-semibold uppercase tracking-widest text-[hsl(var(--brand-highlight))]">
                  {plan === "pro" ? "Plano Pro" : "Plano Plus"}
                </span>
              </div>
              <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Playfair Display', serif" }}>
                Bem-vindo ao IBBRA Premium!
              </h1>
            </div>
            <p className="text-muted-foreground">
              Sua assinatura foi ativada com sucesso. Você tem <strong>14 dias de trial gratuito</strong> para explorar todos os recursos.
            </p>
            <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2">
              <p className="font-medium text-foreground">✅ Transações ilimitadas</p>
              <p className="font-medium text-foreground">✅ Inteligência Artificial avançada</p>
              <p className="font-medium text-foreground">✅ Projeção de fluxo de caixa</p>
              <p className="font-medium text-foreground">✅ Simulador financeiro</p>
              {plan === "pro" && <p className="font-medium text-foreground">✅ Detecção de anomalias</p>}
            </div>
            <Button
              className="w-full bg-[hsl(var(--brand-deep))] hover:bg-[hsl(var(--brand-deep))]/90 text-white"
              onClick={() => navigate("/")}
            >
              Ir para o Dashboard
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
