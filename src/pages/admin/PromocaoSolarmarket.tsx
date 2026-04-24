/**
 * PromocaoSolarmarket — UI 1-clique para migração SolarMarket → CRM (Fase 2).
 *
 * Substitui a UI antiga (PromocaoSolarmarketSection) por uma página enxuta:
 *   - Cards de estado: staging (origem) vs canônico (destino)
 *   - Botão único "Iniciar migração completa"
 *   - Barras de progresso por entidade (clientes / projetos / propostas)
 *   - Polling automático do job ativo (sobrevive a fechar a aba)
 *
 * Reusa: useMigrateFull (start + progress + cancel) e useResetMigratedData (DEV).
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useMigrateFull } from "@/hooks/useMigrateFull";
import { useResetMigratedData } from "@/hooks/useResetMigratedData";
import { toast } from "@/hooks/use-toast";
import {
  Rocket, ArrowLeft, Sparkles, Eraser, Loader2, Cloud,
  Users, FolderKanban, FileText, CheckCircle2, AlertCircle, Play, X,
} from "lucide-react";

function StatRow({
  icon: Icon, label, promoted, total,
}: { icon: React.ComponentType<{ className?: string }>; label: string; promoted: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((promoted / total) * 100)) : 0;
  const done = total > 0 && promoted >= total;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className={done ? "text-success font-bold" : "text-foreground"}>
            {promoted.toLocaleString("pt-BR")}
          </span>
          <span className="text-muted-foreground">/ {total.toLocaleString("pt-BR")}</span>
          {done && <CheckCircle2 className="w-3.5 h-3.5 text-success" />}
        </div>
      </div>
      <Progress value={pct} className="h-2" />
    </div>
  );
}

export default function PromocaoSolarmarket() {
  const { start, cancel, progress, isLoading } = useMigrateFull();
  const resetMigrated = useResetMigratedData();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleStart = async () => {
    try {
      const res = await start.mutateAsync({ batch_limit: 10000, dry_run: false });
      toast({
        title: "Migração iniciada",
        description: `Job ${res.job_id.slice(0, 8)}… em execução. Pode fechar a aba — segue rodando.`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao iniciar migração", description: msg, variant: "destructive" });
    }
  };

  const handleCancel = async () => {
    if (!progress?.job?.id) return;
    try {
      await cancel.mutateAsync(progress.job.id);
      toast({ title: "Job cancelado" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao cancelar", description: msg, variant: "destructive" });
    }
  };

  const handleClearArea = async () => {
    try {
      await resetMigrated.mutateAsync();
      setConfirmOpen(false);
      toast({ title: "Área de promoção limpa" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Falha ao limpar área", description: msg, variant: "destructive" });
    }
  };

  const totals = progress?.totals;
  const job = progress?.job;
  const isRunning = !!progress?.isRunning;
  const isComplete = !!progress?.isComplete;
  const totalStaging =
    (totals?.clientes.total ?? 0) + (totals?.projetos.total ?? 0) + (totals?.propostas.total ?? 0);
  const totalPromoted =
    (totals?.clientes.promoted ?? 0) + (totals?.projetos.promoted ?? 0) + (totals?.propostas.promoted ?? 0);
  const nothingToDo = totalStaging === 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1100px]">
        {/* HEADER */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5"
        >
          <div className="flex items-start gap-4 min-w-0">
            <div className="relative shrink-0">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/40 to-info/30 blur-lg opacity-70" aria-hidden />
              <div className="relative h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-info flex items-center justify-center shadow-md ring-1 ring-border">
                <Rocket className="w-7 h-7 text-primary-foreground" />
              </div>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Migração SolarMarket → CRM
                </h1>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 gap-1.5">
                  <Sparkles className="w-3 h-3" /> Fase 2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                Promove clientes, projetos e propostas do staging para o domínio canônico
                em uma única operação. Idempotente — pode rodar de novo sem duplicar.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/importacao-solarmarket">
                <ArrowLeft className="w-4 h-4" /> Importação (Fase 1)
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/importacao-solarmarket">
                <Cloud className="w-4 h-4" /> Ver staging
              </Link>
            </Button>

            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline" size="sm"
                  disabled={resetMigrated.isPending || isRunning}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive"
                >
                  {resetMigrated.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eraser className="w-4 h-4" />}
                  Limpar área
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="w-[90vw] max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle>Limpar área de promoção (DEV)</AlertDialogTitle>
                  <AlertDialogDescription>
                    Apaga TODOS os registros canônicos criados pela promoção (clientes, projetos,
                    propostas, versões) com origem <code>solar_market</code>.
                    <br /><br />
                    Não afeta o staging (<code>sm_*_raw</code>). Use apenas em DEV.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearArea}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Limpar tudo
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </motion.div>

        {/* CARD PRINCIPAL */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="p-6 space-y-6">
            {/* Status banner */}
            {isLoading ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando estado da migração…
              </div>
            ) : isRunning ? (
              <div className="flex items-center justify-between gap-4 p-3 rounded-lg bg-info/10 border border-info/30">
                <div className="flex items-center gap-3 min-w-0">
                  <Loader2 className="w-5 h-5 animate-spin text-info shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Migração em andamento</p>
                    <p className="text-xs text-muted-foreground">
                      Job {job?.id.slice(0, 8)}… • {job?.items_processed ?? 0} de {job?.total_items ?? 0} processados.
                      Pode fechar a aba.
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancel.isPending}>
                  <X className="w-4 h-4" /> Cancelar
                </Button>
              </div>
            ) : isComplete && totalPromoted > 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Última execução concluída — {totalPromoted.toLocaleString("pt-BR")} registros promovidos
                  </p>
                  {(job?.items_with_errors ?? 0) > 0 && (
                    <p className="text-xs text-warning">
                      {job?.items_with_errors} com erro · {job?.items_with_warnings ?? 0} avisos
                    </p>
                  )}
                </div>
              </div>
            ) : nothingToDo ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted border border-border">
                <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">
                  Nenhum dado em staging. Importe os dados primeiro na <Link to="/admin/importacao-solarmarket" className="text-primary underline">Fase 1</Link>.
                </p>
              </div>
            ) : null}

            {/* Progresso por entidade */}
            <div className="space-y-5">
              <StatRow
                icon={Users}
                label="Clientes"
                promoted={totals?.clientes.promoted ?? 0}
                total={totals?.clientes.total ?? 0}
              />
              <StatRow
                icon={FolderKanban}
                label="Projetos"
                promoted={totals?.projetos.promoted ?? 0}
                total={totals?.projetos.total ?? 0}
              />
              <StatRow
                icon={FileText}
                label="Propostas"
                promoted={totals?.propostas.promoted ?? 0}
                total={totals?.propostas.total ?? 0}
              />
            </div>

            {/* CTA */}
            <div className="pt-2 border-t border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-xs text-muted-foreground">
                {isRunning
                  ? `Progresso geral: ${progress?.pctGeral ?? 0}%`
                  : "Idempotente: registros já migrados são ignorados automaticamente."}
              </div>
              <Button
                size="lg"
                onClick={handleStart}
                disabled={isRunning || start.isPending || nothingToDo}
                className="gap-2"
              >
                {start.isPending ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Iniciando…</>
                ) : isRunning ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Em execução…</>
                ) : (
                  <><Play className="w-4 h-4" /> Iniciar migração completa</>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detalhes do job (compacto) */}
        {job && (
          <Card className="bg-card border-border shadow-sm">
            <CardContent className="p-5 space-y-3">
              <h2 className="text-base font-semibold text-foreground">Última execução</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <p className="font-mono font-bold text-foreground">{job.status}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Promovidos</p>
                  <p className="font-mono font-bold text-success">{job.items_promoted}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Avisos</p>
                  <p className="font-mono font-bold text-warning">{job.items_with_warnings}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Erros</p>
                  <p className="font-mono font-bold text-destructive">{job.items_with_errors}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
