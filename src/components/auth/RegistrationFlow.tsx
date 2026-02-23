import { useState } from "react";
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
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  validateClientByCPF,
  isValidCPF,
  formatCPF,
  type IbbraClientValidationResult,
} from "@/services/ibbraClientValidationService";

interface RegistrationFlowProps {
  onBack: () => void;
  onGoogleSignUp?: () => void;
}

interface FamilyMember {
  relationship: string;
  full_name: string;
  age: string;
  phone: string;
  email: string;
}

type Step =
  | "client_question"
  | "cpf_validation"
  | "signup_method"
  | "form_standard"
  | "form_ibbra"
  | "family_question"
  | "family_form";

const RELATIONSHIP_OPTIONS = [
  "Cônjuge",
  "Filho(a)",
  "Pai/Mãe",
  "Irmão(ã)",
  "Avô/Avó",
  "Neto(a)",
  "Tio(a)",
  "Sobrinho(a)",
  "Outro",
];

const emptyFamilyMember = (): FamilyMember => ({
  relationship: "",
  full_name: "",
  age: "",
  phone: "",
  email: "",
});

// Format phone: (XX) XXXXX-XXXX
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// Format birth date: DD/MM/YYYY
function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

// Convert DD/MM/YYYY to YYYY-MM-DD
function birthDateToISO(formatted: string): string {
  const parts = formatted.split("/");
  if (parts.length === 3 && parts[2].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return "";
}

// Mask partial email: m****@gmail.com
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const visible = local.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(local.length - 1, 3))}@${domain}`;
}

export default function RegistrationFlow({ onBack, onGoogleSignUp }: RegistrationFlowProps) {
  const [step, setStep] = useState<Step>("client_question");
  const [isIbbraClient, setIsIbbraClient] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // CPF validation state
  const [cpf, setCpf] = useState("");
  const [validationResult, setValidationResult] = useState<IbbraClientValidationResult | null>(null);
  const [validationError, setValidationError] = useState("");
  
  // CPF duplicate check
  const [cpfDuplicateEmail, setCpfDuplicateEmail] = useState<string | null>(null);

  // Form state
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState(""); // DD/MM/YYYY format
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  // Address fields (separated)
  const [street, setStreet] = useState("");
  const [streetNumber, setStreetNumber] = useState("");
  const [complement, setComplement] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Consent
  const [consentAccepted, setConsentAccepted] = useState(false);

  // Family members state
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([emptyFamilyMember()]);

  const stepDescriptions: Record<Step, string> = {
    client_question: "Responda para personalizarmos seu cadastro.",
    cpf_validation: "Validação do seu cadastro IBBRA.",
    signup_method: "Escolha como deseja criar sua conta.",
    form_standard: "Preencha seus dados para continuar.",
    form_ibbra: "Confirme seus dados e crie sua senha.",
    family_question: "Deseja cadastrar familiares?",
    family_form: "Adicione os dados dos seus familiares.",
  };

  const handleClientAnswer = (answer: boolean) => {
    setIsIbbraClient(answer);
    if (answer) {
      setStep("cpf_validation");
    } else {
      setStep("signup_method");
    }
  };

  const handleCpfChange = (value: string) => {
    setCpf(formatCPF(value));
    setValidationError("");
    setValidationResult(null);
    setCpfDuplicateEmail(null);
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
      const result = await validateClientByCPF(cleanCpf);
      setValidationResult(result);
      if (result.found) {
        setFullName(result.full_name || "");
        // Convert ISO date to DD/MM/YYYY for display
        if (result.birth_date) {
          const [y, m, d] = result.birth_date.split("-");
          setBirthDate(`${d}/${m}/${y}`);
        }
        toast.success("Cliente IBBRA confirmado!");
      } else {
        setValidationError(
          "Cliente não encontrado na base IBBRA. Verifique o CPF ou entre em contato com nosso atendimento."
        );
      }
    } catch {
      setValidationError("Erro ao validar. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };
  
  // Check CPF duplicate when leaving CPF field
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
      // Silently fail - not critical
    }
  };

  const handleProceedToForm = () => {
    if (validationResult?.found) {
      setStep("signup_method");
    }
  };

  const handleChooseGoogle = async () => {
    try {
      const addressFull = [street, streetNumber, complement, city, state, zipCode].filter(Boolean).join(", ");
      
      // Generate session token client-side to avoid needing SELECT after INSERT
      // (anon users can INSERT but can't SELECT due to RLS)
      const sessionToken = crypto.randomUUID();
      
      const { error } = await (supabase as any)
        .from("pending_registrations")
        .insert({
          session_token: sessionToken,
          is_ibbra_client: isIbbraClient || false,
          cpf: cpf.replace(/\D/g, "") || null,
          full_name: validationResult?.found ? fullName : null,
          birth_date: validationResult?.found && birthDate ? birthDateToISO(birthDate) : null,
          validated: validationResult?.found || false,
          address: addressFull || null,
          state: state || null,
          city: city || null,
          zip_code: zipCode || null,
          street_number: streetNumber || null,
          complement: complement || null,
        });

      if (error) throw error;
      localStorage.setItem("ibbra_reg_token", sessionToken);
      onGoogleSignUp?.();
    } catch (err) {
      console.error("Error saving pending registration:", err);
      toast.error("Erro ao preparar cadastro. Tente novamente.");
    }
  };

  const handleChooseManual = () => {
    if (isIbbraClient && validationResult?.found) {
      setStep("form_ibbra");
    } else {
      setStep("form_standard");
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      toast.error("Informe seu email.");
      return;
    }
    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (!isIbbraClient && !fullName.trim()) {
      toast.error("Informe seu nome completo.");
      return;
    }
    if (!consentAccepted) {
      toast.error("Você precisa aceitar os termos para continuar.");
      return;
    }

    setIsLoading(true);

    try {
      const validMembers = familyMembers.filter(m => m.full_name.trim() && m.relationship);
      const addressFull = [street, streetNumber, complement, city, state, zipCode].filter(Boolean).join(", ");
      
      const sessionToken = crypto.randomUUID();
      
      const { error: pendingError } = await (supabase as any)
        .from("pending_registrations")
        .insert({
          session_token: sessionToken,
          is_ibbra_client: isIbbraClient || false,
          cpf: cpf.replace(/\D/g, "") || null,
          full_name: fullName || null,
          birth_date: birthDate ? birthDateToISO(birthDate) : null,
          phone: phone.replace(/\D/g, "") || null,
          address: addressFull || null,
          state: state || null,
          city: city || null,
          zip_code: zipCode || null,
          street_number: streetNumber || null,
          complement: complement || null,
          validated: validationResult?.found || false,
          family_members: validMembers.length > 0 ? validMembers : null,
        });

      if (pendingError) throw pendingError;

      localStorage.setItem("ibbra_reg_token", sessionToken);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      const isRepeatedSignup = data.user && 
        (!data.user.identities || data.user.identities.length === 0);

      if (isRepeatedSignup) {
        toast.error("Este email já está cadastrado. Tente fazer login ou recuperar sua senha.");
        return;
      }

      const needsConfirmation = data.user && !data.session;

      if (needsConfirmation) {
        toast.success("Conta criada! Verifique seu e-mail para confirmar o cadastro antes de fazer login.");
      } else {
        toast.success("Conta criada com sucesso!");
      }
      
      onBack();
    } catch (err: any) {
      const msg = err.message?.includes("already registered")
        ? "Este email já está cadastrado."
        : err.message || "Erro ao criar conta.";
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  };

  // Family member helpers
  const addFamilyMember = () => setFamilyMembers(prev => [...prev, emptyFamilyMember()]);
  const removeFamilyMember = (index: number) =>
    setFamilyMembers(prev => prev.filter((_, i) => i !== index));
  const updateFamilyMember = (index: number, field: keyof FamilyMember, value: string) =>
    setFamilyMembers(prev => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao acesso
        </button>
        <h1
          className="text-2xl font-semibold tracking-tight"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Criar sua conta
        </h1>
        <p className="text-sm text-muted-foreground">{stepDescriptions[step]}</p>
      </div>

      {/* Steps */}
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
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Você já é cliente IBBRA?
              </Label>
              <p className="text-xs text-muted-foreground/70">
                Clientes IBBRA possuem validação facilitada.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleClientAnswer(true)}
                className={`group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
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
                className={`group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 transition-all duration-200 hover:shadow-md ${
                  isIbbraClient === false
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <UserPlus className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Não</span>
              </button>
            </div>
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
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                  <p className="text-sm text-destructive/90">{validationError}</p>
                </motion.div>
              )}

              {validationResult?.found && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20"
                >
                  <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Cliente confirmado</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{validationResult.full_name}</p>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  setStep("client_question");
                  setCpf("");
                  setValidationResult(null);
                  setValidationError("");
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {!validationResult?.found ? (
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={handleValidateCpf}
                  disabled={isLoading || cpf.replace(/\D/g, "").length !== 11}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <ShieldCheck className="h-4 w-4 mr-2" />
                  )}
                  {isLoading ? "Validando..." : "Validar Cliente"}
                </Button>
              ) : (
                <Button
                  className="flex-1 h-12 text-sm font-semibold"
                  onClick={handleProceedToForm}
                >
                  Continuar
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              )}
            </div>
          </motion.div>
        )}

        {/* STEP: Signup Method */}
        {step === "signup_method" && (
          <motion.div
            key="signup_method"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-5"
          >
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Como deseja criar sua conta?
              </Label>
            </div>

            {onGoogleSignUp && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 text-sm"
                onClick={handleChooseGoogle}
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Cadastrar com Google
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              className="w-full h-12 text-sm font-semibold"
              onClick={handleChooseManual}
            >
              Cadastrar com email e senha
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <Button
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
              onClick={() => {
                if (isIbbraClient) {
                  setStep("cpf_validation");
                } else {
                  setStep("client_question");
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </motion.div>
        )}

        {/* STEP: Standard Form (non-IBBRA) */}
        {step === "form_standard" && (
          <motion.div
            key="form_standard"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <FieldGroup label="Nome completo">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className="h-11 text-sm input-executive" />
            </FieldGroup>
            
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Data de nascimento">
                <Input 
                  value={birthDate} 
                  onChange={(e) => setBirthDate(formatBirthDate(e.target.value))} 
                  placeholder="DD/MM/AAAA" 
                  className="h-11 text-sm input-executive" 
                  inputMode="numeric"
                  maxLength={10}
                />
              </FieldGroup>
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
            </div>
            
            {/* CPF Duplicate Warning */}
            {cpfDuplicateEmail && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/30"
              >
                <Mail className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-medium">CPF já cadastrado</p>
                  <p className="text-muted-foreground mt-0.5">
                    E-mail vinculado: <span className="font-mono">{maskEmail(cpfDuplicateEmail)}</span>
                  </p>
                  <button 
                    onClick={onBack} 
                    className="text-primary underline mt-1 hover:text-primary/80"
                  >
                    Recuperar senha
                  </button>
                </div>
              </motion.div>
            )}
            
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Telefone">
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(formatPhone(e.target.value))} 
                  placeholder="(11) 99999-0000" 
                  className="h-11 text-sm input-executive" 
                  inputMode="tel"
                  maxLength={15}
                />
              </FieldGroup>
              <FieldGroup label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Senha">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
              <FieldGroup label="Confirmar senha">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>
            
            {/* Consent */}
            <div className="flex items-start gap-2 pt-2">
              <Checkbox 
                id="consent" 
                checked={consentAccepted} 
                onCheckedChange={(v) => setConsentAccepted(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Aceito os <a href="/termos-de-uso" target="_blank" className="text-primary underline">Termos de Uso</a>, 
                a <a href="/politica-privacidade" target="_blank" className="text-primary underline">Política de Privacidade</a> e 
                o tratamento dos meus dados conforme a LGPD.
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="h-12" onClick={() => setStep("signup_method")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button 
                className="flex-1 h-12 text-sm font-semibold" 
                onClick={() => setStep("family_question")} 
                disabled={!email.trim() || !password || password.length < 6 || password !== confirmPassword || !fullName.trim() || !consentAccepted}
              >
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* STEP: IBBRA Client Form */}
        {step === "form_ibbra" && (
          <motion.div
            key="form_ibbra"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            <FieldGroup label="Nome completo (validado)">
              <Input value={fullName} readOnly className="h-11 text-sm input-executive bg-muted/50 cursor-not-allowed" />
            </FieldGroup>
            <FieldGroup label="Data de nascimento (validada)">
              <Input value={birthDate} readOnly className="h-11 text-sm input-executive bg-muted/50 cursor-not-allowed" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Telefone">
                <Input 
                  value={phone} 
                  onChange={(e) => setPhone(formatPhone(e.target.value))} 
                  placeholder="(11) 99999-0000" 
                  className="h-11 text-sm input-executive" 
                  inputMode="tel"
                  maxLength={15}
                />
              </FieldGroup>
              <FieldGroup label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Senha">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
              <FieldGroup label="Confirmar senha">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>
            
            {/* Consent */}
            <div className="flex items-start gap-2 pt-2">
              <Checkbox 
                id="consent-ibbra" 
                checked={consentAccepted} 
                onCheckedChange={(v) => setConsentAccepted(v === true)}
                className="mt-0.5"
              />
              <label htmlFor="consent-ibbra" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
                Aceito os <a href="/termos-de-uso" target="_blank" className="text-primary underline">Termos de Uso</a>, 
                a <a href="/politica-privacidade" target="_blank" className="text-primary underline">Política de Privacidade</a> e 
                o tratamento dos meus dados conforme a LGPD.
              </label>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="outline" className="h-12" onClick={() => setStep("signup_method")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button 
                className="flex-1 h-12 text-sm font-semibold" 
                onClick={() => setStep("family_question")} 
                disabled={!email.trim() || !password || password.length < 6 || password !== confirmPassword || !consentAccepted}
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
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Cadastrar familiares?
              </Label>
              <p className="text-xs text-muted-foreground/70">
                Você pode adicionar parentes ao seu cadastro agora ou fazer isso depois.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setStep("family_form")}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/40 transition-all duration-200 hover:shadow-md"
              >
                <Users className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium">Sim, adicionar</span>
              </button>

              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="group relative flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/40 transition-all duration-200 hover:shadow-md"
              >
                {isLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-primary/70" />
                ) : (
                  <Check className="h-8 w-8 text-primary/70 group-hover:text-primary transition-colors" />
                )}
                <span className="text-sm font-medium">{isLoading ? "Criando..." : "Não, finalizar"}</span>
              </button>
            </div>

            <Button
              variant="ghost"
              className="w-full h-10 text-sm text-muted-foreground"
              onClick={() => {
                if (isIbbraClient && validationResult?.found) {
                  setStep("form_ibbra");
                } else {
                  setStep("form_standard");
                }
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar ao formulário
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
            {familyMembers.map((member, index) => (
              <div key={index} className="space-y-3 p-4 rounded-lg border border-border bg-muted/20">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Familiar {index + 1}
                  </span>
                  {familyMembers.length > 1 && (
                    <button
                      onClick={() => removeFamilyMember(index)}
                      className="text-destructive/70 hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <FieldGroup label="Grau de parentesco">
                  <Select value={member.relationship} onValueChange={(v) => updateFamilyMember(index, "relationship", v)}>
                    <SelectTrigger className="h-11 text-sm input-executive">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {RELATIONSHIP_OPTIONS.map((opt) => (
                        <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FieldGroup>
                <FieldGroup label="Nome completo">
                  <Input value={member.full_name} onChange={(e) => updateFamilyMember(index, "full_name", e.target.value)} placeholder="Nome do familiar" className="h-11 text-sm input-executive" />
                </FieldGroup>
                <div className="grid grid-cols-3 gap-3">
                  <FieldGroup label="Idade">
                    <Input value={member.age} onChange={(e) => updateFamilyMember(index, "age", e.target.value)} placeholder="Ex: 35" className="h-11 text-sm input-executive" inputMode="numeric" />
                  </FieldGroup>
                  <FieldGroup label="Telefone">
                    <Input value={member.phone} onChange={(e) => updateFamilyMember(index, "phone", formatPhone(e.target.value))} placeholder="(11) 99999-0000" className="h-11 text-sm input-executive" inputMode="tel" maxLength={15} />
                  </FieldGroup>
                  <FieldGroup label="Email">
                    <Input type="email" value={member.email} onChange={(e) => updateFamilyMember(index, "email", e.target.value)} placeholder="email@email.com" className="h-11 text-sm input-executive" />
                  </FieldGroup>
                </div>
              </div>
            ))}

            <Button variant="outline" className="w-full h-10 text-sm" onClick={addFamilyMember}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar outro familiar
            </Button>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="h-12" onClick={() => setStep("family_question")}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button className="flex-1 h-12 text-sm font-semibold" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                {isLoading ? "Criando conta..." : "Criar conta"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
