import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Loader2, UserCheck, UserPlus, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
}

type Step = "client_question" | "cpf_validation" | "form_standard" | "form_ibbra";

export default function RegistrationFlow({ onBack }: RegistrationFlowProps) {
  const [step, setStep] = useState<Step>("client_question");
  const [isIbbraClient, setIsIbbraClient] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // CPF validation state
  const [cpf, setCpf] = useState("");
  const [validationResult, setValidationResult] = useState<IbbraClientValidationResult | null>(null);
  const [validationError, setValidationError] = useState("");

  // Form state
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const currentStepIndex = step === "client_question" ? 0 : step === "cpf_validation" ? 1 : 2;
  const totalSteps = isIbbraClient ? 3 : 2;

  const handleClientAnswer = (answer: boolean) => {
    setIsIbbraClient(answer);
    if (answer) {
      setStep("cpf_validation");
    } else {
      setStep("form_standard");
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

  const handleProceedToForm = () => {
    if (validationResult?.found) {
      setStep("form_ibbra");
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

    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      // Update profile with additional data
      if (data.user) {
        const cleanCpf = cpf.replace(/\D/g, "");
        const profileData: Record<string, unknown> = {
          user_id: data.user.id,
          full_name: fullName,
          cpf: cleanCpf || null,
          birth_date: birthDate || null,
          phone: phone || null,
          address: address || null,
          is_ibbra_client: isIbbraClient || false,
          external_client_validated: validationResult?.found || false,
          validated_at: validationResult?.found ? new Date().toISOString() : null,
        };

        // Try upsert on profiles
        const { error: profileError } = await supabase
          .from("profiles")
          .update(profileData)
          .eq("user_id", data.user.id);

        if (profileError) {
          console.warn("Profile update warning:", profileError.message);
        }
      }

      toast.success("Conta criada com sucesso! Verifique seu email para confirmar o cadastro.");
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
        <p className="text-sm text-muted-foreground">
          {step === "client_question" && "Responda para personalizarmos seu cadastro."}
          {step === "cpf_validation" && "Validação do seu cadastro IBBRA."}
          {step === "form_standard" && "Preencha seus dados para continuar."}
          {step === "form_ibbra" && "Confirme seus dados e crie sua senha."}
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex gap-1.5">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= currentStepIndex ? "bg-primary" : "bg-muted"
            }`}
          />
        ))}
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
            {/* Client question */}
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
                <span className="text-sm font-medium">Sim, sou cliente</span>
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
                <span className="text-sm font-medium">Não, quero me cadastrar</span>
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

              {/* Validation error */}
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

              {/* Validation success */}
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

        {/* STEP: Standard Form (non-IBBRA) */}
        {step === "form_standard" && (
          <motion.div
            key="form_standard"
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            <FieldGroup label="Nome completo">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome completo" className="h-11 text-sm input-executive" />
            </FieldGroup>
            <FieldGroup label="Data de nascimento">
              <Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className="h-11 text-sm input-executive" />
            </FieldGroup>
            <FieldGroup label="CPF">
              <Input value={cpf} onChange={(e) => handleCpfChange(e.target.value)} placeholder="000.000.000-00" className="h-11 text-sm input-executive" inputMode="numeric" maxLength={14} />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Telefone">
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" className="h-11 text-sm input-executive" inputMode="tel" />
              </FieldGroup>
              <FieldGroup label="Email">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>
            <FieldGroup label="Endereço">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, cidade" className="h-11 text-sm input-executive" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Senha">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
              <FieldGroup label="Confirmar senha">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="h-12" onClick={() => { setStep("client_question"); }}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button className="flex-1 h-12 text-sm font-semibold" onClick={handleSubmit} disabled={isLoading}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                {isLoading ? "Criando conta..." : "Criar conta"}
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
            className="space-y-4"
          >
            {/* Pre-filled (read-only) fields */}
            <FieldGroup label="Nome completo (validado)">
              <Input value={fullName} readOnly className="h-11 text-sm input-executive bg-muted/50 cursor-not-allowed" />
            </FieldGroup>
            <FieldGroup label="Data de nascimento (validada)">
              <Input type="date" value={birthDate} readOnly className="h-11 text-sm input-executive bg-muted/50 cursor-not-allowed" />
            </FieldGroup>

            {/* Editable fields */}
            <FieldGroup label="Telefone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" className="h-11 text-sm input-executive" inputMode="tel" />
            </FieldGroup>
            <FieldGroup label="Endereço">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Rua, número, cidade" className="h-11 text-sm input-executive" />
            </FieldGroup>
            <FieldGroup label="Email">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 text-sm input-executive" />
            </FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <FieldGroup label="Senha">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
              <FieldGroup label="Confirmar senha">
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="h-11 text-sm input-executive" />
              </FieldGroup>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="h-12" onClick={() => setStep("cpf_validation")}>
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
