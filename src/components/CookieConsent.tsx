import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Cookie, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const COOKIE_KEY = "cookie_consent_accepted";

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(COOKIE_KEY);
    if (!accepted) {
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem(COOKIE_KEY, "true");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg"
        >
          <div className="rounded-2xl border bg-card/95 backdrop-blur-xl p-5 shadow-2xl shadow-black/10">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Cookie className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Aviso de Cookies
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Utilizamos cookies para melhorar sua experiência e personalizar
                    conteúdo, em conformidade com a{" "}
                    <span className="font-medium text-foreground">LGPD</span>.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={accept} className="gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Aceitar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={accept}
                    className="text-xs text-muted-foreground"
                  >
                    Fechar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
