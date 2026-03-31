import { useCronJobs, type CronStatus } from "@/hooks/useCronJobs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { Timer, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, Loader2, Info } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";

const STATUS_CONFIG: Record<CronStatus, { label: string; icon: React.ElementType; className: string }> = {
  success:  { label: "OK",         icon: CheckCircle2,  className: "bg-success/10 text-success border-success/20" },
  running:  { label: "Executando", icon: Loader2,       className: "bg-info/10 text-info border-info/20" },
  failed:   { label: "Falhou",     icon: XCircle,       className: "bg-destructive/10 text-destructive border-destructive/20" },
  overdue:  { label: "Atrasado",   icon: AlertTriangle, className: "bg-warning/10 text-warning border-warning/20" },
  unknown:  { label: "Sem dados",  icon: Clock,         className: "bg-muted text-muted-foreground border-border" },
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatInterval(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(0)}h`;
  return `${(minutes / 1440).toFixed(0)}d`;
}

export default function CronJobsPage() {
  const { data: jobs, isLoading } = useCronJobs();
  const queryClient = useQueryClient();

  const defaultCounts: Record<CronStatus, number> = { success: 0, running: 0, failed: 0, overdue: 0, unknown: 0 };
  const counts = jobs?.reduce(
    (acc, j) => {
      acc[j.computedStatus] = (acc[j.computedStatus] || 0) + 1;
      return acc;
    },
    { ...defaultCounts }
  ) || defaultCounts;

  const kpis = [
    { label: "Funcionando", value: counts.success || 0, icon: CheckCircle2, color: "text-success", border: "border-l-success" },
    { label: "Executando", value: counts.running || 0, icon: Loader2, color: "text-info", border: "border-l-info" },
    { label: "Falhou", value: counts.failed || 0, icon: XCircle, color: "text-destructive", border: "border-l-destructive" },
    { label: "Atrasado", value: counts.overdue || 0, icon: AlertTriangle, color: "text-warning", border: "border-l-warning" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Timer className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Tarefas Agendadas (Cron Jobs)</h1>
            <p className="text-sm text-muted-foreground">Tarefas automáticas que rodam em segundo plano para manter o sistema funcionando</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => queryClient.invalidateQueries({ queryKey: ["cron-jobs-status"] })}
        >
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Atualizar
        </Button>
      </div>

      {/* Explanation Card */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4 text-info" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">O que são Tarefas Agendadas?</p>
            <p className="text-sm text-muted-foreground">
              São processos automáticos que rodam periodicamente sem intervenção manual. Eles sincronizam dados externos 
              (WhatsApp, SolarMarket, ANEEL, Meta Ads), processam filas de mensagens, verificam a saúde das integrações 
              e executam automações do pipeline comercial. Esta página é apenas de <strong>monitoramento</strong> — 
              as tarefas são gerenciadas pelo sistema e não precisam de configuração manual.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                <span><strong>OK</strong> = executou com sucesso dentro do intervalo esperado</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span><strong>Atrasado</strong> = não executou no dobro do tempo esperado</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <XCircle className="w-3.5 h-3.5 text-destructive" />
                <span><strong>Falhou</strong> = última execução retornou erro</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards §27 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              custom={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <Card className={`border-l-[3px] ${kpi.border} bg-card shadow-sm`}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0 ${kpi.color}`}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{kpi.value}</p>
                    <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Table §4 */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground w-[250px]">Tarefa</TableHead>
                <TableHead className="font-semibold text-foreground">O que faz</TableHead>
                <TableHead className="font-semibold text-foreground w-[100px]">Intervalo</TableHead>
                <TableHead className="font-semibold text-foreground w-[120px]">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Última Execução</TableHead>
                <TableHead className="font-semibold text-foreground w-[100px]">Duração</TableHead>
                <TableHead className="font-semibold text-foreground">Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs?.map((job) => {
                const cfg = STATUS_CONFIG[job.computedStatus];
                const Icon = cfg.icon;
                return (
                  <TableRow key={job.definition.name} className="hover:bg-muted/30 transition-colors align-middle">
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">{job.definition.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{job.definition.name}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-muted-foreground">{job.definition.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground font-mono">
                        {formatInterval(job.definition.intervalMinutes)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs gap-1 ${cfg.className}`}>
                        <Icon className={`w-3 h-3 ${job.computedStatus === "running" ? "animate-spin" : ""}`} />
                        {cfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {job.lastExecution ? (
                        <TooltipProvider delayDuration={400}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-sm text-muted-foreground">
                                {formatDistanceToNow(new Date(job.lastExecution.started_at), {
                                  addSuffix: true,
                                  locale: ptBR,
                                })}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs font-mono">
                                {new Date(job.lastExecution.started_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-muted-foreground/50">Nunca executou</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-mono text-muted-foreground">
                        {formatDuration(job.lastExecution?.duration_ms ?? null)}
                      </span>
                    </TableCell>
                    <TableCell>
                      {job.lastExecution?.error_message ? (
                        <TooltipProvider delayDuration={400}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="text-xs text-destructive truncate max-w-[200px] block">
                                {job.lastExecution.error_message.slice(0, 60)}…
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-[400px]">
                              <p className="text-xs font-mono whitespace-pre-wrap">
                                {job.lastExecution.error_message}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </motion.div>
  );
}
