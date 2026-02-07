import { motion } from "framer-motion";
import { AlertTriangle, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface RateLimitWarningProps {
  isBlocked: boolean;
  remainingSeconds: number;
  remainingAttempts: number;
}

export function RateLimitWarning({ 
  isBlocked, 
  remainingSeconds, 
  remainingAttempts 
}: RateLimitWarningProps) {
  const [displaySeconds, setDisplaySeconds] = useState(remainingSeconds);

  useEffect(() => {
    setDisplaySeconds(remainingSeconds);
    
    if (isBlocked && remainingSeconds > 0) {
      const interval = setInterval(() => {
        setDisplaySeconds((prev) => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isBlocked, remainingSeconds]);

  if (isBlocked) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-start gap-3"
      >
        <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">
            Muitas tentativas em sequência
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Por segurança, aguarde{" "}
            <span className="font-semibold text-destructive">
              {Math.floor(displaySeconds / 60)}:
              {(displaySeconds % 60).toString().padStart(2, "0")}
            </span>{" "}
            antes de tentar novamente.
          </p>
        </div>
      </motion.div>
    );
  }

  if (remainingAttempts <= 1 && remainingAttempts > 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-secondary/10 border border-secondary/30 rounded-xl p-4 flex items-start gap-3"
      >
        <Clock className="w-5 h-5 text-secondary flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-secondary">
            Última tentativa disponível
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Você tem mais <span className="font-semibold">{remainingAttempts}</span> tentativa.
            Verifique os dados antes de enviar.
          </p>
        </div>
      </motion.div>
    );
  }

  return null;
}
