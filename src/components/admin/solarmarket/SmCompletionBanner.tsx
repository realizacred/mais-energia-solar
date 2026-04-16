/**
 * SmCompletionBanner — Celebration banner when migration reaches 100%.
 */
import { motion } from "framer-motion";
import { CheckCircle, PartyPopper, ArrowRightLeft, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SmCompletionBannerProps {
  migrated: number;
  errors: number;
  total: number;
  visible: boolean;
  className?: string;
}

export function SmCompletionBanner({ migrated, errors, total, visible, className }: SmCompletionBannerProps) {
  if (!visible) return null;

  const hasErrors = errors > 0;
  const allSuccess = migrated >= total && !hasErrors;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.5, type: "spring", stiffness: 200 }}
      className={cn(
        "rounded-xl border-2 p-5 relative overflow-hidden",
        allSuccess
          ? "border-success/30 bg-gradient-to-br from-success/10 via-success/5 to-transparent"
          : "border-warning/30 bg-gradient-to-br from-warning/10 via-warning/5 to-transparent",
        className,
      )}
    >
      {/* Subtle confetti-like dots */}
      {allSuccess && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 12 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: [0, 1, 0], y: [0, 40 + Math.random() * 60] }}
              transition={{ delay: 0.3 + i * 0.08, duration: 1.5, ease: "easeOut" }}
              className="absolute w-1.5 h-1.5 rounded-full"
              style={{
                left: `${8 + i * 8}%`,
                top: `${10 + (i % 3) * 15}%`,
                backgroundColor: i % 3 === 0
                  ? "hsl(var(--success))"
                  : i % 3 === 1
                    ? "hsl(var(--primary))"
                    : "hsl(var(--warning))",
              }}
            />
          ))}
        </div>
      )}

      <div className="relative flex items-start gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
          allSuccess ? "bg-success/15" : "bg-warning/15",
        )}>
          {allSuccess
            ? <PartyPopper className="w-6 h-6 text-success" />
            : <AlertTriangle className="w-6 h-6 text-warning" />}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-foreground">
            {allSuccess ? "Migração Concluída!" : "Migração Parcial"}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allSuccess
              ? "Todos os dados foram convertidos com sucesso para o CRM."
              : `${migrated} propostas migradas com ${errors} erro(s).`}
          </p>

          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-semibold text-foreground">{migrated}</span>
              <span className="text-xs text-muted-foreground">migradas</span>
            </div>
            {errors > 0 && (
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">{errors}</span>
                <span className="text-xs text-muted-foreground">erros</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{total}</span>
              <span className="text-xs text-muted-foreground">total</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
