/**
 * Modal de enriquecimento em lote de equipamentos via IA.
 */
import { useState } from "react";
import { Wand2, Loader2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useEnrichEquipmentBatch } from "@/hooks/useEnrichEquipment";

interface BatchEnrichDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  equipmentType: "modulo" | "inversor" | "otimizador";
  /** IDs dos equipamentos em rascunho sem specs */
  draftIds: string[];
}

const TYPE_LABELS = {
  modulo: "módulos",
  inversor: "inversores",
  otimizador: "otimizadores",
};

export function BatchEnrichDialog({ open, onOpenChange, equipmentType, draftIds }: BatchEnrichDialogProps) {
  const batchMutation = useEnrichEquipmentBatch();
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  const isRunning = batchMutation.isPending;
  const result = batchMutation.data;

  const handleEnrich = (limit?: number) => {
    const ids = limit ? draftIds.slice(0, limit) : draftIds;
    setTotal(ids.length);
    setProgress(0);

    batchMutation.mutate({
      equipment_type: equipmentType,
      ids,
      onProgress: (processed, tot) => {
        setProgress(processed);
        setTotal(tot);
      },
    });
  };

  const handleClose = () => {
    if (!isRunning) {
      batchMutation.reset();
      setProgress(0);
      setTotal(0);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Wand2 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Buscar specs em lote
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Enriquecer {TYPE_LABELS[equipmentType]} via IA
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {!isRunning && !result && (
            <>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{draftIds.length}</span>{" "}
                {TYPE_LABELS[equipmentType]} em rascunho sem especificações técnicas.
              </p>
              <p className="text-xs text-muted-foreground">
                A IA buscará as specs de cada equipamento na internet. Isso pode levar alguns minutos.
              </p>
            </>
          )}

          {isRunning && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Processando {progress} de {total}...
              </p>
              <Progress value={total > 0 ? (progress / total) * 100 : 0} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Não feche esta janela durante o processamento.
              </p>
            </div>
          )}

          {result && !isRunning && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Concluído!
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✅ Enriquecidos: <span className="font-semibold text-foreground">{result.success}</span></p>
                {result.failed > 0 && (
                  <p>❌ Falharam: <span className="font-semibold text-destructive">{result.failed}</span></p>
                )}
                <p>Total processado: {result.processed}</p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {!isRunning && !result && (
            <>
              <Button variant="ghost" onClick={handleClose}>
                Cancelar
              </Button>
              {draftIds.length > 10 && (
                <Button variant="outline" onClick={() => handleEnrich(10)}>
                  Buscar 10 agora
                </Button>
              )}
              <Button onClick={() => handleEnrich()} disabled={draftIds.length === 0}>
                {draftIds.length > 10
                  ? `Buscar todos (${draftIds.length})`
                  : `Buscar ${draftIds.length}`
                }
              </Button>
            </>
          )}

          {isRunning && (
            <Button disabled>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processando...
            </Button>
          )}

          {result && !isRunning && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
