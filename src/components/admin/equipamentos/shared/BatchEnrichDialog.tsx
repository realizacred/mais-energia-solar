/**
 * Modal de enriquecimento em lote de equipamentos via IA.
 * Cria um JOB PERSISTENTE no banco; o processamento roda numa edge function em background
 * (auto-reagendada + cron de safety net). Funciona com a aba fechada / PC dormindo.
 * A UI apenas cria o job e faz polling do progresso.
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Wand2, Loader2, Minimize2, X, Brain, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
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

const TYPE_LABELS: Record<string, string> = {
  modulo: "módulos",
  inversor: "inversores",
  otimizador: "otimizadores",
  bateria: "baterias",
};

const QUERY_KEY_MAP: Record<string, string[]> = {
  modulo: ["modulos-solares"],
  inversor: ["inversores-catalogo"],
  otimizador: ["otimizadores-catalogo"],
  bateria: ["baterias"],
};

interface JobRow {
  id: string;
  status: "pending" | "running" | "completed" | "cancelled" | "failed";
  total: number;
  processed: number;
  success: number;
  failed: number;
  dual_count: number | null;
  last_model: string | null;
}

const MODEL_LABELS: Record<string, string> = {
  "google/gemini-2.5-flash": "Gemini 2.5 Flash",
  "google/gemini-2.5-pro": "Gemini 2.5 Pro",
  "openai/gpt-5-mini": "GPT-5 Mini",
  "openai/gpt-5": "GPT-5",
  "google/gemini-3-flash-preview": "Gemini 3 Flash",
};

function formatModelName(model?: string | null): string {
  if (!model) return "IA";
  return MODEL_LABELS[model] || model.split("/").pop() || "IA";
}

export function BatchEnrichDialog({ open, onOpenChange, equipmentType, draftIds }: BatchEnrichDialogProps) {
  const queryClient = useQueryClient();

  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<JobRow | null>(null);
  const [starting, setStarting] = useState(false);
  const toastIdRef = useRef<string | number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastInvalidatedRef = useRef(0);

  const isRunning = !!job && (job.status === "pending" || job.status === "running");
  const isFinished = !!job && (job.status === "completed" || job.status === "cancelled" || job.status === "failed");

  // Polling do job (a cada 2s) — sobrevive ao fechamento do modal pq jobId fica em memória do componente pai? não.
  // Estratégia: enquanto o componente estiver montado polling roda. Quando minimizado, o toast indica progresso via re-poll também.
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const tick = async () => {
      const { data, error } = await supabase
        .from("equipment_enrichment_jobs")
        .select("id,status,total,processed,success,failed,dual_count,last_model")
        .eq("id", jobId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      setJob(data as JobRow);

      // invalida queries periodicamente p/ refletir specs novas na tela
      const now = Date.now();
      if (now - lastInvalidatedRef.current > 5000) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEY_MAP[equipmentType] });
        lastInvalidatedRef.current = now;
      }

      // toast minimizado
      if (toastIdRef.current != null) {
        if (data.status === "completed") {
          toast.success(
            `✅ ${data.success} de ${data.total} ${TYPE_LABELS[equipmentType]} enriquecidos${data.failed > 0 ? ` (${data.failed} falharam)` : ""}`,
            { id: toastIdRef.current, duration: 6000 },
          );
          toastIdRef.current = null;
        } else if (data.status === "cancelled") {
          toast.warning(`⏹ Cancelado em ${data.processed} de ${data.total}`, {
            id: toastIdRef.current,
            duration: 6000,
          });
          toastIdRef.current = null;
        } else {
          toast.loading(`🔄 Buscando specs... ${data.processed} de ${data.total}`, {
            id: toastIdRef.current,
            dismissible: false,
          });
        }
      }

      if (data.status === "completed" || data.status === "cancelled" || data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        queryClient.invalidateQueries({ queryKey: QUERY_KEY_MAP[equipmentType] });
      }
    };
    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, equipmentType, queryClient]);

  const startJob = useCallback(async (limit?: number) => {
    setStarting(true);
    try {
      const ids = limit ? draftIds.slice(0, limit) : draftIds;
      const { tenantId } = await getCurrentTenantId();
      const { data: userResp } = await supabase.auth.getUser();
      const userId = userResp?.user?.id;
      if (!tenantId || !userId) {
        toast.error("Sessão inválida. Faça login novamente.");
        return;
      }

      // Cria job
      const { data: created, error } = await supabase
        .from("equipment_enrichment_jobs")
        .insert({
          tenant_id: tenantId,
          created_by: userId,
          equipment_type: equipmentType,
          equipment_ids: ids,
          total: ids.length,
          status: "pending",
        })
        .select("id,status,total,processed,success,failed,dual_count,last_model")
        .single();
      if (error || !created) {
        toast.error(`Erro ao criar job: ${error?.message ?? "desconhecido"}`);
        return;
      }
      setJobId(created.id);
      setJob(created as JobRow);

      // Dispara worker imediatamente (fire-and-forget)
      supabase.functions
        .invoke("equipment-enrichment-worker", { body: {} })
        .catch((e) => console.warn("[batch-enrich] worker kick failed:", e));

      toast.info("Enriquecimento iniciado em background. Pode fechar esta aba.", { duration: 4000 });
    } finally {
      setStarting(false);
    }
  }, [draftIds, equipmentType]);

  const cancelJob = useCallback(async () => {
    if (!jobId) return;
    await supabase
      .from("equipment_enrichment_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", jobId);
  }, [jobId]);

  const handleMinimize = () => {
    if (job) {
      toastIdRef.current = toast.loading(`🔄 Buscando specs... ${job.processed} de ${job.total}`, {
        duration: Infinity,
        dismissible: false,
      });
    }
    onOpenChange(false);
  };

  const handleClose = () => {
    if (isRunning) {
      handleMinimize();
      return;
    }
    setJob(null);
    setJobId(null);
    onOpenChange(false);
  };

  const pct = job && job.total > 0 ? (job.processed / job.total) * 100 : 0;

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
              Enriquecer {TYPE_LABELS[equipmentType]} via IA — roda em background
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {!job && (
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
                O processamento roda no servidor — você pode fechar esta aba ou desligar a tela. Pode reabrir o modal para ver o progresso.
              </p>
            </>
          )}

          {job && isRunning && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Processando {job.processed} de {job.total}...
              </p>
              <Progress value={pct} className="h-2" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span>
                  Usando <span className="font-medium text-foreground">Gemini 2.5 Flash</span> + fallback <span className="font-medium text-foreground">GPT-5 Mini</span>
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Roda em background no servidor — pode fechar a aba.
              </p>
            </div>
          )}

          {job && isFinished && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                {job.status === "completed" ? "Concluído!" : job.status === "cancelled" ? "Cancelado" : "Falhou"}
              </p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>✅ Enriquecidos: <span className="font-semibold text-foreground">{job.success}</span></p>
                {job.failed > 0 && (
                  <p>❌ Falharam: <span className="font-semibold text-destructive">{job.failed}</span></p>
                )}
                <p>Total processado: {job.processed}</p>
                {job.last_model && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span>
                      Modelo: <span className="font-medium text-foreground">{formatModelName(job.last_model)}</span>
                      {(job.dual_count || 0) > 0 && (
                        <span className="text-muted-foreground"> · {job.dual_count} usaram Dual IA</span>
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          {!job && (
            <>
              <Button variant="ghost" onClick={handleClose} disabled={starting}>
                Cancelar
              </Button>
              {draftIds.length > 10 && (
                <Button variant="outline" onClick={() => startJob(10)} disabled={starting}>
                  Buscar 10 agora
                </Button>
              )}
              <Button onClick={() => startJob()} disabled={draftIds.length === 0 || starting}>
                {starting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {draftIds.length > 10
                  ? `Buscar todos (${draftIds.length})`
                  : `Buscar ${draftIds.length}`}
              </Button>
            </>
          )}

          {job && isRunning && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={cancelJob}>
                <X className="w-4 h-4 mr-1" />
                Cancelar
              </Button>
              <Button variant="outline" onClick={handleMinimize}>
                <Minimize2 className="w-4 h-4 mr-1" />
                Minimizar
              </Button>
              <Button disabled>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Em background
              </Button>
            </div>
          )}

          {job && isFinished && (
            <Button onClick={handleClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
