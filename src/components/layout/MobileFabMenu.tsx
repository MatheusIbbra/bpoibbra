import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, TrendingUp, TrendingDown, Building, Brain,
  Wallet, Tag, Layers, Upload, ChevronRight,
} from "lucide-react";
import { TransactionDialog } from "@/components/transactions/TransactionDialog";
import { AccountDialog } from "@/components/accounts/AccountDialog";
import { hapticSuccess, hapticLight } from "@/lib/haptics";

const cadastroCards = [
  { label: "Contas", icon: Wallet, path: "/contas" },
  { label: "Categorias", icon: Tag, path: "/categorias" },
  { label: "Grupos de Custo", icon: Layers, path: "/centros-custo" },
  { label: "Importar Extrato", icon: Upload, path: "/cadastros?tab=importar" },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

function Backdrop({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm"
      onClick={onClick}
    />
  );
}

export function MobileFabMenu({ isOpen, onClose }: Props) {
  const navigate = useNavigate();
  const [showCadastros, setShowCadastros] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense" | null>(null);

  // Reset sub-screen when closing
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => setShowCadastros(false), 300);
    }
  }, [isOpen]);

  const handleNav = (path: string) => {
    onClose();
    setTimeout(() => navigate(path), 200);
  };

  const handleTransactionClose = () => {
    setTransactionType(null);
    onClose();
  };

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <>
            <Backdrop onClick={onClose} />
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 380, damping: 35 }}
              className="fixed inset-x-0 bottom-0 z-[71] bg-background rounded-t-[24px] shadow-2xl pb-[calc(env(safe-area-inset-bottom)+80px)]"
            >
              {/* Drag handle */}
              <div className="mx-auto w-8 h-1 rounded-full bg-muted-foreground/15 mt-3 mb-4" />

              {/* Close button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-4 h-8 w-8 flex items-center justify-center rounded-full bg-secondary/40 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>

              {!showCadastros ? (
                <div className="px-5 pb-2 space-y-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/50 mb-1">
                    Nova Ação
                  </p>

                  {/* Main action rows */}
                  {[
                    {
                      label: "Novo Lançamento",
                      sub: "Receita ou despesa manual",
                      icon: TrendingUp,
                      color: "hsl(var(--success))",
                      action: () => setTransactionType("income"),
                    },
                    {
                      label: "Conectar Open Finance",
                      sub: "Vincular banco automaticamente",
                      icon: Building,
                      color: "hsl(var(--brand-deep))",
                      action: () => handleNav("/open-finance"),
                    },
                    {
                      label: "Cadastros",
                      sub: "Contas, categorias, importações",
                      icon: Wallet,
                      color: "hsl(var(--brand-highlight))",
                      action: () => setShowCadastros(true),
                      trailing: <ChevronRight className="h-4 w-4 text-muted-foreground/40" />,
                    },
                    {
                      label: "IA Financeira",
                      sub: "Assistente e classificação inteligente",
                      icon: Brain,
                      color: "hsl(265 80% 60%)",
                      action: () => {
                        onClose();
                        window.dispatchEvent(new CustomEvent("ibbra:open-ai-chat"));
                      },
                    },
                  ].map((item) => (
                    <button
                      key={item.label}
                      onClick={item.action}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-secondary/15 hover:bg-secondary/30 transition-colors border border-border/10 active:scale-[0.98]"
                    >
                      <div
                        className="h-11 w-11 rounded-2xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${item.color}18` }}
                      >
                        <item.icon className="h-5 w-5" style={{ color: item.color }} strokeWidth={1.7} />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{item.sub}</p>
                      </div>
                      {item.trailing || null}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="px-5 pb-2">
                  <button
                    onClick={() => setShowCadastros(false)}
                    className="flex items-center gap-2 text-muted-foreground text-sm mb-4"
                  >
                    <ChevronRight className="h-4 w-4 rotate-180" />
                    Voltar
                  </button>
                  <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-muted-foreground/50 mb-3">
                    Cadastros
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {cadastroCards.map((item) => (
                      <button
                        key={item.label}
                        onClick={() => handleNav(item.path)}
                        className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-secondary/15 hover:bg-secondary/30 transition-colors border border-border/10 active:scale-[0.98]"
                      >
                        <div
                          className="h-10 w-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: "hsl(var(--brand-deep)/0.08)" }}
                        >
                          <item.icon className="h-5 w-5" style={{ color: "hsl(var(--brand-deep))" }} strokeWidth={1.7} />
                        </div>
                        <span className="text-xs font-medium text-foreground text-center leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Transaction Dialog triggered from FAB */}
      {transactionType && (
        <TransactionDialog
          open={!!transactionType}
          onOpenChange={(open) => { if (!open) handleTransactionClose(); }}
          defaultType={transactionType}
        />
      )}
    </>
  );
}
