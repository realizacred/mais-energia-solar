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

const FRIENDLY_NAMES: Record<string, string> = {
  "financeiro.preco_total": "Valor total da proposta",
  "financeiro.economia_mensal": "Economia mensal",
  "financeiro.economia_anual": "Economia anual",
  "financeiro.economia_25_anos": "Economia em 25 anos",
  "financeiro.payback_anos": "Tempo de retorno (payback)",
  "cliente.nome": "Nome do cliente",
  "cliente.cidade": "Cidade do cliente",
  "cliente.estado": "Estado do cliente",
  "tecnico.potencia_kwp": "Potência do sistema (kWp)",
  "sistema_solar.potencia_sistema": "Potência do sistema",
  "sistema_solar.geracao_mensal": "Geração mensal estimada",
  "conta_energia.co2_evitado_ano": "CO₂ evitado por ano",
};

const getFriendlyName = (key: string): string =>
  FRIENDLY_NAMES[key] ??
  key.replace(/[{}]/g, "").replace(/\./g, " → ");

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
                    Os seguintes dados não foram preenchidos no wizard.
                    Volte às etapas anteriores e complete as informações:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {missingVariables.map((v) => (
                      <Badge key={v} variant="destructive" className="text-xs">
                        {getFriendlyName(v)}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              {reason === "estimativa_not_accepted" && (
                <p className="text-sm">
                  Os valores desta proposta são estimados. Confirme que o cliente foi informado
                  marcando o checkbox de aceite na tela antes de gerar o PDF.
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
