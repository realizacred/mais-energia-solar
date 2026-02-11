import { motion } from "framer-motion";
import { CheckCircle, WifiOff, Loader2, RefreshCw, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useState } from "react";

interface WizardSuccessScreenProps {
  savedOffline: boolean;
  pendingCount: number;
  isOnline: boolean;
  isSyncing: boolean;
  onReset: () => void;
  onRetrySync: () => void;
  /** Handler for manual WhatsApp resend. Undefined = hide button (e.g. public form). */
  onResendWhatsApp?: () => Promise<boolean>;
}

export function WizardSuccessScreen({
  savedOffline,
  pendingCount,
  isOnline,
  isSyncing,
  onReset,
  onRetrySync,
  onResendWhatsApp,
}: WizardSuccessScreenProps) {
  const hasSynced = savedOffline && pendingCount === 0 && isOnline;
  const showOfflineState = savedOffline && !hasSynced;
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState<"idle" | "ok" | "fail">("idle");

  const handleResend = async () => {
    if (!onResendWhatsApp || resending) return;
    setResending(true);
    setResendResult("idle");
    try {
      const ok = await onResendWhatsApp();
      setResendResult(ok ? "ok" : "fail");
    } catch {
      setResendResult("fail");
    } finally {
      setResending(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto border-0 shadow-2xl overflow-hidden">
      <CardContent className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 sm:px-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-4 sm:mb-6 ${
            showOfflineState ? "bg-secondary/20" : "bg-primary/20"
          }`}
        >
          {showOfflineState ? (
            <WifiOff className="w-10 h-10 sm:w-12 sm:h-12 text-secondary" />
          ) : (
            <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
          )}
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center"
        >
          {showOfflineState 
            ? "Salvo Localmente!" 
            : hasSynced 
              ? "Cadastro Sincronizado!" 
              : "Cadastro Enviado!"}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-sm sm:text-base text-muted-foreground text-center mb-4 sm:mb-6"
        >
          {showOfflineState 
            ? "Seu cadastro foi salvo e será enviado automaticamente quando a conexão for restabelecida."
            : hasSynced
              ? "Seu cadastro offline foi sincronizado com sucesso! Nossa equipe entrará em contato em breve."
              : "Obrigado pelo interesse! Nossa equipe entrará em contato em breve."
          }
        </motion.p>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
        >
          <Button onClick={onReset} variant="outline" className="w-full sm:w-auto">
            Fazer novo cadastro
          </Button>
          {onResendWhatsApp && (
            <Button
              onClick={handleResend}
              disabled={resending}
              variant={resendResult === "ok" ? "outline" : "default"}
              className="gap-2 w-full sm:w-auto"
            >
              {resending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : resendResult === "ok" ? (
                <CheckCircle className="w-4 h-4 text-primary" />
              ) : (
                <MessageCircle className="w-4 h-4" />
              )}
              {resendResult === "ok"
                ? "Enviado!"
                : resendResult === "fail"
                  ? "Tentar novamente"
                  : "Reenviar WhatsApp"}
            </Button>
          )}
          {showOfflineState && pendingCount > 0 && isOnline && (
            <Button 
              onClick={onRetrySync} 
              disabled={isSyncing}
              className="gap-2 w-full sm:w-auto"
            >
              {isSyncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Sincronizar Agora
            </Button>
          )}
        </motion.div>
      </CardContent>
    </Card>
  );
}
