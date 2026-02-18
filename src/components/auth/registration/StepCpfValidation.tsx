import { motion } from "framer-motion";
import { ArrowLeft, ShieldCheck, AlertCircle, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type IbbraClientValidationResult } from "@/services/ibbraClientValidationService";

interface StepCpfValidationProps {
  cpf: string;
  onCpfChange: (value: string) => void;
  validationResult: IbbraClientValidationResult | null;
  validationError: string;
  isLoading: boolean;
  onValidate: () => void;
  onProceed: () => void;
  onBack: () => void;
  slideVariants: any;
}

export function StepCpfValidation({
  cpf,
  onCpfChange,
  validationResult,
  validationError,
  isLoading,
  onValidate,
  onProceed,
  onBack,
  slideVariants,
}: StepCpfValidationProps) {
  return (
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
            onChange={(e) => onCpfChange(e.target.value)}
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
        <Button variant="outline" className="h-12" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        {!validationResult?.found ? (
          <Button
            className="flex-1 h-12 text-sm font-semibold"
            onClick={onValidate}
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
          <Button className="flex-1 h-12 text-sm font-semibold" onClick={onProceed}>
            Continuar
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
