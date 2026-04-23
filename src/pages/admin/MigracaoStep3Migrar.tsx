/**
 * Migração SolarMarket — Step 3 (Migrar dados para o CRM).
 *
 * UX: 1 clique → migração completa automática (clientes + projetos + propostas
 * em cascata, via edge `sm-promote` com scope=proposta).
 *
 * Polling de progresso a cada 2s mostra o avanço real em tempo real.
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
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
import { useChunkedMigration } from "@/hooks/useChunkedMigration";

function formatNum(n: number): string {
  return n.toLocaleString("pt-BR");
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

export default function MigracaoStep3Migrar() {
  const dryRun = useDryRunMigration();
  const { start, cancel, progress } = useChunkedMigration();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  const lastReport: DryRunReport | null = dryRun.data?.report ?? null;

  const isRunning = !!progress?.isRunning;
  const isComplete = !!progress?.isComplete;
  const job = progress?.job ?? null;
  const lastError = progress?.lastError ?? null;

  const canStart = !start.isPending && !isRunning;

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
      toast.success(`Migração iniciada em chunks (job ${id.slice(0, 8)}…). Acompanhe o progresso abaixo.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao iniciar migração.");
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
        <h1 className="text-xl font-bold text-foreground">
          Step 3 — Migrar dados para o CRM
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          1 clique processa clientes, projetos e propostas em cascata. Acompanhe o progresso em tempo real.
        </p>
      </div>

      {/* Painel principal — 1 botão + progresso */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" /> Migração completa (automática)
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
              {isRunning ? "Migração em andamento…" : "🚀 Iniciar Migração Completa"}
            </Button>
          </div>

          {/* Progresso geral */}
          {(isRunning || isComplete || (job && job.items_processed > 0)) && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-foreground">
                    Progresso geral
                    {job && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (job {job.id.slice(0, 8)}…)
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {formatNum(job?.items_processed ?? 0)} / {formatNum(job?.total_items ?? 0)}
                    <span className="ml-2 text-xs">({progress?.pctGeral ?? 0}%)</span>
                  </span>
                </div>
                <Progress value={progress?.pctGeral ?? 0} className="h-3" />
              </div>

              {/* Sub-barras por entidade (totais canônicos vs staging) */}
              {progress && (
                <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
                  <StageBar
                    icon={Users}
                    label="Clientes migrados"
                    promoted={progress.totals.clientes.promoted}
                    total={progress.totals.clientes.total}
                  />
                  <StageBar
                    icon={FolderKanban}
                    label="Projetos migrados"
                    promoted={progress.totals.projetos.promoted}
                    total={progress.totals.projetos.total}
                  />
                  <StageBar
                    icon={FileText}
                    label="Propostas migradas"
                    promoted={progress.totals.propostas.promoted}
                    total={progress.totals.propostas.total}
                  />
                </div>
              )}

              {isRunning && job && (
                <div className="flex items-center justify-end">
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

              {isComplete && job && (
                <div className="rounded-lg border border-success/30 bg-success/10 p-3">
                  <p className="text-sm font-medium text-success flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Migração concluída
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatNum(job.items_promoted)} promovidos · {formatNum(job.items_with_errors)} erros · {formatNum(job.items_blocked)} bloqueados · {formatNum(job.items_with_warnings)} avisos
                  </p>
                </div>
              )}

              {lastError && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" /> Erro no loop
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{lastError}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

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
                <p className="text-lg font-semibold text-foreground">{formatNum(lastReport.total_candidatos)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-lg font-semibold text-foreground">{formatNum(lastReport.clientes_a_criar)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Projetos</p>
                <p className="text-lg font-semibold text-foreground">{formatNum(lastReport.projetos_a_criar)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Propostas</p>
                <p className="text-lg font-semibold text-foreground">{formatNum(lastReport.propostas_a_criar)}</p>
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
              (itens já promovidos são pulados), mas grava dados reais.
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
