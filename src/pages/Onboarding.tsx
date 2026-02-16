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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

type Step = "client_question" | "cpf_validation" | "profile_form" | "family_question" | "family_form" | "completing";

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
  const [address, setAddress] = useState("");

  // Family members
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([emptyFamilyMember()]);

  // Load existing data from localStorage (Google OAuth) or profile
  useEffect(() => {
    if (!user) return;

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
        // Auto-advance: Google OAuth users already chose client type, go straight to profile form
        setStep("profile_form");
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
      handleCompleteOnboarding();
    }
  };

  // Family member helpers
  const addFamilyMember = () => setFamilyMembers(prev => [...prev, emptyFamilyMember()]);
  const removeFamilyMember = (index: number) =>
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  const updateFamilyMember = (index: number, field: keyof FamilyMember, value: string) =>
    setFamilyMembers(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));

  const handleCompleteOnboarding = async () => {
    setStep("completing");
    setIsLoading(true);

    try {
      const cleanCpf = cpf.replace(/\D/g, "");

      // Build family members array
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
        p_address: address || null,
        p_is_ibbra_client: isIbbraClient || false,
        p_external_client_validated: validationResult?.found || false,
        p_family_members: validMembers,
      });

      if (rpcError) throw rpcError;

      // Clean up localStorage
      localStorage.removeItem("ibbra_registration");

      // Set selected org from result
      const orgId = (result as any)?.organization_id;
      if (orgId) {
        localStorage.setItem("selectedOrganizationId", orgId);
      }

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
    profile_form: "Preencha seus dados para continuar.",
    family_question: "Deseja cadastrar membros da família?",
    family_form: "Adicione os dados dos seus familiares.",
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
                Complete seu cadastro
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
                      onClick={handleProfileNext}
                      disabled={!fullName.trim()}
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
                      <Check className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                      <span className="text-sm font-medium">Pular e concluir</span>
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
                      onClick={handleCompleteOnboarding}
                      disabled={isLoading}
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
