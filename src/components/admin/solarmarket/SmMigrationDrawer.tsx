import { useState, useCallback } from "react";
import { useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, CheckCircle, XCircle, Loader2, Clock, ArrowRight, AlertTriangle, FileText, User, Briefcase, FolderKanban, Copy } from "lucide-react";
import type { SmProposal } from "@/hooks/useSolarMarket";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";

// ─── Constants ──────────────────────────────────────────

const SM_STATUS_LABEL_MAP: Record<string, { proposal_status: string; label: string }> = {
  approved: { proposal_status: "aceita", label: "Ganho" },
  sent: { proposal_status: "enviada", label: "Proposta Enviada" },
  viewed: { proposal_status: "enviada", label: "Proposta Enviada" },
  generated: { proposal_status: "rascunho", label: "Negociação" },
  draft: { proposal_status: "rascunho", label: "Qualificação" },
  rejected: { proposal_status: "rejeitada", label: "Perdido" },
};

// ─── Types ──────────────────────────────────────────────

type StepName = "fetch" | "cliente" | "deal" | "projeto" | "proposta" | "versao" | "done";
type StepState = "pending" | "running" | "done" | "error" | "skipped";

interface MigrationStep {
  name: StepName;
  label: string;
  icon: React.ElementType;
  state: StepState;
  detail?: string;
  createdId?: string;
}

const INITIAL_STEPS: MigrationStep[] = [
  { name: "fetch", label: "Buscar proposta SM", icon: FileText, state: "pending" },
  { name: "cliente", label: "Resolver/Criar cliente", icon: User, state: "pending" },
  { name: "deal", label: "Criar/Vincular deal", icon: Briefcase, state: "pending" },
  { name: "projeto", label: "Criar/Vincular projeto", icon: FolderKanban, state: "pending" },
  { name: "proposta", label: "Criar proposta nativa", icon: FileText, state: "pending" },
  { name: "versao", label: "Criar versão", icon: Copy, state: "pending" },
  { name: "done", label: "Concluído", icon: CheckCircle, state: "pending" },
];

interface MigrationResult {
  mode: string;
  summary: Record<string, number>;
  details: Array<{
    sm_proposal_id: number;
    sm_client_name: string | null;
    aborted: boolean;
    steps: Record<string, { status: string; id?: string; reason?: string }>;
  }>;
  total_found: number;
  total_processed: number;
}

// ─── Hook: fetch consultores for owner dropdown ─────────

function useConsultores() {
  return useQuery<{ id: string; nome: string }[]>({
    queryKey: ["consultores-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    staleTime: 60_000,
  });
}

// ─── Hook: fetch available pipelines ───────────────────

function usePipelines() {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ["pipelines-for-migration"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook: fetch stages for a pipeline ─────────────────

function usePipelineStages(pipelineId: string | null) {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ["pipeline-stages-migration", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name")
        .eq("pipeline_id", pipelineId!)
        .order("position", { ascending: true });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook: check if already migrated ───────────────────

function useCanonicalCheck(smProposalId: number | null) {
  return useQuery({
    queryKey: ["canonical-check", smProposalId],
    enabled: !!smProposalId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("propostas_nativas")
        .select("id, titulo, status, created_at")
        .eq("sm_id", String(smProposalId))
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });
}

// ─── Hook: resolve real client name via project → client ──

function useSmRealClientName(smProjectId: number | null) {
  return useQuery<string | null>({
    queryKey: ["sm-real-client-name", smProjectId],
    enabled: !!smProjectId,
    queryFn: async () => {
      // First get sm_client_id from project
      const { data: proj } = await (supabase as any)
        .from("solar_market_projects")
        .select("sm_client_id, name")
        .eq("sm_project_id", smProjectId)
        .limit(1);
      if (!proj?.[0]) return null;
      const smClientId = proj[0].sm_client_id;
      if (!smClientId || smClientId < 0) return proj[0].name || null;
      // Then get client name
      const { data: client } = await (supabase as any)
        .from("solar_market_clients")
        .select("name")
        .eq("sm_client_id", smClientId)
        .limit(1);
      return client?.[0]?.name || proj[0].name || null;
    },
    staleTime: 60_000,
  });
}

// ─── Hook: fetch all funnels from SM project ───────────

interface SmFunnel {
  funnelId: number | null;
  funnelName: string;
  stageId: number | null;
  stageName: string;
}

function useSmProjectFunnels(smProjectId: number | null) {
  return useQuery<SmFunnel[]>({
    queryKey: ["sm-project-funnels", smProjectId],
    enabled: !!smProjectId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("solar_market_projects")
        .select("all_funnels")
        .eq("sm_project_id", smProjectId)
        .limit(1);
      const funnels = data?.[0]?.all_funnels;
      return Array.isArray(funnels) ? funnels : [];
    },
    staleTime: 60_000,
  });
}

// ─── Drawer Component ───────────────────────────────────

interface SmMigrationDrawerProps {
  proposals: SmProposal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmMigrationDrawer({ proposals, open, onOpenChange }: SmMigrationDrawerProps) {
  const [ownerId, setOwnerId] = useState<string>(""); // always used as fallback
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [steps, setSteps] = useState<MigrationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const cancelRef = useRef(false);

  const { data: consultores = [] } = useConsultores();
  const { data: pipelines = [] } = usePipelines();
  const { data: pipelineStages = [] } = usePipelineStages(selectedPipelineId || null);
  const qc = useQueryClient();

  const proposal = proposals[0]; // Single or first for display
  const isBulk = proposals.length > 1;
  const internalIds = proposals.map(p => p.id); // Use UUID primary keys for unique identification

  const { data: existingCanonical } = useCanonicalCheck(proposal?.sm_proposal_id ?? null);
  const { data: projectFunnels = [] } = useSmProjectFunnels(proposal?.sm_project_id ?? null);
  const { data: realClientName } = useSmRealClientName(proposal?.sm_project_id ?? null);

  const statusLabel = proposal ? (SM_STATUS_LABEL_MAP[proposal.status?.toLowerCase() ?? ""] ?? { proposal_status: "rascunho", label: "Qualificação" }) : { proposal_status: "rascunho", label: "Qualificação" };

  // Auto-select first pipeline when loaded
  const activePipelineId = selectedPipelineId || pipelines[0]?.id || "";
  // Auto-select first stage when loaded
  const activeStageId = selectedStageId || pipelineStages[0]?.id || "";

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${formatTime(new Date())}] ${msg}`]);
  }, []);

  const resetState = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setResult(null);
    setError(null);
    setLogs([]);
    setConfirmText("");
  }, []);

  const updateStep = useCallback((name: StepName, update: Partial<MigrationStep>) => {
    setSteps(prev => prev.map(s => s.name === name ? { ...s, ...update } : s));
  }, []);

  const runMigration = useCallback(async (dryRun: boolean) => {
    if (!activePipelineId) {
      setError("Nenhum pipeline encontrado. Crie um pipeline comercial antes de migrar.");
      return;
    }
    // owner_id is now optional — auto-resolved from SM funnel "Vendedores"
    resetState();
    setRunning(true);
    cancelRef.current = false;
    setBatchProgress(null);
    addLog(`Iniciando ${dryRun ? "simulação (dry-run)" : "migração real"} para ${internalIds.length} proposta(s)`);
    addLog(ownerId ? `Responsável manual: ${consultores.find(c => c.id === ownerId)?.nome || ownerId}` : "Responsável será auto-resolvido pelo funil Vendedores");

    // Step: Fetch
    updateStep("fetch", { state: "running" });
    addLog("Buscando sessão do usuário...");

    try {
      updateStep("fetch", { state: "done", detail: `${internalIds.length} proposta(s) selecionada(s)` });
      addLog(`Invocando edge function...`);

      // Mark fetch step as running for UI
      if (!dryRun) {
        updateStep("cliente", { state: "running" });
      }

      const basePayload: Record<string, any> = {
        dry_run: dryRun,
        pipeline_id: activePipelineId,
        stage_id: activeStageId || null,
        auto_resolve_owner: true,
        include_projects_without_proposal: true,
      };
      // Always send owner_id as fallback for proposals without Vendedores funnel
      if (ownerId && ownerId !== "__auto__") {
        basePayload.owner_id = ownerId;
      }

      // ── Batch processing: split into batches of 10 ──
      const BATCH_SIZE = 10;
      const batches: string[][] = [];
      for (let i = 0; i < internalIds.length; i += BATCH_SIZE) {
        batches.push(internalIds.slice(i, i + BATCH_SIZE));
      }

      const allResults: MigrationResult[] = [];
      setBatchProgress({ current: 0, total: batches.length });

      const batchErrors: string[] = [];

      for (let b = 0; b < batches.length; b++) {
        if (cancelRef.current) break;

        const batch = batches[b];
        setBatchProgress({ current: b + 1, total: batches.length });
        addLog(`Lote ${b + 1}/${batches.length} (${batch.length} propostas)...`);

        const payload = {
          ...basePayload,
          filters: { internal_ids: batch },
          batch_size: batch.length,
        };

        try {
          // Use direct fetch with 120s timeout to avoid "Failed to fetch" on long migrations
          const projectUrl = import.meta.env.VITE_SUPABASE_URL;
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 120_000);

          let response: Response;
          try {
            response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${session.access_token}`,
                apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(payload),
              signal: controller.signal,
            });
          } finally {
            clearTimeout(timeoutId);
          }

          if (!response.ok) {
            const errBody = await response.json().catch(() => ({}));
            throw new Error(errBody?.error || errBody?.message || `HTTP ${response.status}`);
          }

          const data = await response.json() as MigrationResult;

          if ((data as any)?.error) {
            throw new Error((data as any).error);
          }

          allResults.push(data);
          addLog(`Lote ${b + 1} OK: ${JSON.stringify(data.summary)}`);

          // Update steps progressively from this batch's first detail
          if (!dryRun && data.details?.[0]) {
            const detail = data.details[0];
            const stepMap: Record<string, StepName> = {
              cliente: "cliente", deal: "deal", projeto: "projeto",
              proposta_nativa: "proposta", proposta_versao: "versao",
            };
            for (const [key, stepName] of Object.entries(stepMap)) {
              const serverStep = (detail.steps as Record<string, any>)[key];
              if (serverStep) {
                const isOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(serverStep.status);
                updateStep(stepName, {
                  state: isOk ? "done" : "error",
                  detail: `${serverStep.status}${serverStep.id ? ` → ${serverStep.id.slice(0, 8)}...` : ""}${serverStep.reason ? ` (${serverStep.reason})` : ""}`,
                  createdId: serverStep.id,
                });
              }
            }
          }
        } catch (batchErr: any) {
          const msg = batchErr?.name === "AbortError"
            ? "Timeout: migração demorou mais de 120s. Tente com menos propostas."
            : batchErr?.message ?? "Erro desconhecido no lote";
          batchErrors.push(msg);
          addLog(`ERRO lote ${b + 1}: ${msg}`);
          // Mark all pending steps as error on failure
          if (!dryRun) {
            for (const s of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
              setSteps(prev => prev.map(st => st.name === s && st.state === "running" ? { ...st, state: "error", detail: msg } : st));
            }
          }
          // Continue with remaining batches
        }

        // Small pause between batches to avoid rate limiting
        if (b < batches.length - 1) {
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // All batches done
      if (allResults.length === 0) {
        throw new Error(batchErrors[0] || "Nenhum lote retornou resultado de migração.");
      }

      // Merge results from all batches
      const mergedResult: MigrationResult = {
        mode: dryRun ? "dry_run" : "execute",
        summary: { WOULD_CREATE: 0, WOULD_LINK: 0, WOULD_SKIP: 0, CONFLICT: 0, ERROR: 0, SUCCESS: 0 },
        details: [],
        total_found: 0,
        total_processed: 0,
      };

      for (const r of allResults) {
        mergedResult.total_found += r.total_found || 0;
        mergedResult.total_processed += r.total_processed || 0;
        if (r.details) mergedResult.details.push(...r.details);
        for (const [k, v] of Object.entries(r.summary || {})) {
          mergedResult.summary[k] = (mergedResult.summary[k] || 0) + (v as number);
        }
      }

      const hasBatchErrors = batchErrors.length > 0;
      setResult(mergedResult);
      addLog(`Resultado final: ${JSON.stringify(mergedResult.summary)}`);
      if (hasBatchErrors) {
        addLog(`Migração parcial: ${batchErrors.length} lote(s) falharam.`);
      }

      // Map server steps to UI steps
      const detail = mergedResult.details?.[0];
      if (detail) {
        const stepMap: Record<string, StepName> = {
          cliente: "cliente",
          deal: "deal",
          projeto: "projeto",
          proposta_nativa: "proposta",
          proposta_versao: "versao",
        };

        for (const [key, stepName] of Object.entries(stepMap)) {
          const serverStep = detail.steps[key];
          if (serverStep) {
            const isOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(serverStep.status);
            updateStep(stepName, {
              state: isOk ? "done" : "error",
              detail: `${serverStep.status}${serverStep.id ? ` → ${serverStep.id.slice(0, 8)}...` : ""}${serverStep.reason ? ` (${serverStep.reason})` : ""}`,
              createdId: serverStep.id,
            });
          }
        }
      } else if (isBulk) {
        // Bulk: mark all steps based on summary
        const hasErrors = hasBatchErrors || (mergedResult.summary.ERROR || 0) > 0;
        for (const s of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
          updateStep(s, { state: hasErrors ? "error" : "done" });
        }
      }

      updateStep("done", {
        state: hasBatchErrors || (mergedResult.summary.ERROR || 0) > 0 ? "error" : "done",
        detail: hasBatchErrors
          ? `Migração parcial com falha em ${batchErrors.length} lote(s)`
          : dryRun
            ? "Simulação concluída"
            : "Migração concluída",
      });

      if (!dryRun) {
        qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["canonical-check"] });
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erro desconhecido";
      setError(msg);
      addLog(`ERRO: ${msg}`);
      updateStep("done", { state: "error", detail: msg });
    } finally {
      setRunning(false);
    }
  }, [ownerId, internalIds, activePipelineId, activeStageId, addLog, resetState, updateStep, isBulk, qc, consultores, cancelRef]);

  const handleExecuteConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
    runMigration(false);
  };

  // Progress calculation
  const completedSteps = steps.filter(s => s.state === "done" || s.state === "error" || s.state === "skipped").length;
  const batchPercent = batchProgress ? Math.round((batchProgress.current / batchProgress.total) * 100) : 0;
  const progressPercent = running ? Math.max(batchPercent, Math.round((completedSteps / steps.length) * 100)) : (result ? 100 : 0);

  if (!proposal) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => { if (!running) { onOpenChange(v); if (!v) resetState(); } }}>
        <DrawerContent className="max-h-[calc(100dvh-2rem)]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-primary" />
              {isBulk ? `Migrar ${proposals.length} propostas` : "Migrar Proposta"}
            </DrawerTitle>
            <DrawerDescription>
              {isBulk
                ? `Migração em lote de ${proposals.length} propostas SolarMarket para o sistema canônico.`
                : `SM #${proposal.sm_proposal_id} — ${realClientName || proposal.titulo || "Sem título"}`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Proposal Summary */}
            {!isBulk && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Cliente</span>
                    <p className="font-medium truncate">{realClientName || proposal.titulo || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Status SM</span>
                    <p><Badge variant="outline" className="text-[10px]">{proposal.status || "—"}</Badge></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Potência</span>
                    <p className="font-medium">{proposal.potencia_kwp ? `${proposal.potencia_kwp} kWp` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Valor</span>
                    <p className="font-medium">{proposal.valor_total ? `R$ ${Number(proposal.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">PDF</span>
                    <p className="truncate">{proposal.link_pdf ? <a href={proposal.link_pdf} target="_blank" rel="noopener" className="text-primary underline text-xs">Ver PDF</a> : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Etapa mapeada</span>
                    <p><Badge className="text-[10px] bg-primary/10 text-primary border-0">{statusLabel.label}</Badge></p>
                  </div>
                </div>

                {/* All SM funnels for this project */}
                {projectFunnels.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Funis SM do projeto ({projectFunnels.length})</span>
                    <div className="flex flex-wrap gap-1">
                      {projectFunnels.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {f.funnelName}: <span className="font-semibold ml-0.5">{f.stageName || "—"}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Already migrated warning */}
            {existingCanonical && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <div>
                  <p className="font-medium text-warning">Já migrada</p>
                  <p className="text-xs text-muted-foreground">
                    Proposta canônica: {existingCanonical.id?.slice(0, 8)}... — Status: {existingCanonical.status} — {formatDate(existingCanonical.created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Owner selector — optional fallback, auto-resolved from project responsible */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Responsável (fallback opcional)
              </label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Automático (campo responsible do projeto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">🔄 Automático (responsible do projeto SM)</SelectItem>
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                O consultor é resolvido automaticamente: 1º busca na API SM o funil "Vendedores" (nome da etapa = nome do consultor),
                2º usa o campo "responsible" do projeto SM. Consultores inexistentes serão criados sem acesso ao sistema.
              </p>
            </div>

            {/* Pipeline selector (dynamic) */}
            {pipelines.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-warning font-medium">Nenhum pipeline encontrado. Crie um pipeline comercial antes de migrar.</p>
              </div>
            )}
            {pipelines.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pipeline de destino</label>
                <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stage selector (dynamic from selected pipeline) */}
            {pipelineStages.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Etapa padrão</label>
                <Select value={activeStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Primeira etapa (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Status SM "{statusLabel.label}" → Etapa: {pipelineStages.find(s => s.id === activeStageId)?.name || "primeira disponível"}
                </p>
              </div>
            )}

            {/* Progress */}
            {(running || result) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {running
                      ? batchProgress
                        ? `Processando lote ${batchProgress.current}/${batchProgress.total}...`
                        : "Processando..."
                      : result ? "Resultado" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground font-mono">{progressPercent}%</span>
                </div>
                <Progress value={progressPercent} className="h-2" />

                {/* Step list */}
                <div className="space-y-1">
                  {steps.map(step => (
                    <div key={step.name} className={cn(
                      "flex items-center gap-2 p-2 rounded text-sm transition-colors",
                      step.state === "running" && "bg-primary/5 border border-primary/20",
                      step.state === "done" && "bg-success/5",
                      step.state === "error" && "bg-destructive/5",
                    )}>
                      {step.state === "running" && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
                      {step.state === "done" && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                      {step.state === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      {step.state === "pending" && <Clock className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                      {step.state === "skipped" && <Clock className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{step.label}</p>
                        {step.detail && <p className="text-[10px] text-muted-foreground truncate">{step.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result summary (bulk) */}
            {result && isBulk && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Resumo ({result.total_processed} processadas)</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(result.summary).filter(([, v]) => v > 0).map(([key, count]) => (
                    <Badge key={key} variant="outline" className="text-[10px]">{key}: {count}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Result details */}
            {result?.details && result.details.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Detalhes</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.details.map((d, i) => (
                    <div key={i} className="text-[11px] p-2 rounded bg-muted/30 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {d.aborted ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle className="h-3 w-3 text-success" />}
                        <span className="font-medium">SM #{d.sm_proposal_id}</span>
                        <span className="text-muted-foreground">{d.sm_client_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {Object.entries(d.steps).map(([k, v]) => (
                          <Badge key={k} variant="outline" className={cn(
                            "text-[9px]",
                            v.status.includes("ERROR") && "border-destructive/50 text-destructive",
                            v.status.includes("CREATE") && "border-success/50 text-success",
                            v.status.includes("LINK") && "border-info/50 text-info",
                            v.status.includes("SKIP") && "border-muted-foreground/50 text-muted-foreground",
                          )}>
                            {k}: {v.status}{v.id ? ` → ${v.id.slice(0, 8)}` : ""}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Client-side logs */}
            {logs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Logs ({logs.length})
                </summary>
                <pre className="mt-1 p-2 rounded bg-muted/30 max-h-32 overflow-auto whitespace-pre-wrap text-[10px]">
                  {logs.join("\n")}
                </pre>
              </details>
            )}
          </div>

          <DrawerFooter className="flex-row gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => runMigration(true)}
              disabled={running}
            >
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Simular (Dry-run)
            </Button>
            <Button
              className="flex-1"
              onClick={() => setConfirmOpen(true)}
              disabled={running || !!existingCanonical}
            >
              Migrar agora
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Hard confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Migração
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Isto vai criar registros no sistema canônico (clientes, deals, projetos, propostas).
              {isBulk ? ` ${proposals.length} propostas serão processadas.` : ""}
            </p>
            <p className="text-sm">
              Digite <span className="font-bold text-destructive">MIGRAR</span> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="MIGRAR"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="default"
              disabled={confirmText !== "MIGRAR"}
              onClick={handleExecuteConfirm}
            >
              Confirmar Migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
