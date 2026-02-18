import { motion } from "framer-motion";
import { UserCheck, UserPlus } from "lucide-react";
import { Label } from "@/components/ui/label";

interface StepClientQuestionProps {
  isIbbraClient: boolean | null;
  onAnswer: (answer: boolean) => void;
  slideVariants: any;
}

export function StepClientQuestion({ isIbbraClient, onAnswer, slideVariants }: StepClientQuestionProps) {
  return (
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
          onClick={() => onAnswer(true)}
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
          onClick={() => onAnswer(false)}
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
  );
}
