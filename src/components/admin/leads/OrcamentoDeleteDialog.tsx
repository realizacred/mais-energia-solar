import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

import { Input } from "@/components/ui/input";
import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface OrcamentoDeleteDialogProps {
  orcamento: OrcamentoDisplayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo?: string) => void;
}

export function OrcamentoDeleteDialog({
  orcamento,
  open,
  onOpenChange,
  onConfirm,
}: OrcamentoDeleteDialogProps) {
  const [motivo, setMotivo] = useState("");
  
  if (!orcamento) return null;

  // Regra de bloqueio: orçamento já convertido em projeto/venda
  const isConverted = !!orcamento.projeto_id;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="w-[90vw] max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-9 h-9 rounded-lg ${isConverted ? 'bg-destructive/10' : 'bg-primary/10'} flex items-center justify-center shrink-0`}>
              {isConverted ? (
                <AlertCircle className="w-5 h-5 text-destructive" />
              ) : (
                <Archive className="w-5 h-5 text-primary" />
              )}
            </div>
            <AlertDialogTitle>
              {isConverted ? "Arquivamento Bloqueado" : `Arquivar ${orcamento.orc_code || 'Orçamento'}`}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="space-y-4">
            {isConverted ? (
              <div className="p-3 rounded-md bg-destructive/5 border border-destructive/20 text-destructive text-sm">
                Este orçamento já foi <strong>convertido em projeto</strong> e não pode ser arquivado individualmente. 
                Para remover, gerencie o projeto vinculado.
              </div>
            ) : (
              <>
                <p>
                  Deseja arquivar o orçamento <strong>{orcamento.orc_code}</strong> de {orcamento.nome}?
                </p>
                <p className="text-sm">
                  Ele será removido da listagem principal, mas o histórico será preservado para auditoria.
                </p>
                <div className="space-y-1.5 pt-2">
                  <Label className="text-xs">Motivo (opcional)</Label>
                  <Input 
                    placeholder="Ex: Dados incorretos, duplicidade..." 
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-4">
          <AlertDialogCancel onClick={() => setMotivo("")}>
            {isConverted ? "Fechar" : "Cancelar"}
          </AlertDialogCancel>
          {!isConverted && (
            <AlertDialogAction
              onClick={() => {
                onConfirm(motivo);
                setMotivo("");
              }}
              className="border-primary text-primary hover:bg-primary/10 border bg-transparent"
            >
              Arquivar Orçamento
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

