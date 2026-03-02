import { useState, useEffect } from "react";
import { X, Share, Plus } from "lucide-react";
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
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[9999] p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-sm rounded-xl border border-border/30 bg-card/95 backdrop-blur-xl shadow-lg overflow-hidden">
          <div className="flex items-start gap-3 p-4">
            <div className="shrink-0 h-9 w-9 rounded-lg bg-[hsl(213,80%,13%)] flex items-center justify-center">
              <img src="/icons/icon-192.png" alt="IBBRA" className="h-6 w-6 rounded" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Instale o IBBRA</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                Toque em <Share className="inline h-3 w-3 text-accent -mt-0.5" /> e depois em <Plus className="inline h-3 w-3 text-accent -mt-0.5" /> <span className="font-medium">Tela de Início</span>
              </p>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-full p-1 text-muted-foreground/50 hover:bg-muted/60 hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}