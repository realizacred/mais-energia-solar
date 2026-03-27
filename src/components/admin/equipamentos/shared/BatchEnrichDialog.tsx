/**
 * Modal de enriquecimento em lote de equipamentos via IA.
 * Suporta minimização — processamento continua em background com toast persistente.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Wand2, Loader2, Minimize2, X, Brain } from "lucide-react";
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
  equipmentType: "modulo" | "inversor" | "otimizador" | "bateria";
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
  lastModel?: string;
  dualCount?: number;
}

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "openai/gpt-5-mini": "GPT-5 Mini",
  "openai/gpt-5": "GPT-5",
  "google/gemini-3-flash-preview": "Gemini 3 Flash",
};

function formatModelName(model?: string): string {
  if (!model) return "IA";
  return MODEL_LABELS[model] || model.split("/").pop() || "IA";
}

export function BatchEnrichDialog({ open, onOpenChange, equipmentType, draftIds }: BatchEnrichDialogProps) {
  const queryClient = useQueryClient();

  // Refs survive modal close
  const processingRef = useRef(false);
  const progressRef = useRef<BatchProgress>({ processed: 0, total: 0, success: 0, failed: 0, dualCount: 0 });
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
    progressRef.current = { processed: 0, total: ids.length, success: 0, failed: 0, dualCount: 0 };
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

      let retries = 0;
      const MAX_RETRIES = 3;
      let success = false;

      while (retries <= MAX_RETRIES && !success && processingRef.current) {
        try {
          const { data, error } = await supabase.functions.invoke("enrich-equipment", {
            body: { equipment_type: equipmentType, equipment_id: ids[i], tenant_id: tenantId },
          });

          if (error) {
            // Check for rate limit (429) or server error (500) — retry
            const isRetryable = error.message?.includes("429") || error.message?.includes("500");
            if (isRetryable && retries < MAX_RETRIES) {
              retries++;
              const backoff = Math.min(2000 * Math.pow(2, retries), 30000);
              console.warn(`[batch-enrich] Retry ${retries}/${MAX_RETRIES} for ${ids[i]} in ${backoff}ms`);
              await new Promise((r) => setTimeout(r, backoff));
              continue;
            }
            progressRef.current.failed++;
          } else if (data?.error) {
            progressRef.current.failed++;
          } else {
            progressRef.current.success++;
            if (data?.winner_model) progressRef.current.lastModel = data.winner_model;
            if (data?.dual_ai_used) progressRef.current.dualCount = (progressRef.current.dualCount || 0) + 1;
          }
          success = true;
        } catch {
          if (retries < MAX_RETRIES) {
            retries++;
            const backoff = Math.min(2000 * Math.pow(2, retries), 30000);
            await new Promise((r) => setTimeout(r, backoff));
            continue;
          }
          progressRef.current.failed++;
          success = true; // exit retry loop
        }
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

      // Rate limiting: 2.5s between calls to avoid 429
      if (i < ids.length - 1 && processingRef.current) {
        await new Promise((r) => setTimeout(r, 2500));
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span>Dual IA: <span className="font-medium text-foreground">Gemini 2.5 Flash</span> + fallback <span className="font-medium text-foreground">GPT-5 Mini</span></span>
              </div>
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
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span>
                  Usando <span className="font-medium text-foreground">Gemini 2.5 Flash</span> + fallback <span className="font-medium text-foreground">GPT-5 Mini</span>
                </span>
              </div>
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
                {result.lastModel && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span>
                      Modelo: <span className="font-medium text-foreground">{formatModelName(result.lastModel)}</span>
                      {(result.dualCount || 0) > 0 && (
                        <span className="text-muted-foreground"> · {result.dualCount} usaram Dual IA</span>
                      )}
                    </span>
                  </div>
                )}
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
