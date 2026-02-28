import { useState, useCallback } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sun, CheckCircle, XCircle, Loader2, Clock, ArrowRight, AlertTriangle, FileText, User, Briefcase, FolderKanban, Copy } from "lucide-react";
import type { SmProposal } from "@/hooks/useSolarMarket";
import { cn } from "@/lib/utils";

// ─── Constants ──────────────────────────────────────────

const PIPELINE_ID = "9b5cbcf3-a101-4950-b699-778e2e1219e6";

const STAGE_MAP: Record<string, { stage_id: string; proposal_status: string; label: string }> = {
  approved: { stage_id: "bdad6238-90e1-4e12-b897-53ff61ece1b6", proposal_status: "aceita", label: "Ganho" },
  sent: { stage_id: "ac9ab64f-b617-48fd-8282-a33482feb30d", proposal_status: "enviada", label: "Proposta Enviada" },
  viewed: { stage_id: "ac9ab64f-b617-48fd-8282-a33482feb30d", proposal_status: "enviada", label: "Proposta Enviada" },
};
const DEFAULT_STAGE = { stage_id: "686ea5dd-d0bb-4038-826b-7c7ac74455fb", proposal_status: "rascunho", label: "Prospecção" };

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

// ─── Drawer Component ───────────────────────────────────

interface SmMigrationDrawerProps {
  proposals: SmProposal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmMigrationDrawer({ proposals, open, onOpenChange }: SmMigrationDrawerProps) {
  const [ownerId, setOwnerId] = useState<string>(""); // always used as fallback
  const [steps, setSteps] = useState<MigrationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);

  const { data: consultores = [] } = useConsultores();
  const qc = useQueryClient();

  const proposal = proposals[0]; // Single or first for display
  const isBulk = proposals.length > 1;
  const smIds = proposals.map(p => p.sm_proposal_id);

  const { data: existingCanonical } = useCanonicalCheck(proposal?.sm_proposal_id ?? null);

  const stageInfo = proposal ? (STAGE_MAP[proposal.status?.toLowerCase() ?? ""] ?? DEFAULT_STAGE) : DEFAULT_STAGE;

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString("pt-BR")}] ${msg}`]);
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
    // owner_id is now optional — auto-resolved from SM funnel "Vendedores"
    resetState();
    setRunning(true);
    addLog(`Iniciando ${dryRun ? "simulação (dry-run)" : "migração real"} para ${smIds.length} proposta(s)`);
    addLog(ownerId ? `Responsável manual: ${consultores.find(c => c.id === ownerId)?.nome || ownerId}` : "Responsável será auto-resolvido pelo funil Vendedores");

    // Step: Fetch
    updateStep("fetch", { state: "running" });
    addLog("Buscando sessão do usuário...");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        updateStep("fetch", { state: "error", detail: "Sessão expirada" });
        setError("Você precisa estar logado. Faça login novamente.");
        setRunning(false);
        return;
      }

      updateStep("fetch", { state: "done", detail: `${smIds.length} proposta(s) selecionada(s)` });
      addLog(`Token obtido. Invocando edge function...`);

      // Animate intermediate steps
      if (!dryRun) {
        updateStep("cliente", { state: "running" });
      }

      const payload: Record<string, any> = {
        dry_run: dryRun,
        pipeline_id: PIPELINE_ID,
        stage_id: stageInfo.stage_id,
        auto_resolve_owner: true,
        filters: { sm_proposal_ids: smIds },
        batch_size: smIds.length,
      };
      // Always send owner_id as fallback for proposals without Vendedores funnel
      if (ownerId && ownerId !== "__auto__") {
        payload.owner_id = ownerId;
      }

      const { data, error: fnError } = await supabase.functions.invoke("migrate-sm-proposals", {
        body: payload,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (fnError) {
        let errMsg = fnError.message || "Erro desconhecido";
        try {
          const ctx = (fnError as any).context;
          if (ctx && typeof ctx.json === "function") {
            const body = await ctx.clone().json();
            errMsg = body?.error || errMsg;
          }
        } catch { /* ignore */ }
        throw new Error(errMsg);
      }

      const migResult = data as MigrationResult;
      setResult(migResult);
      addLog(`Resultado: ${JSON.stringify(migResult.summary)}`);

      // Map server steps to UI steps
      const detail = migResult.details?.[0];
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
        const hasErrors = (migResult.summary.ERROR || 0) > 0;
        for (const s of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
          updateStep(s, { state: hasErrors ? "error" : "done" });
        }
      }

      updateStep("done", {
        state: (migResult.summary.ERROR || 0) > 0 ? "error" : "done",
        detail: dryRun ? "Simulação concluída" : "Migração concluída",
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
  }, [ownerId, smIds, stageInfo, addLog, resetState, updateStep, isBulk, qc]);

  const handleExecuteConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
    runMigration(false);
  };

  // Progress calculation
  const completedSteps = steps.filter(s => s.state === "done" || s.state === "error" || s.state === "skipped").length;
  const progressPercent = running ? Math.round((completedSteps / steps.length) * 100) : (result ? 100 : 0);

  if (!proposal) return null;

  return (
    <>
      <Drawer open={open} onOpenChange={(v) => { if (!running) { onOpenChange(v); if (!v) resetState(); } }}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-primary" />
              {isBulk ? `Migrar ${proposals.length} propostas` : "Migrar Proposta"}
            </DrawerTitle>
            <DrawerDescription>
              {isBulk
                ? `Migração em lote de ${proposals.length} propostas SolarMarket para o sistema canônico.`
                : `SM #${proposal.sm_proposal_id} — ${proposal.titulo || "Sem título"}`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Proposal Summary */}
            {!isBulk && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground text-xs">Cliente</span>
                  <p className="font-medium truncate">{proposal.titulo || "—"}</p>
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
                  <p><Badge className="text-[10px] bg-primary/10 text-primary border-0">{stageInfo.label}</Badge></p>
                </div>
              </div>
            )}

            {/* Already migrated warning */}
            {existingCanonical && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <div>
                  <p className="font-medium text-warning">Já migrada</p>
                  <p className="text-xs text-muted-foreground">
                    Proposta canônica: {existingCanonical.id?.slice(0, 8)}... — Status: {existingCanonical.status} — {new Date(existingCanonical.created_at).toLocaleDateString("pt-BR")}
                  </p>
                </div>
              </div>
            )}

            {/* Owner selector — required as fallback for proposals without Vendedores funnel */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Responsável <span className="text-destructive">*</span>
              </label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione o consultor responsável" />
                </SelectTrigger>
                <SelectContent>
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                Se o projeto SM estiver no funil "Vendedores", o vendedor será auto-resolvido pelo nome da etapa.
                Caso contrário, o consultor selecionado acima será usado.
              </p>
            </div>

            {/* Pipeline info (fixed) */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded">
              <Briefcase className="h-3.5 w-3.5" />
              Pipeline: <span className="font-medium text-foreground">Comercial</span>
              <ArrowRight className="h-3 w-3" />
              Etapa: <span className="font-medium text-foreground">{stageInfo.label}</span>
            </div>

            {/* Progress */}
            {(running || result) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {running ? "Processando..." : result ? "Resultado" : ""}
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
              disabled={running || !ownerId}
            >
              {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Simular (Dry-run)
            </Button>
            <Button
              className="flex-1"
              onClick={() => setConfirmOpen(true)}
              disabled={running || !ownerId || !!existingCanonical}
            >
              Migrar agora
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Hard confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
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
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
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
