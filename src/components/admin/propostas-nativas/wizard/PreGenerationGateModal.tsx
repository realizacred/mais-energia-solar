/**
 * Modal de gate pré-geração — exibe errors, warnings e infos antes de gerar proposta.
 * Errors bloqueiam, warnings exigem confirmação explícita.
 */

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, XCircle, Info, ShieldCheck, ShieldAlert } from "lucide-react";
import type { PropostaFinalValidationResult } from "./validatePropostaFinal";

interface PreGenerationGateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  validation: PropostaFinalValidationResult;
  onConfirmGenerate: () => void;
}

export function PreGenerationGateModal({
  open,
  onOpenChange,
  validation,
  onConfirmGenerate,
}: PreGenerationGateModalProps) {
  const [warningsAccepted, setWarningsAccepted] = useState(false);

  // Reset acceptance when modal opens with new validation
  useEffect(() => {
    if (open) setWarningsAccepted(false);
  }, [open]);

  const { errors, warnings, infos, canGenerate, needsConfirmation } = validation;

  const canProceed = canGenerate && (!needsConfirmation || warningsAccepted);

  const handleConfirm = () => {
    onOpenChange(false);
    onConfirmGenerate();
  };

  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;
  const hasInfos = infos.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
            hasErrors ? "bg-destructive/10" : hasWarnings ? "bg-warning/10" : "bg-success/10"
          }`}>
            {hasErrors ? (
              <ShieldAlert className="w-5 h-5 text-destructive" />
            ) : hasWarnings ? (
              <AlertTriangle className="w-5 h-5 text-warning" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-success" />
            )}
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {hasErrors
                ? "Geração Bloqueada"
                : hasWarnings
                  ? "Confirmação Necessária"
                  : "Pronto para Gerar"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {hasErrors
                ? "Corrija os erros abaixo antes de gerar a proposta."
                : hasWarnings
                  ? "Revise os alertas e confirme para prosseguir."
                  : "Todos os dados foram validados com sucesso."}
            </p>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4">
            {/* Errors */}
            {hasErrors && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-destructive uppercase tracking-wider flex items-center gap-1.5">
                  <XCircle className="h-3.5 w-3.5" />
                  Erros ({errors.length})
                </h4>
                <div className="space-y-1.5">
                  {errors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/5 border border-destructive/20"
                    >
                      <XCircle className="h-3.5 w-3.5 text-destructive mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground">{err}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {hasWarnings && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-warning uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Alertas ({warnings.length})
                </h4>
                <div className="space-y-1.5">
                  {warnings.map((warn, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-warning/5 border border-warning/20"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                      <p className="text-xs text-foreground">{warn}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Infos */}
            {hasInfos && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-info uppercase tracking-wider flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5" />
                  Informações ({infos.length})
                </h4>
                <div className="space-y-1.5">
                  {infos.map((info, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2 p-2.5 rounded-lg bg-info/5 border border-info/20"
                    >
                      <Info className="h-3.5 w-3.5 text-info mt-0.5 shrink-0" />
                      <p className="text-xs text-muted-foreground">{info}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warning acceptance checkbox */}
            {canGenerate && needsConfirmation && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 mt-3">
                <Checkbox
                  id="accept-warnings"
                  checked={warningsAccepted}
                  onCheckedChange={(v) => setWarningsAccepted(v === true)}
                  className="mt-0.5"
                />
                <Label
                  htmlFor="accept-warnings"
                  className="text-xs text-foreground cursor-pointer leading-relaxed"
                >
                  Revisado — entendo os alertas acima e desejo prosseguir com a geração da proposta.
                </Label>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            {hasErrors ? "Voltar e Corrigir" : "Cancelar"}
          </Button>
          {canGenerate && (
            <Button
              onClick={handleConfirm}
              disabled={!canProceed}
            >
              Confirmar e Gerar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
