import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Share, Plus, Smartphone, ArrowDown } from "lucide-react";

interface PWAInstallModalProps {
  open: boolean;
  onClose: () => void;
}

const steps = [
  {
    icon: Share,
    title: "Toque no botão Compartilhar",
    description: 'Na barra inferior do Safari, toque no ícone de compartilhamento',
    accent: true,
  },
  {
    icon: ArrowDown,
    title: 'Selecione "Adicionar à Tela Inicial"',
    description: 'Role para baixo na lista e toque na opção "Adicionar à Tela de Início"',
    accent: false,
  },
  {
    icon: Plus,
    title: "Confirme a instalação",
    description: 'Toque em "Adicionar" no canto superior direito para confirmar',
    accent: false,
  },
];

export function PWAInstallModal({ open, onClose }: PWAInstallModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 32, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-[9999] pb-[env(safe-area-inset-bottom)]"
          >
            <div className="mx-auto max-w-lg rounded-t-2xl border border-border/30 bg-card shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/20">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Instale o IBBRA</p>
                    <p className="text-xs text-muted-foreground">Acesse direto da tela inicial</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Steps */}
              <div className="px-5 py-4 space-y-3">
                {steps.map((step, index) => {
                  const Icon = step.icon;
                  return (
                    <div key={index} className="flex items-start gap-3">
                      <div className={`mt-0.5 h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${step.accent ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground leading-tight">{step.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                      </div>
                      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/50 mt-1">{index + 1}</span>
                    </div>
                  );
                })}
              </div>

              {/* Footer hint */}
              <div className="px-5 pb-5">
                <div className="rounded-xl bg-muted/50 px-4 py-3 flex items-center gap-2.5">
                  <Share className="h-3.5 w-3.5 text-primary shrink-0" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    O botão de compartilhar fica na barra inferior do <span className="font-medium text-foreground">Safari</span>. Não aparece em outros navegadores.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
