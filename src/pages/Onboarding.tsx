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
  Users,
  Plus,
  Trash2,
  FileText,
  ExternalLink,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

type Step = "client_question" | "cpf_validation" | "ibbra_confirm" | "profile_form" | "family_question" | "family_form" | "consent" | "set_password" | "completing";

interface FamilyMember {
  relationship: string;
  full_name: string;
  age: string;
  phone: string;
  email: string;
}

const RELATIONSHIP_OPTIONS = [
  "Cônjuge", "Filho(a)", "Pai/Mãe", "Irmão(ã)", "Avô/Avó", "Neto(a)", "Tio(a)", "Sobrinho(a)", "Outro",
];

const emptyFamilyMember = (): FamilyMember => ({
  relationship: "", full_name: "", age: "", phone: "", email: "",
});

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
  const [gender, setGender] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // IBBRA enriched fields (from matriz)
  const [ibbraEmail, setIbbraEmail] = useState("");
  const [ibbraEmailMasked, setIbbraEmailMasked] = useState("");
  const [ibbra_telefone, setIbbraTelefone] = useState("");
  const [perfil_comportamental, setPerfilComportamental] = useState("");
  const [comunidade, setComunidade] = useState("");
  const [operacional, setOperacional] = useState("");

  // Check if user is Google OAuth (no password set)
  const isGoogleUser = user?.app_metadata?.provider === "google" || 
    (user?.identities?.some(i => i.provider === "google") ?? false);

  // CPF duplicate check
  const [cpfDuplicateEmail, setCpfDuplicateEmail] = useState<string | null>(null);

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([emptyFamilyMember()]);

  // Consent
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [acceptLgpd, setAcceptLgpd] = useState(false);

  const allConsentsAccepted = acceptTerms && acceptPrivacy && acceptLgpd;

  // Load existing data from pending_registrations table (replaces localStorage for security)
  useEffect(() => {
    if (!user) return;

    const loadPendingRegistration = async () => {
      const token = localStorage.getItem("ibbra_reg_token");
      if (token) {
        try {
          const { data: regData, error } = await (supabase as any)
            .from("pending_registrations")
            .select("*")
            .eq("session_token", token)
            .maybeSingle();

          if (!error && regData && new Date(regData.expires_at) > new Date()) {
            if (regData.is_ibbra_client !== undefined) setIsIbbraClient(regData.is_ibbra_client);
            if (regData.cpf) setCpf(formatCPF(regData.cpf));
            if (regData.full_name) setFullName(regData.full_name);
            if (regData.birth_date) setBirthDate(regData.birth_date);
            if (regData.phone) setPhone(regData.phone);
            if (regData.validated) {
              setValidationResult({ found: true, full_name: regData.full_name || "", birth_date: regData.birth_date || "" });
            }
            // Load family members if saved
            const fm = regData.family_members as any[];
            if (fm && Array.isArray(fm) && fm.length > 0) {
              setFamilyMembers(fm.map((m: any) => ({
                relationship: m.relationship || "",
                full_name: m.full_name || "",
                age: m.age?.toString() || "",
                phone: m.phone || "",
                email: m.email || "",
              })));
            }
            setStep("profile_form");

            // Delete the pending registration after consuming it
            await (supabase as any)
              .from("pending_registrations")
              .delete()
              .eq("session_token", token);
          }

          // Always clean up the token from localStorage
          localStorage.removeItem("ibbra_reg_token");
        } catch {
          localStorage.removeItem("ibbra_reg_token");
        }
      }

      // Fallback: also clean up legacy localStorage key if present
      localStorage.removeItem("ibbra_registration");

      if (!fullName && user.user_metadata?.full_name) {
        setFullName(user.user_metadata.full_name);
      }
      if (!fullName && user.user_metadata?.name) {
        setFullName(user.user_metadata.name);
      }
    };

    loadPendingRegistration();
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
      .select("registration_completed, legal_accepted")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.registration_completed && data?.legal_accepted) {
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
    setCpfDuplicateEmail(null);
  };

  // Mask email helper
  const maskEmail = (email: string): string => {
    const [local, domain] = email.split("@");
    if (!domain) return "***@***";
    return `${local.slice(0, 1)}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
  };

  // CPF duplicate check on blur
  const handleCpfBlur = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (cleanCpf.length !== 11 || !isValidCPF(cleanCpf)) return;
    try {
      const { data } = await supabase.functions.invoke("check-cpf-duplicate", {
        body: { cpf: cleanCpf },
      });
      if (data?.exists && data?.email) {
        setCpfDuplicateEmail(data.email);
      } else {
        setCpfDuplicateEmail(null);
      }
    } catch {
      // Silently fail
    }
  };

  const handleValidateCpf = async () => {
    const cleanCpf = cpf.replace(/\D/g, "");
    if (!isValidCPF(cleanCpf)) {
      setValidationError("CPF inválido. Verifique os dígitos informados.");
      return;
    }
    setIsLoading(true);
    setValidationError("");
    setCpfDuplicateEmail(null);
    try {
      // Check for duplicate CPF first
      const { data: dupData } = await supabase.functions.invoke("check-cpf-duplicate", {
        body: { cpf: cleanCpf },
      });
      if (dupData?.exists && dupData?.email) {
        setCpfDuplicateEmail(dupData.email);
        setValidationError("Este CPF já possui uma conta cadastrada.");
        setIsLoading(false);
        return;
      }

      // Validate against Supabase B (matriz) via Edge Function
      const result = await validateClientByCPF(cleanCpf);
      setValidationResult(result);
      if (result.found) {
        // Populate all fields from matriz
        setFullName(result.nome_completo || result.full_name || "");
        setBirthDate(result.data_nascimento || result.birth_date || "");
        if (result.telefone) setPhone(result.telefone);
        if (result.genero) setGender(result.genero);
        if (result.email_masked) setIbbraEmailMasked(result.email_masked);
        if (result.perfil_comportamental) setPerfilComportamental(result.perfil_comportamental);
        if (result.comunidade) setComunidade(result.comunidade);
        if (result.operacional) setOperacional(result.operacional);
        // Advance to confirmation step to show imported data to user
        setStep("ibbra_confirm");
      } else {
        setValidationError("Cliente não encontrado na base IBBRA. Verifique o CPF ou entre em contato com nosso atendimento.");
      }
    } catch {
      setValidationError("Erro ao validar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileNext = () => {
    if (!fullName.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    setStep("family_question");
  };

  const handleFamilyAnswer = (wantsFamily: boolean) => {
    if (wantsFamily) {
      setStep("family_form");
    } else {
      setStep("consent");
    }
  };

  // Family member helpers
  const addFamilyMember = () => setFamilyMembers(prev => [...prev, emptyFamilyMember()]);
  const removeFamilyMember = (index: number) =>
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  const updateFamilyMember = (index: number, field: keyof FamilyMember, value: string) =>
    setFamilyMembers(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));

  const handleCompleteOnboarding = async () => {
    if (!allConsentsAccepted) {
      toast.error("Aceite todos os termos para continuar.");
      return;
    }

    setStep("completing");
    setIsLoading(true);

    try {
      const cleanCpf = cpf.replace(/\D/g, "");

      const validMembers = familyMembers
        .filter(m => m.full_name.trim() && m.relationship)
        .map(m => ({
          relationship: m.relationship,
          full_name: m.full_name.trim(),
          age: m.age || null,
          phone: m.phone || null,
          email: m.email || null,
        }));

      // Call server-side RPC that handles everything atomically
      const { data: result, error: rpcError } = await supabase.rpc('complete_onboarding', {
        p_full_name: fullName.trim(),
        p_cpf: cleanCpf || null,
        p_birth_date: birthDate || null,
        p_phone: phone || null,
        p_address: null,
        p_is_ibbra_client: isIbbraClient || false,
        p_external_client_validated: validationResult?.found || false,
        p_family_members: validMembers,
        p_gender: gender || null,
      });

      if (rpcError) {
        if (rpcError.message?.includes('CPF_ALREADY_REGISTERED:')) {
          const maskedEmail = rpcError.message.split('CPF_ALREADY_REGISTERED:')[1];
          setCpfDuplicateEmail(maskedEmail);
          toast.error("Este CPF já está cadastrado.");
          setStep("profile_form");
          setIsLoading(false);
          return;
        }
        throw rpcError;
      }

      // Enrich profile with IBBRA matriz fields if client is validated
      if (validationResult?.found && isIbbraClient) {
        await supabase
          .from("profiles")
          .update({
            comunidade: comunidade || null,
            operacional: operacional || null,
            perfil_comportamental: perfil_comportamental || null,
            ibbra_email: ibbraEmail || null,
            ibbra_telefone: ibbra_telefone || null,
            origem: "ibbra",
            ibbra_locked: true,
          })
          .eq("user_id", user.id);
      }

      // Save consents
      const { data: legalDocs } = await supabase
        .from("legal_documents")
        .select("id, document_type, version")
        .eq("active", true);

      const termsDoc = legalDocs?.find(d => d.document_type === "terms");
      const privacyDoc = legalDocs?.find(d => d.document_type === "privacy");
      const lgpdDoc = legalDocs?.find(d => d.document_type === "lgpd");

      const { error: consentError } = await supabase
        .from("user_consents")
        .insert({
          user_id: user.id,
          organization_id: (result as any)?.organization_id || null,
          terms_version: termsDoc?.version || "1.0",
          privacy_version: privacyDoc?.version || "1.0",
          lgpd_version: lgpdDoc?.version || "1.0",
          terms_document_id: termsDoc?.id || null,
          privacy_document_id: privacyDoc?.id || null,
          lgpd_document_id: lgpdDoc?.id || null,
          user_agent: navigator.userAgent,
        });

      if (consentError) {
        console.error("Consent save error:", consentError);
      }

      await supabase
        .from("profiles")
        .update({
          legal_accepted: true,
          legal_accepted_at: new Date().toISOString(),
          legal_accepted_version: `terms:${termsDoc?.version || "1.0"},privacy:${privacyDoc?.version || "1.0"},lgpd:${lgpdDoc?.version || "1.0"}`,
        })
        .eq("user_id", user.id);

      localStorage.removeItem("ibbra_reg_token");
      localStorage.removeItem("ibbra_registration");

      const orgId = (result as any)?.organization_id;
      if (orgId) {
        localStorage.setItem("selectedOrganizationId", orgId);
      }

      toast.success("Cadastro concluído! Bem-vindo ao IBBRA.");
      navigate("/", { replace: true });
    } catch (err: any) {
      console.error("Onboarding error:", err);
      toast.error("Erro ao finalizar cadastro: " + (err.message || "Tente novamente."));
      setStep("consent");
    } finally {
      setIsLoading(false);
    }
  };

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

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

  const stepDescriptions: Record<Step, string> = {
    client_question: "Responda para personalizarmos seu acesso.",
    cpf_validation: "Valide seu cadastro como cliente IBBRA.",
    ibbra_confirm: "Confirme seus dados importados da base IBBRA.",
    profile_form: "Preencha seus dados para continuar.",
    family_question: "Deseja cadastrar membros da família?",
    family_form: "Adicione os dados dos seus familiares.",
    consent: "Aceite os termos para finalizar seu cadastro.",
    set_password: "Defina uma senha para acessar via email.",
    completing: "Finalizando seu cadastro...",
  };

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
                {step === "consent" ? "Consentimentos e Termos" : step === "set_password" ? "Definir Senha" : step === "ibbra_confirm" ? "Dados da Base IBBRA" : "Complete seu cadastro"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {stepDescriptions[step]}
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
                      <span className="text-sm font-medium">Sim</span>
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
                      <span className="text-sm font-medium">Não</span>
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

                    {/* CPF Duplicate Warning */}
                    {cpfDuplicateEmail && (
                      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                        <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-destructive">CPF já cadastrado</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            E-mail vinculado: <span className="font-mono">{maskEmail(cpfDuplicateEmail)}</span>
                          </p>
                          <button 
                            onClick={async () => {
                              await signOut();
                              navigate("/auth", { replace: true });
                            }}
                            className="text-primary underline mt-1 text-xs hover:text-primary/80"
                          >
                            Recuperar senha
                          </button>
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

              {/* STEP: IBBRA Confirm - show imported data from matriz */}
              {step === "ibbra_confirm" && (
                <motion.div
                  key="ibbra_confirm"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Cliente IBBRA confirmado</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Dados importados da base IBBRA. Campos marcados com 🔒 não podem ser alterados.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border border-border p-4 bg-muted/20">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Nome 🔒</p>
                        <p className="font-medium mt-0.5 truncate">{fullName}</p>
                      </div>
                      {birthDate && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Nascimento 🔒</p>
                          <p className="font-medium mt-0.5">
                            {birthDate.includes("-")
                              ? birthDate.split("-").reverse().join("/")
                              : birthDate}
                          </p>
                        </div>
                      )}
                      {ibbraEmailMasked && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">E-mail 🔒</p>
                          <p className="font-medium mt-0.5 font-mono text-xs">{ibbraEmailMasked}</p>
                        </div>
                      )}
                      {ibbra_telefone && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Telefone 🔒</p>
                          <p className="font-medium mt-0.5">{ibbra_telefone}</p>
                        </div>
                      )}
                      {comunidade && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Comunidade</p>
                          <p className="font-medium mt-0.5">{comunidade}</p>
                        </div>
                      )}
                      {operacional && (
                        <div>
                          <p className="text-xs text-muted-foreground uppercase tracking-wider">Operacional</p>
                          <p className="font-medium mt-0.5">{operacional}</p>
                        </div>
                      )}
                    </div>
                    {perfil_comportamental && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Perfil Comportamental</p>
                        <p className="text-sm font-medium mt-0.5">{perfil_comportamental}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setStep("cpf_validation")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={() => setStep("profile_form")}
                    >
                      Confirmar e continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
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
                      value={(() => {
                        // Display as DD/MM/YYYY if stored as ISO
                        if (birthDate && birthDate.includes("-")) {
                          const [y, m, d] = birthDate.split("-");
                          return `${d}/${m}/${y}`;
                        }
                        return birthDate;
                      })()}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
                        let formatted = digits;
                        if (digits.length > 2) formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
                        if (digits.length > 4) formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
                        // Store as ISO when complete
                        if (digits.length === 8) {
                          setBirthDate(`${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
                        } else {
                          setBirthDate(formatted);
                        }
                      }}
                      placeholder="DD/MM/AAAA"
                      className="h-11 text-sm input-executive"
                      inputMode="numeric"
                      maxLength={10}
                      readOnly={!!(isIbbraClient && validationResult?.found)}
                    />
                  </FieldGroup>
                  {!isIbbraClient && (
                    <FieldGroup label="CPF">
                      <Input
                        value={cpf}
                        onChange={(e) => handleCpfChange(e.target.value)}
                        onBlur={handleCpfBlur}
                        placeholder="000.000.000-00"
                        className="h-11 text-sm input-executive"
                        inputMode="numeric"
                        maxLength={14}
                      />
                    </FieldGroup>
                  )}

                  {/* CPF Duplicate Warning */}
                  {cpfDuplicateEmail && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                      <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="text-xs">
                        <p className="font-medium text-destructive">CPF já cadastrado</p>
                        <p className="text-muted-foreground mt-0.5">
                          E-mail vinculado: <span className="font-mono">{maskEmail(cpfDuplicateEmail)}</span>
                        </p>
                        <button 
                          onClick={async () => {
                            await signOut();
                            navigate("/auth", { replace: true });
                          }}
                          className="text-primary underline mt-1 hover:text-primary/80"
                        >
                          Recuperar senha
                        </button>
                      </div>
                    </div>
                  )}

                  <FieldGroup label="Telefone">
                    <Input
                      value={phone}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, "").slice(0, 11);
                        let formatted = digits;
                        if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                        if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                        setPhone(formatted);
                      }}
                      placeholder="(11) 99999-0000"
                      className="h-11 text-sm input-executive"
                      inputMode="tel"
                      maxLength={15}
                    />
                  </FieldGroup>

                  <FieldGroup label="Gênero">
                    <Select value={gender} onValueChange={setGender}>
                      <SelectTrigger className="h-11 text-sm input-executive">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="nao_informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </FieldGroup>

                  {/* Legal consent checkbox */}
                  {!isIbbraClient && (
                    <div className="flex items-start gap-2 pt-2">
                      <Checkbox
                        id="onboarding-consent"
                        checked={acceptTerms && acceptPrivacy && acceptLgpd}
                        onCheckedChange={(v) => {
                          const checked = v === true;
                          setAcceptTerms(checked);
                          setAcceptPrivacy(checked);
                          setAcceptLgpd(checked);
                        }}
                        className="mt-0.5"
                      />
                      <label htmlFor="onboarding-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                        Aceito os{" "}
                        <a href="/termos-de-uso" target="_blank" className="text-primary underline">Termos de Uso</a>,{" "}
                        a{" "}
                        <a href="/politica-de-privacidade" target="_blank" className="text-primary underline">Política de Privacidade</a>{" "}
                        e o tratamento dos meus dados conforme a{" "}
                        <a href="/lgpd" target="_blank" className="text-primary underline">LGPD</a>.
                      </label>
                    </div>
                  )}

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
                      onClick={handleProfileNext}
                      disabled={!fullName.trim() || !!cpfDuplicateEmail}
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP: Family Question */}
              {step === "family_question" && (
                <motion.div
                  key="family_question"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Deseja cadastrar membros da família?
                  </Label>
                  <p className="text-xs text-muted-foreground/70">
                    Isso nos ajuda a oferecer uma visão completa de Wealth Intelligence para sua família.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleFamilyAnswer(true)}
                      className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/40 transition-all duration-200 hover:shadow-md"
                    >
                      <Users className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Sim, cadastrar</span>
                    </button>
                    <button
                      onClick={() => handleFamilyAnswer(false)}
                      className="group flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/40 transition-all duration-200 hover:shadow-md"
                    >
                      <ArrowRight className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Pular</span>
                    </button>
                  </div>
                  <Button
                    variant="ghost"
                    className="w-full h-10 text-sm text-muted-foreground"
                    onClick={() => setStep("profile_form")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </motion.div>
              )}

              {/* STEP: Family Form */}
              {step === "family_form" && (
                <motion.div
                  key="family_form"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  <div className="max-h-[50vh] overflow-y-auto space-y-4 pr-1">
                    {familyMembers.map((member, index) => (
                      <div key={index} className="p-4 rounded-lg border border-border space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Familiar {index + 1}
                          </span>
                          {familyMembers.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-destructive/60 hover:text-destructive"
                              onClick={() => removeFamilyMember(index)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <Select
                          value={member.relationship}
                          onValueChange={(val) => updateFamilyMember(index, "relationship", val)}
                        >
                          <SelectTrigger className="h-10 text-sm">
                            <SelectValue placeholder="Grau de parentesco" />
                          </SelectTrigger>
                          <SelectContent>
                            {RELATIONSHIP_OPTIONS.map((r) => (
                              <SelectItem key={r} value={r}>{r}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          value={member.full_name}
                          onChange={(e) => updateFamilyMember(index, "full_name", e.target.value)}
                          placeholder="Nome completo"
                          className="h-10 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            value={member.age}
                            onChange={(e) => updateFamilyMember(index, "age", e.target.value)}
                            placeholder="Idade"
                            className="h-10 text-sm"
                            inputMode="numeric"
                          />
                          <Input
                            value={member.phone}
                            onChange={(e) => updateFamilyMember(index, "phone", e.target.value)}
                            placeholder="Telefone"
                            className="h-10 text-sm"
                          />
                        </div>
                        <Input
                          value={member.email}
                          onChange={(e) => updateFamilyMember(index, "email", e.target.value)}
                          placeholder="Email (opcional)"
                          className="h-10 text-sm"
                        />
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-10 text-sm"
                    onClick={addFamilyMember}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar familiar
                  </Button>

                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="h-12" onClick={() => setStep("family_question")}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={() => setStep("consent")}
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP: Consent */}
              {step === "consent" && (
                <motion.div
                  key="consent"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Seus dados estão protegidos</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Seus dados serão tratados com confidencialidade e segurança, 
                          em conformidade com a Lei Geral de Proteção de Dados (LGPD).
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                      <Checkbox
                        id="terms"
                        checked={acceptTerms}
                        onCheckedChange={(checked) => setAcceptTerms(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="terms" className="text-sm leading-relaxed cursor-pointer">
                        Li e aceito os{" "}
                        <a
                          href="/termos-de-uso"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Termos de Uso
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </label>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                      <Checkbox
                        id="privacy"
                        checked={acceptPrivacy}
                        onCheckedChange={(checked) => setAcceptPrivacy(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="privacy" className="text-sm leading-relaxed cursor-pointer">
                        Li e aceito a{" "}
                        <a
                          href="/politica-de-privacidade"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Política de Privacidade
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </label>
                    </div>

                    <div className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors">
                      <Checkbox
                        id="lgpd"
                        checked={acceptLgpd}
                        onCheckedChange={(checked) => setAcceptLgpd(checked === true)}
                        className="mt-0.5"
                      />
                      <label htmlFor="lgpd" className="text-sm leading-relaxed cursor-pointer">
                        Autorizo o tratamento dos meus dados pessoais conforme a{" "}
                        <a
                          href="/lgpd"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary font-medium hover:underline inline-flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          LGPD
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setStep("family_question")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={() => {
                        if (isGoogleUser) {
                          setStep("set_password");
                        } else {
                          handleCompleteOnboarding();
                        }
                      }}
                      disabled={!allConsentsAccepted || isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      {isGoogleUser ? "Continuar" : (isLoading ? "Finalizando..." : "Finalizar Cadastro")}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP: Set Password (Google OAuth users) */}
              {step === "set_password" && (
                <motion.div
                  key="set_password"
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25 }}
                  className="space-y-5"
                >
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-start gap-3">
                      <Lock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Defina uma senha de acesso</p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          Você se cadastrou com Google. Defina uma senha para também poder acessar via email e senha.
                        </p>
                      </div>
                    </div>
                  </div>

                  <FieldGroup label="Senha">
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="h-11 text-sm input-executive"
                    />
                  </FieldGroup>

                  <FieldGroup label="Confirmar senha">
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repita a senha"
                      className="h-11 text-sm input-executive"
                    />
                  </FieldGroup>

                  {password && confirmPassword && password !== confirmPassword && (
                    <p className="text-xs text-destructive">As senhas não coincidem.</p>
                  )}

                  <div className="flex gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="h-12"
                      onClick={() => setStep("consent")}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      className="flex-1 h-12 text-sm font-semibold"
                      onClick={async () => {
                        if (password.length < 6) {
                          toast.error("A senha deve ter pelo menos 6 caracteres.");
                          return;
                        }
                        if (password !== confirmPassword) {
                          toast.error("As senhas não coincidem.");
                          return;
                        }
                        // Set password for Google user
                        setIsLoading(true);
                        try {
                          const { error } = await supabase.auth.updateUser({ password });
                          if (error) throw error;
                          toast.success("Senha definida com sucesso!");
                          await handleCompleteOnboarding();
                        } catch (err: any) {
                          toast.error("Erro ao definir senha: " + (err.message || "Tente novamente."));
                          setIsLoading(false);
                        }
                      }}
                      disabled={!password || password.length < 6 || password !== confirmPassword || isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      {isLoading ? "Finalizando..." : "Finalizar Cadastro"}
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
