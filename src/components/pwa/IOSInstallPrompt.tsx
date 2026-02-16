import { useState, useEffect } from "react";
import { X, Share, Plus, ArrowDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return ("standalone" in window.navigator && (window.navigator as any).standalone) ||
    window.matchMedia("(display-mode: standalone)").matches;
}

export function IOSInstallPrompt() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (isIOS() && !isInStandaloneMode()) {
      const dismissed = sessionStorage.getItem("pwa-install-dismissed");
      if (!dismissed) {
        const timer = setTimeout(() => setShow(true), 3000);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleDismiss = () => {
    setShow(false);
    sessionStorage.setItem("pwa-install-dismissed", "true");
  };

  if (!show) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 200, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 200, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="fixed bottom-0 left-0 right-0 z-[9999] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-md rounded-2xl border border-border/40 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="relative bg-[hsl(213,80%,13%)] p-5 text-white">
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
            <h3 className="font-serif text-lg font-semibold tracking-tight">
              Instale o IBBRA
            </h3>
            <p className="mt-1 text-sm text-white/70">
              Acesse como um app nativo no seu iPhone
            </p>
          </div>

          {/* Steps */}
          <div className="p-5 space-y-4">
            <Step
              number={1}
              icon={<Share className="h-5 w-5 text-accent" />}
              title="Toque em Compartilhar"
              description='No Safari, toque no ícone de compartilhar na barra inferior'
            />
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <Step
              number={2}
              icon={<Plus className="h-5 w-5 text-accent" />}
              title="Adicionar à Tela de Início"
              description="Role e selecione esta opção no menu"
            />
            <div className="flex justify-center">
              <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <Step
              number={3}
              icon={<span className="text-lg">✓</span>}
              title="Confirme a instalação"
              description='Toque em "Adicionar" e pronto!'
            />
          </div>

          {/* Footer */}
          <div className="border-t border-border/30 px-5 py-3">
            <button
              onClick={handleDismiss}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground transition-colors hover:bg-accent/90"
            >
              Entendi
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function Step({ number, icon, title, description }: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/8">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">
          <span className="text-accent mr-1">{number}.</span>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
    </div>
  );
}
