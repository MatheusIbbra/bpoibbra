import { motion, type Transition } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  ArrowUpDown, Building2, BanknoteIcon, Link2, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type EmptyVariant = "transactions" | "accounts" | "open-finance" | "no-base" | "budgets" | "categories" | "generic";

interface EmptyStateProps {
  variant: EmptyVariant;
  title?: string;
  description?: string;
  className?: string;
  primaryAction?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}

const CONFIG: Record<EmptyVariant, {
  Icon: React.ElementType;
  title: string;
  description: string;
  primaryLabel?: string;
  primaryRoute?: string;
  secondaryLabel?: string;
  secondaryRoute?: string;
}> = {
  transactions: {
    Icon: ArrowUpDown,
    title: "Nenhuma transação encontrada",
    description: "Importe um extrato ou adicione transações manualmente para começar.",
    primaryLabel: "Importar Extrato",
    primaryRoute: "/importacoes",
    secondaryLabel: "Adicionar Manualmente",
    secondaryRoute: "/transacoes",
  },
  accounts: {
    Icon: Wallet,
    title: "Nenhuma conta cadastrada",
    description: "Adicione uma conta bancária ou conecte via Open Finance para visualizar seus saldos.",
    primaryLabel: "Adicionar Conta",
    primaryRoute: "/contas",
    secondaryLabel: "Conectar via Open Finance",
    secondaryRoute: "/open-finance",
  },
  "open-finance": {
    Icon: Link2,
    title: "Conecte seu banco",
    description: "Sincronize automaticamente suas transações conectando suas contas bancárias via Open Finance.",
    primaryLabel: "Conectar Banco",
    primaryRoute: "/open-finance",
  },
  "no-base": {
    Icon: Building2,
    title: "Selecione uma base",
    description: "Selecione uma base no seletor acima para visualizar os dados desta seção.",
  },
  budgets: {
    Icon: BanknoteIcon,
    title: "Nenhum orçamento criado",
    description: "Defina orçamentos por categoria para controlar seus gastos mensais.",
    primaryLabel: "Criar Orçamento",
    primaryRoute: "/orcamentos",
  },
  categories: {
    Icon: ArrowUpDown,
    title: "Nenhuma categoria encontrada",
    description: "Crie categorias personalizadas para organizar suas transações.",
    primaryLabel: "Gerenciar Categorias",
    primaryRoute: "/categorias",
  },
  generic: {
    Icon: ArrowUpDown,
    title: "Nenhum dado encontrado",
    description: "Não há itens para exibir no momento.",
  },
};

const springTransition: Transition = { type: "spring", stiffness: 200, damping: 15 };
const easeTransition: Transition = { duration: 0.4, ease: "easeOut" };

export function EmptyState({
  variant,
  title,
  description,
  className,
  primaryAction,
  secondaryAction,
}: EmptyStateProps) {
  const navigate = useNavigate();
  const cfg = CONFIG[variant];
  const Icon = cfg.Icon;

  const resolvedTitle = title ?? cfg.title;
  const resolvedDesc = description ?? cfg.description;

  const handlePrimary = primaryAction
    ? primaryAction.onClick
    : cfg.primaryRoute
    ? () => navigate(cfg.primaryRoute!)
    : undefined;

  const handleSecondary = secondaryAction
    ? secondaryAction.onClick
    : cfg.secondaryRoute
    ? () => navigate(cfg.secondaryRoute!)
    : undefined;

  const primaryLabel = primaryAction?.label ?? cfg.primaryLabel;
  const secondaryLabel = secondaryAction?.label ?? cfg.secondaryLabel;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0, transition: easeTransition }}
      className={cn(
        "flex flex-col items-center justify-center gap-5 py-12 px-6 text-center",
        className
      )}
      role="status"
      aria-label={resolvedTitle}
    >
      {/* Icon badge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, transition: springTransition }}
        className="relative"
      >
        <div className="h-16 w-16 rounded-2xl bg-primary/[0.08] flex items-center justify-center shadow-sm ring-1 ring-primary/10">
          <Icon className="h-8 w-8 text-primary/60" strokeWidth={1.5} />
        </div>
        <div className="absolute inset-0 rounded-2xl ring-2 ring-primary/10 animate-pulse pointer-events-none" />
      </motion.div>

      {/* Text */}
      <div className="space-y-1.5 max-w-xs">
        <h3 className="text-sm font-semibold text-foreground">{resolvedTitle}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{resolvedDesc}</p>
      </div>

      {/* Actions */}
      {(handlePrimary || handleSecondary) && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
          {handlePrimary && primaryLabel && (
            <Button size="sm" onClick={handlePrimary} className="h-8 text-xs gap-1.5">
              {primaryLabel}
            </Button>
          )}
          {handleSecondary && secondaryLabel && (
            <Button size="sm" variant="outline" onClick={handleSecondary} className="h-8 text-xs gap-1.5">
              {secondaryLabel}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
