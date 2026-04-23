/**
 * Migração SolarMarket — Step 3 (Migrar dados para o CRM).
 *
 * Background real: edge `sm-migrate-chunk` auto-encadeia steps via EdgeRuntime.waitUntil
 * + pg_cron de safety. UI só observa estado real do banco.
 *
 * Botões inteligentes:
 *   - Nada iniciado / completo → "🚀 Iniciar Migração Completa"
 *   - Running                  → "Migração em andamento" + Cancelar
 *   - Failed/Cancelled c/ backlog → "↻ Continuar de onde parou"
 *
 * Inclui: card de totais (sempre atualizado), histórico de últimos 5 jobs.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  PlayCircle,
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Users,
  FolderKanban,
  FileText,
  RefreshCw,
  History,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { useDryRunMigration, type DryRunReport } from "@/hooks/useDryRunMigration";
import { useChunkedMigration, type ChunkedJob } from "@/hooks/useChunkedMigration";

function formatNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function formatDateBR(s: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function durationStr(start: string | null, end: string | null): string {
  if (!start) return "—";
  const e = end ? new Date(end).getTime() : Date.now();
  const ms = e - new Date(start).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function StageBar({
  icon: Icon,
  label,
  promoted,
  total,
}: {
  icon: typeof Users;
  label: string;
  promoted: number;
  total: number;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((promoted / total) * 100)) : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Icon className="w-4 h-4 text-primary" />
          <span className="font-medium">{label}</span>
        </div>
        <span className="font-mono text-muted-foreground">
          {formatNum(promoted)} / {formatNum(total)}
          <span className="ml-2 text-xs">({pct}%)</span>
        </span>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    running: { label: "Em execução", cls: "bg-info/10 text-info border-info/20" },
    completed: { label: "Concluído", cls: "bg-success/10 text-success border-success/20" },
    completed_with_warnings: {
      label: "Concluído (avisos)",
      cls: "bg-warning/10 text-warning border-warning/20",
    },
    failed: { label: "Falhou", cls: "bg-destructive/10 text-destructive border-destructive/20" },
    cancelled: { label: "Cancelado", cls: "bg-muted text-muted-foreground border-border" },
    pending: { label: "Pendente", cls: "bg-muted text-muted-foreground border-border" },
  };
  const cfg = map[status] ?? { label: status, cls: "bg-muted text-muted-foreground border-border" };
  return (
    <Badge variant="outline" className={cfg.cls}>
      {cfg.label}
    </Badge>
  );
}

export default function MigracaoStep3Migrar() {
  const dryRun = useDryRunMigration();
  const { start, continueJob, cancel, progress, isLoading } = useChunkedMigration();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const lastReport: DryRunReport | null = dryRun.data?.report ?? null;

  const isRunning = !!progress?.isRunning;
  const isComplete = !!progress?.isComplete;
  const isResumable = !!progress?.isResumable;
  const isStuck = !!progress?.isStuck;
  const job = progress?.job ?? null;
  const totals = progress?.totals;
  const history = progress?.history ?? [];

  const canStart = !start.isPending && !isRunning && !isResumable;

  const handleConfirmReal = async () => {
    if (confirmText.trim().toUpperCase() !== "MIGRAR") {
      toast.error('Digite "MIGRAR" para confirmar.');
      return;
    }
    setConfirmOpen(false);
    setConfirmText("");
    try {
      const res = await start.mutateAsync();
      const id = res.master_job_id ?? "";
      toast.success(
        `Migração iniciada em background (job ${id.slice(0, 8)}…). Você pode fechar esta aba — o servidor continua processando.`,
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar migração.");
    }
  };

  const handleContinue = async () => {
    if (!job) return;
    try {
      await continueJob.mutateAsync(job.id);
      toast.success("Migração retomada de onde parou. Continua em background.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao retomar.");
    }
  };

  const handleDryRun = async () => {
    try {
      await dryRun.mutateAsync({});
      toast.success("Dry-run concluído. Veja o relatório abaixo.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no dry-run.");
    }
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
      {/* Header */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2">
          <Link to="/admin/migracao-solarmarket/mapear">
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para mapeamentos
          </Link>
        </Button>
        <h1 className="text-xl font-bold text-foreground">Step 3 — Migrar dados para o CRM</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Roda em background no servidor. Pode fechar a aba — a migração continua e você
          vê o progresso real ao voltar.
        </p>
      </div>

      {/* Card de totais — SEMPRE visível, atualiza a cada 3-8s */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 text-primary ${isRunning ? "animate-spin" : ""}`} />
            Estado atual
            {isLoading && (
              <span className="text-xs text-muted-foreground font-normal">carregando…</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {totals ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <StageBar
                icon={Users}
                label="Clientes"
                promoted={totals.clientes.promoted}
                total={totals.clientes.total}
              />
              <StageBar
                icon={FolderKanban}
                label="Projetos"
                promoted={totals.projetos.promoted}
                total={totals.projetos.total}
              />
              <StageBar
                icon={FileText}
                label="Propostas"
                promoted={totals.propostas.promoted}
                total={totals.propostas.total}
              />
              <div className="pt-2 border-t border-border">
                <StageBar
                  icon={ShieldCheck}
                  label="Total geral"
                  promoted={
                    totals.clientes.promoted +
                    totals.projetos.promoted +
                    totals.propostas.promoted
                  }
                  total={totals.clientes.total + totals.projetos.total + totals.propostas.total}
                />
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Carregando totais…</p>
          )}
        </CardContent>
      </Card>

      {/* Painel de execução */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Migração completa (background)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Botões */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleDryRun}
              disabled={dryRun.isPending || isRunning}
              className="flex-1"
            >
              {dryRun.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <PlayCircle className="w-4 h-4 mr-2" />
              )}
              Simular (Dry-Run)
            </Button>

            {isResumable ? (
              <Button
                onClick={handleContinue}
                disabled={continueJob.isPending}
                className="flex-1"
              >
                {continueJob.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4 mr-2" />
                )}
                ↻ Continuar de onde parou
              </Button>
            ) : (
              <Button
                onClick={() => setConfirmOpen(true)}
                disabled={!canStart}
                className="flex-1"
              >
                {start.isPending || isRunning ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Rocket className="w-4 h-4 mr-2" />
                )}
                {isRunning
                  ? "Migração em andamento…"
                  : isComplete
                    ? "✅ Migração concluída"
                    : "🚀 Iniciar Migração Completa"}
              </Button>
            )}
          </div>

          {/* Progresso do job atual */}
          {job && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-foreground flex items-center gap-2">
                  Job atual
                  <span className="font-mono text-xs text-muted-foreground">
                    ({job.id.slice(0, 8)}…)
                  </span>
                  <StatusBadge status={job.status} />
                </span>
                <span className="font-mono text-muted-foreground">
                  {formatNum(job.items_processed)} / {formatNum(job.total_items)}
                  <span className="ml-2 text-xs">({progress?.pctGeral ?? 0}%)</span>
                </span>
              </div>
              <Progress value={progress?.pctGeral ?? 0} className="h-3" />

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="rounded border border-border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Promovidos</p>
                  <p className="font-semibold text-success">{formatNum(job.items_promoted)}</p>
                </div>
                <div className="rounded border border-border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Erros</p>
                  <p className="font-semibold text-destructive">
                    {formatNum(job.items_with_errors)}
                  </p>
                </div>
                <div className="rounded border border-border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Bloqueados</p>
                  <p className="font-semibold text-warning">{formatNum(job.items_blocked)}</p>
                </div>
                <div className="rounded border border-border bg-muted/30 p-2">
                  <p className="text-muted-foreground">Avisos</p>
                  <p className="font-semibold text-foreground">
                    {formatNum(job.items_with_warnings)}
                  </p>
                </div>
              </div>

              {isRunning && (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3" />
                    Último step: {job.last_step_at ? formatDateBR(job.last_step_at) : "—"}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => cancel.mutate(job.id)}
                    disabled={cancel.isPending}
                  >
                    Cancelar migração
                  </Button>
                </div>
              )}

              {isStuck && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
                  <p className="text-sm font-medium text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Job aparentemente travado
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sem progresso há mais de 3 minutos. O cron de safety vai retomar
                    automaticamente em até 1 minuto. Se persistir, cancele e use "Continuar".
                  </p>
                </div>
              )}

              {isComplete && (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                  <p className="text-sm font-medium text-success flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Migração concluída
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Duração: {durationStr(job.started_at, job.finished_at)}
                  </p>
                </div>
              )}

              {(job.status === "failed" || job.status === "cancelled") && job.error_summary && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <XCircle className="w-4 h-4" />
                    {job.status === "failed" ? "Job falhou" : "Job cancelado"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{job.error_summary}</p>
                  {isResumable && (
                    <p className="text-xs text-foreground mt-2 font-medium">
                      Use "↻ Continuar de onde parou" para retomar — itens já migrados
                      são pulados (idempotente).
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Histórico */}
      {history.length > 0 && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" /> Histórico (últimos {history.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 font-medium">Início</th>
                    <th className="text-left py-2 px-2 font-medium">Status</th>
                    <th className="text-right py-2 px-2 font-medium">Processados</th>
                    <th className="text-right py-2 px-2 font-medium">Promovidos</th>
                    <th className="text-right py-2 px-2 font-medium">Erros</th>
                    <th className="text-left py-2 px-2 font-medium">Duração</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h: ChunkedJob) => (
                    <tr key={h.id} className="border-b border-border/50">
                      <td className="py-2 px-2 font-mono text-muted-foreground">
                        {formatDateBR(h.started_at)}
                      </td>
                      <td className="py-2 px-2">
                        <StatusBadge status={h.status} />
                      </td>
                      <td className="py-2 px-2 text-right font-mono">
                        {formatNum(h.items_processed)} / {formatNum(h.total_items)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-success">
                        {formatNum(h.items_promoted)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-destructive">
                        {formatNum(h.items_with_errors)}
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">
                        {durationStr(h.started_at, h.finished_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relatório do Dry-Run */}
      {lastReport && (
        <Card className="bg-card border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              {lastReport.bloqueados.length === 0 ? (
                <CheckCircle2 className="w-4 h-4 text-success" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-warning" />
              )}
              Relatório do Dry-Run
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Candidatos</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.total_candidatos)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.clientes_a_criar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projetos</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.projetos_a_criar)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Propostas</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatNum(lastReport.propostas_a_criar)}
                </p>
              </div>
            </div>

            {lastReport.bloqueados.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-destructive mb-2">
                  Bloqueados ({lastReport.bloqueados.length})
                </h4>
                <ScrollArea className="h-48 rounded-md border border-border">
                  <ul className="divide-y divide-border text-xs">
                    {lastReport.bloqueados.map((b, i) => (
                      <li key={i} className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {b.tipo}/{b.external_id ?? "—"}
                        </span>
                        <span className="ml-2 text-foreground">{b.motivos.join(", ")}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}

            {lastReport.warnings.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-warning mb-2">
                  Warnings ({lastReport.warnings.length})
                </h4>
                <ScrollArea className="h-40 rounded-md border border-border">
                  <ul className="divide-y divide-border text-xs">
                    {lastReport.warnings.map((w, i) => (
                      <li key={i} className="p-2">
                        <span className="font-mono text-muted-foreground">
                          {w.tipo}/{w.external_id ?? "—"}
                        </span>
                        <span className="ml-2 text-foreground">{w.mensagem}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Confirmação */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar migração real</DialogTitle>
            <DialogDescription>
              Esta ação cria clientes, projetos e propostas no CRM. É idempotente
              (itens já promovidos são pulados) e roda em background — você pode
              fechar a aba.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-foreground">
              Digite <span className="font-mono font-semibold">MIGRAR</span> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="MIGRAR"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmReal} disabled={start.isPending}>
              {start.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Iniciar migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
