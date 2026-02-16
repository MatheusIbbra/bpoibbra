import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  UserCheck,
  UserPlus,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  validateClientByCPF,
  isValidCPF,
  formatCPF,
  type IbbraClientValidationResult,
} from "@/services/ibbraClientValidationService";
import ibbraLogoFullWhite from "@/assets/ibbra-logo-full-white.png";
import ibbraLogoIcon from "@/assets/ibbra-logo-icon.png";

type Step = "client_question" | "cpf_validation" | "profile_form" | "completing";

export default function Onboarding() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("client_question");
  const [isLoading, setIsLoading] = useState(false);
  const [isIbbraClient, setIsIbbraClient] = useState<boolean | null>(null);

  // CPF
  const [cpf, setCpf] = useState("");
  const [validationResult, setValidationResult] = useState<IbbraClientValidationResult | null>(null);
  const [validationError, setValidationError] = useState("");

  // Profile form
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Load existing data from localStorage (Google OAuth) or profile
  useEffect(() => {
    if (!user) return;

    // Try to load registration data from localStorage (Google OAuth flow)
    const regDataStr = localStorage.getItem("ibbra_registration");
    if (regDataStr) {
      try {
        const regData = JSON.parse(regDataStr);
        if (regData.isIbbraClient !== undefined) setIsIbbraClient(regData.isIbbraClient);
        if (regData.cpf) setCpf(formatCPF(regData.cpf));
        if (regData.fullName) setFullName(regData.fullName);
        if (regData.birthDate) setBirthDate(regData.birthDate);
        if (regData.validated) {
          setValidationResult({ found: true, full_name: regData.fullName, birth_date: regData.birthDate });
        }
      } catch {
        localStorage.removeItem("ibbra_registration");
      }
    }

    // Pre-fill from user metadata
    if (!fullName && user.user_metadata?.full_name) {
      setFullName(user.user_metadata.full_name);
    }
    if (!fullName && user.user_metadata?.name) {
      setFullName(user.user_metadata.name);
    }
  }, [user]);

  // Redirect if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Check if already completed
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("registration_completed")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.registration_completed) {
          navigate("/", { replace: true });
        }
      });
  }, [user, navigate]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleClientAnswer = (answer: boolean) => {
    setIsIbbraClient(answer);
    if (answer) {
      setStep("cpf_validation");
    } else {
      setStep("profile_form");
    }
  };

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
    setValidationError("");
    setValidationResult(null);
  };

  const handleValidateCpf = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) {
      setValidationError("CPF inválido. Verifique os dígitos informados.");
      return;
    }
    setIsLoading(true);
    setValidationError("");
    try {
      const result = await validateClientByCPF(cleanCpf);
      setValidationResult(result);
      if (result.found) {
        setFullName(result.full_name || "");
        setBirthDate(result.birth_date || "");
        toast.success("Cliente IBBRA confirmado!");
      } else {
        setValidationError("Cliente não encontrado na base IBBRA.");
      }
    } catch {
      setValidationError("Erro ao validar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    if (!fullName.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }

    setStep("completing");
    setIsLoading(true);

    try {
      const cleanCpf = cpf.replace(/\D/g, "");

      // 1. Update profile with full data
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          cpf: cleanCpf || null,
          birth_date: birthDate || null,
          phone: phone || null,
          address: address || null,
          is_ibbra_client: isIbbraClient || false,
          external_client_validated: validationResult?.found || false,
          validated_at: validationResult?.found ? new Date().toISOString() : null,
          registration_completed: true,
        })
        .eq("user_id", user.id);

      if (profileError) throw profileError;

      // 2. Create organization (base) for the user
      const orgSlug = "base-" + user.id.substring(0, 8);
      const { data: newOrg, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: fullName.trim(),
          slug: orgSlug,
        })
        .select("id")
        .single();

      if (orgError) throw orgError;

      // 3. Create organization member link
      const { error: memberError } = await supabase
        .from("organization_members")
        .insert({
          organization_id: newOrg.id,
          user_id: user.id,
          role: "cliente",
        });

      if (memberError) throw memberError;

      // 4. Create default subscription (free plan) if exists
      const { data: freePlan } = await supabase
        .from("plans")
        .select("id")
        .eq("slug", "free")
        .eq("is_active", true)
        .maybeSingle();

      if (freePlan) {
        await supabase
          .from("organization_subscriptions")
          .insert({
            organization_id: newOrg.id,
            plan_id: freePlan.id,
            status: "active",
          });
      }

      // 5. Provision categories and rules from system templates
      const { error: provisionError } = await supabase.rpc(
        "provision_organization_from_template",
        { p_org_id: newOrg.id, p_user_id: user.id }
      );
      if (provisionError) {
        console.error("Provisioning warning:", provisionError);
        // Non-blocking: org is created, categories can be seeded later
      }

      // 5. Consent logs
      await supabase.from("consent_logs").insert([
        { user_id: user.id, consent_type: "terms", consent_given: true, user_agent: navigator.userAgent },
        { user_id: user.id, consent_type: "privacy", consent_given: true, user_agent: navigator.userAgent },
      ]).then(() => {});

      // 6. Clean up localStorage
      localStorage.removeItem("ibbra_registration");

      // 7. Set selected org
      localStorage.setItem("selectedOrganizationId", newOrg.id);

      toast.success("Cadastro concluído! Bem-vindo ao IBBRA.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error("Erro ao finalizar cadastro: " + (err.message || "Tente novamente."));
      setStep("profile_form");
    } finally {
      setIsLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  // Branding panel (same as Auth page)
  const BrandingPanel = () => (
    <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden sidebar-premium">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/ibbra-grafismo.svg')",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right bottom",
          backgroundSize: "85%",
          opacity: 0.08,
        }}
      />
      <div className="relative z-10 flex flex-col justify-between p-14 text-white/90 w-full">
        <div>
          <img src={ibbraLogoFullWhite} alt="IBBRA" className="h-9 object-contain" />
        </div>
        <div className="space-y-8 max-w-lg">
          <h2
            className="text-[2.75rem] leading-[1.1] font-semibold tracking-tight text-white"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            Complete seu
            <br />
            cadastro
          </h2>
          <div className="w-12 h-px bg-white/20" />
          <p className="text-[15px] text-white/50 leading-relaxed max-w-sm">
            Para sua segurança, precisamos de algumas informações
            antes de liberar o acesso à plataforma.
          </p>
        </div>
        <div className="flex items-center justify-between text-[11px] text-white/25 tracking-wide">
          <span>© {new Date().getFullYear()} IBBRA Family Office</span>
          <span className="uppercase tracking-widest">Onboarding</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <BrandingPanel />
      <div className="flex-1 flex items-center justify-center p-6 sm:p-8 lg:p-14 bg-background">
        <div className="w-full max-w-[420px]">
          <div className="flex items-center justify-center mb-8 lg:hidden">
            <img src={ibbraLogoIcon} alt="IBBRA" className="h-12 w-auto object-contain" />
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <h1
                className="text-2xl font-semibold tracking-tight"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                Complete seu cadastro
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step === "client_question" && "Responda para personalizarmos seu acesso."}
                {step === "cpf_validation" && "Valide seu cadastro como cliente IBBRA."}
                {step === "profile_form" && "Preencha seus dados para continuar."}
                {step === "completing" && "Finalizando seu cadastro..."}
              </p>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP: Client Question */}
              {step === "client_question" && (
                <motion.div
                  key="client_question"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Você já é cliente IBBRA?
                  </Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleClientAnswer(true)}
                      className={`group flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                        isIbbraClient === true
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <UserCheck className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Sim, sou cliente</span>
                    </button>
                    <button
                      onClick={() => handleClientAnswer(false)}
                      className={`group flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                        isIbbraClient === false
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      <UserPlus className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Não, quero me cadastrar</span>
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-sm text-muted-foreground"
                    onClick={async () => {
                      await signOut();
                      navigate("/auth", { replace: true });
                    }}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Sair e voltar ao login
                  </Button>
                </motion.div>
              )}

              {/* STEP: CPF Validation */}
              {step === "cpf_validation" && (
                <motion.div
                  key="cpf_validation"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="space-y-4">
                    <div>
                      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        CPF do cliente IBBRA
                      </Label>
                      <Input
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        className="h-12 mt-2 text-sm input-executive"
                        inputMode="numeric"
                        maxLength={14}
                      />
                    </div>
                    {validationError && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <p className="text-sm text-destructive/90">{validationError}</p>
                      </div>
                    )}
                    {validationResult?.found && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-foreground">Cliente confirmado</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{validationResult.full_name}</p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="h-12" onClick={() => setStep("client_question")}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    {!validationResult?.found ? (
                      <Button
                        className="flex-1 h-12 text-sm font-semibold"
                        onClick={handleValidateCpf}
                        disabled={isLoading || cpf.replace(/\D/g, "").length !== 11}
                      >
                        {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        {isLoading ? "Validando..." : "Validar Cliente"}
                      </Button>
                    ) : (
                      <Button
                        className="flex-1 h-12 text-sm font-semibold"
                        onClick={() => setStep("profile_form")}
                      >
                        Continuar
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP: Profile Form */}
              {step === "profile_form" && (
                <motion.div
                  key="profile_form"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <FieldGroup label="Nome completo">
                    <Input
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="h-11 text-sm input-executive"
                      readOnly={!!(isIbbraClient && validationResult?.found)}
                    />
                  </FieldGroup>
                  <FieldGroup label="Data de nascimento">
                    <Input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="h-11 text-sm input-executive"
                      readOnly={!!(isIbbraClient && validationResult?.found)}
                    />
                  </FieldGroup>
                  {!isIbbraClient && (
                    <FieldGroup label="CPF">
                      <Input
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        placeholder="000.000.000-00"
                        className="h-11 text-sm input-executive"
                        inputMode="numeric"
                        maxLength={14}
                      />
                    </FieldGroup>
                  )}
                  <FieldGroup label="Telefone">
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 99999-0000"
                      className="h-11 text-sm input-executive"
                      inputMode="tel"
                    />
                  </FieldGroup>
                  <FieldGroup label="Endereço">
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Rua, número, cidade"
                      className="h-11 text-sm input-executive"
                    />
                  </FieldGroup>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => {
                        if (isIbbraClient) setStep("cpf_validation");
                        else setStep("client_question");
                      }}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={handleCompleteOnboarding}
                      disabled={isLoading || !fullName.trim()}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      {isLoading ? "Finalizando..." : "Finalizar cadastro"}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP: Completing */}
              {step === "completing" && (
                <motion.div
                  key="completing"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center justify-center py-12 space-y-4"
                >
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Configurando sua plataforma...</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <p className="text-center text-[11px] text-muted-foreground/50 mt-12 lg:hidden">
            © {new Date().getFullYear()} IBBRA Family Office
          </p>
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
