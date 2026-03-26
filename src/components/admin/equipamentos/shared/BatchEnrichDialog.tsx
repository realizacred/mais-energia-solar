/**
 * Modal de enriquecimento em lote de equipamentos via IA.
 * Suporta minimização — processamento continua em background com toast persistente.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Wand2, Loader2, Minimize2, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useQueryClient } from "@tanstack/react-query";

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

const QUERY_KEY_MAP: Record<string, string[]> = {
  modulo: ["modulos-solares"],
  inversor: ["inversores-catalogo"],
  otimizador: ["otimizadores-catalogo"],
};

interface BatchProgress {
  processed: number;
  total: number;
  success: number;
  failed: number;
}

export function BatchEnrichDialog({ open, onOpenChange, equipmentType, draftIds }: BatchEnrichDialogProps) {
  const queryClient = useQueryClient();

  // Refs survive modal close
  const processingRef = useRef(false);
  const progressRef = useRef<BatchProgress>({ processed: 0, total: 0, success: 0, failed: 0 });
  const toastIdRef = useRef<string | number | null>(null);

  // Local state for modal UI only
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<BatchProgress>({ processed: 0, total: 0, success: 0, failed: 0 });
  const [result, setResult] = useState<BatchProgress | null>(null);

  // Sync ref → state while modal is open
  const syncInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (open && processingRef.current) {
      // Resuming view of an ongoing process
      setIsRunning(true);
      setResult(null);
      syncInterval.current = setInterval(() => {
        setProgress({ ...progressRef.current });
        if (!processingRef.current) {
          // Finished while modal was open
          setIsRunning(false);
          setResult({ ...progressRef.current });
          if (syncInterval.current) clearInterval(syncInterval.current);
        }
      }, 500);
    }
    return () => {
      if (syncInterval.current) clearInterval(syncInterval.current);
    };
  }, [open]);

  const runBatch = useCallback(async (ids: string[]) => {
    processingRef.current = true;
    progressRef.current = { processed: 0, total: ids.length, success: 0, failed: 0 };
    setIsRunning(true);
    setResult(null);
    setProgress({ ...progressRef.current });

    const { tenantId } = await getCurrentTenantId();

    // Start polling ref → state
    syncInterval.current = setInterval(() => {
      setProgress({ ...progressRef.current });
    }, 500);

    for (let i = 0; i < ids.length; i++) {
      if (!processingRef.current) break; // cancelled

      try {
        const { data, error } = await supabase.functions.invoke("enrich-equipment", {
          body: { equipment_type: equipmentType, equipment_id: ids[i], tenant_id: tenantId },
        });

        if (error || data?.error) {
          progressRef.current.failed++;
        } else {
          progressRef.current.success++;
        }
      } catch {
        progressRef.current.failed++;
      }

      progressRef.current.processed++;

      // Update persistent toast if minimized
      if (toastIdRef.current != null) {
        const p = progressRef.current;
        toast.loading(`🔄 Buscando specs... ${p.processed} de ${p.total}`, {
          id: toastIdRef.current,
          dismissible: false,
        });
      }

      // Rate limiting
      if (i < ids.length - 1 && processingRef.current) {
        await new Promise((r) => setTimeout(r, 1500));
      }
    }

    // Done
    const finalProgress = { ...progressRef.current };
    processingRef.current = false;

    if (syncInterval.current) clearInterval(syncInterval.current);
    setIsRunning(false);
    setProgress(finalProgress);
    setResult(finalProgress);

    // Invalidate queries
    queryClient.invalidateQueries({ queryKey: QUERY_KEY_MAP[equipmentType] });

    // Update toast to completion
    if (toastIdRef.current != null) {
      const p = finalProgress;
      if (p.processed === p.total) {
        toast.success(`✅ ${p.success} de ${p.total} ${TYPE_LABELS[equipmentType]} enriquecidos${p.failed > 0 ? ` (${p.failed} falharam)` : ""}`, {
          id: toastIdRef.current,
          duration: 6000,
        });
      } else {
        toast.warning(`⏹ Cancelado em ${p.processed} de ${p.total} (${p.success} enriquecidos)`, {
          id: toastIdRef.current,
          duration: 6000,
        });
      }
      toastIdRef.current = null;
    }
  }, [equipmentType, queryClient]);

  const handleEnrich = (limit?: number) => {
    const ids = limit ? draftIds.slice(0, limit) : draftIds;
    runBatch(ids);
  };

  const handleMinimize = () => {
    // Show persistent toast and close modal
    const p = progressRef.current;
    toastIdRef.current = toast.loading(`🔄 Buscando specs... ${p.processed} de ${p.total}`, {
      duration: Infinity,
      dismissible: false,
    });
    if (syncInterval.current) clearInterval(syncInterval.current);
    onOpenChange(false);
  };

  const handleCancel = () => {
    processingRef.current = false;
  };

  const handleClose = () => {
    if (isRunning) {
      // Minimize instead of blocking
      handleMinimize();
      return;
    }
    setResult(null);
    setProgress({ processed: 0, total: 0, success: 0, failed: 0 });
    onOpenChange(false);
  };

  const pct = progress.total > 0 ? (progress.processed / progress.total) * 100 : 0;

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
                Processando {progress.processed} de {progress.total}...
              </p>
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Você pode minimizar esta janela — o processamento continua em background.
              </p>
            </div>
          )}

          {result && !isRunning && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {result.processed === result.total ? "Concluído!" : "Cancelado"}
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
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleMinimize}>
                <Minimize2 className="w-4 h-4 mr-1" />
                Minimizar
              </Button>
              <Button disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processando...
              </Button>
            </div>
          )}

          {result && !isRunning && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
