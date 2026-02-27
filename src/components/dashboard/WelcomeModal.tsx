import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

export function WelcomeModal() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["welcome-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, has_seen_onboarding")
        .eq("user_id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile && profile.has_seen_onboarding === false) {
      setOpen(true);
    }
  }, [profile]);

  const handleClose = async () => {
    setOpen(false);
    if (user?.id) {
      await supabase
        .from("profiles")
        .update({ has_seen_onboarding: true } as any)
        .eq("user_id", user.id);
      queryClient.invalidateQueries({ queryKey: ["welcome-check", user.id] });
    }
  };

  const firstName = profile?.full_name?.split(" ")[0] || "Usuário";

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl">
        {/* Header gradient */}
        <div className="bg-gradient-to-br from-[hsl(var(--sidebar-background))] to-[hsl(var(--sidebar-background)/0.85)] px-6 pt-8 pb-6 text-center">
          <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Olá, {firstName} 👋
          </h2>
          <p className="mt-2 text-sm text-white/75 leading-relaxed">
            É um prazer ter você conosco organizando sua vida financeira.
          </p>
        </div>

        {/* Steps */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm font-medium text-foreground">Para começar a usar o IBBRA Wallet:</p>
          <div className="space-y-3">
            {[
              { n: "1", text: "Clique no botão + no canto inferior direito." },
              { n: "2", text: "Crie suas contas ou conecte via Open Finance." },
              { n: "3", text: "Organize seus movimentos confirmando as classificações." },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {step.n}
                </span>
                <p className="text-sm text-muted-foreground leading-snug pt-0.5">{step.text}</p>
              </div>
            ))}
          </div>
          <Button className="w-full mt-2" onClick={handleClose}>
            Começar agora
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
