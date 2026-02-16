import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, Loader2, ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";

export default function ConsentReaccept() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);

  const allAccepted = acceptTerms && acceptPrivacy && acceptLgpd;

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleAccept = async () => {
    if (!user || !allAccepted) return;
    setIsLoading(true);

    try {
      const { data: legalDocs } = await supabase
        .from("legal_documents")
        .select("id, document_type, version")
        .eq("active", true);

      const termsDoc = legalDocs?.find(d => d.document_type === "terms");
      const privacyDoc = legalDocs?.find(d => d.document_type === "privacy");
      const lgpdDoc = legalDocs?.find(d => d.document_type === "lgpd");

      await supabase.from("user_consents").insert({
        user_id: user.id,
        terms_version: termsDoc?.version || "1.0",
        privacy_version: privacyDoc?.version || "1.0",
        lgpd_version: lgpdDoc?.version || "1.0",
        terms_document_id: termsDoc?.id || null,
        privacy_document_id: privacyDoc?.id || null,
        lgpd_document_id: lgpdDoc?.id || null,
        user_agent: navigator.userAgent,
      });

      await supabase
        .from("profiles")
        .update({
          legal_accepted: true,
          legal_accepted_at: new Date().toISOString(),
          legal_accepted_version: `terms:${termsDoc?.version || "1.0"},privacy:${privacyDoc?.version || "1.0"},lgpd:${lgpdDoc?.version || "1.0"}`,
        })
        .eq("user_id", user.id);

      toast.success("Consentimento atualizado com sucesso!");
      navigate("/", { replace: true });
    } catch (err: any) {
      toast.error("Erro ao salvar consentimento: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[420px] space-y-6"
      >
        <div className="flex justify-center">
          <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto" />
        </div>

        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Atualização de Termos
          </h1>
          <p className="text-sm text-muted-foreground">
            Nossos termos foram atualizados. Para continuar usando a plataforma, aceite os novos termos.
          </p>
        </div>

        <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Seus dados continuam protegidos com confidencialidade e segurança, em conformidade com a LGPD.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <Checkbox id="terms" checked={acceptTerms} onCheckedChange={(c) => setAcceptTerms(c === true)} className="mt-0.5" />
            <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
              Li e aceito os{" "}
              <a href="/termos-de-uso" target="_blank" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                Termos de Uso <ExternalLink className="h-3 w-3" />
              </a>
            </label>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <Checkbox id="privacy" checked={acceptPrivacy} onCheckedChange={(c) => setAcceptPrivacy(c === true)} className="mt-0.5" />
            <label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
              Li e aceito a{" "}
              <a href="/politica-de-privacidade" target="_blank" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                Política de Privacidade <ExternalLink className="h-3 w-3" />
              </a>
            </label>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
            <Checkbox id="lgpd" checked={acceptLgpd} onCheckedChange={(c) => setAcceptLgpd(c === true)} className="mt-0.5" />
            <label htmlFor="lgpd" className="text-sm leading-relaxed cursor-pointer">
              Autorizo o tratamento dos meus dados conforme a{" "}
              <a href="/lgpd" target="_blank" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                LGPD <ExternalLink className="h-3 w-3" />
              </a>
            </label>
          </div>
        </div>

        <Button className="w-full h-12 text-sm font-semibold" onClick={handleAccept} disabled={!allAccepted || isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
          {isLoading ? "Salvando..." : "Aceitar e Continuar"}
        </Button>
      </motion.div>
    </div>
  );
}
