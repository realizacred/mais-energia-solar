/**
 * Modal que exibe variáveis obrigatórias ausentes, bloqueando a geração de PDF.
 */

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MissingVariablesModalProps {
  open: boolean;
  onClose: () => void;
  missingVariables: string[];
  reason: "missing_required" | "estimativa_not_accepted";
}

export function MissingVariablesModal({
  open,
  onClose,
  missingVariables,
  reason,
}: MissingVariablesModalProps) {
  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Geração de PDF Bloqueada
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {reason === "missing_required" && (
                <>
                  <p className="text-sm">
                    As seguintes variáveis obrigatórias não puderam ser resolvidas.
                    Preencha os dados necessários antes de gerar a proposta.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingVariables.map((v) => (
                      <Badge key={v} variant="destructive" className="font-mono text-xs">
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              {reason === "estimativa_not_accepted" && (
                <p className="text-sm">
                  É necessário confirmar que entende que os valores são estimados
                  antes de gerar a proposta. Marque o checkbox de aceite na tela.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClose}>Entendi</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
