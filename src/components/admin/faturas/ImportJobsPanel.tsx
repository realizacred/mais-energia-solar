/**
 * ImportJobsPanel — Shows active and recent import jobs with persistent progress.
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Loader2, CheckCircle, XCircle, Copy, FileText, Clock, ChevronRight,
} from "lucide-react";
import {
  useInvoiceImportJobs,
  useActiveImportJob,
  useInvoiceImportJobItems,
} from "@/hooks/useInvoiceImport";
import type { InvoiceImportJob } from "@/services/invoiceImportService";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive"; icon: typeof CheckCircle }> = {
  queued: { label: "Na fila", variant: "outline", icon: Clock },
  processing: { label: "Processando", variant: "secondary", icon: Loader2 },
  completed: { label: "Concluído", variant: "default", icon: CheckCircle },
  failed: { label: "Falhou", variant: "destructive", icon: XCircle },
  partial: { label: "Parcial", variant: "outline", icon: Copy },
};

const ITEM_STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  processing: { label: "Processando", className: "text-muted-foreground" },
  imported: { label: "Importado", className: "text-success" },
  duplicate: { label: "Duplicado", className: "text-warning" },
  failed: { label: "Falhou", className: "text-destructive" },
};

export function ImportJobsPanel() {
  const { data: activeJob } = useActiveImportJob();
  const { data: recentJobs = [], isLoading } = useInvoiceImportJobs(5);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const { data: detailItems = [] } = useInvoiceImportJobItems(detailJobId);

  const hasActiveJob = !!activeJob;
  const displayJobs = recentJobs.filter((j) => j.id !== activeJob?.id).slice(0, 3);

  if (isLoading) {
    return <Skeleton className="h-24 w-full rounded-lg" />;
  }

  if (!hasActiveJob && recentJobs.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Importações
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Active job */}
          {activeJob && <ActiveJobCard job={activeJob} onDetails={() => setDetailJobId(activeJob.id)} />}

          {/* Recent completed */}
          {displayJobs.length > 0 && (
            <div className="space-y-2">
              {!hasActiveJob && (
                <p className="text-xs text-muted-foreground font-medium">Recentes</p>
              )}
              {displayJobs.map((job) => (
                <RecentJobRow key={job.id} job={job} onDetails={() => setDetailJobId(job.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <Dialog open={!!detailJobId} onOpenChange={(o) => !o && setDetailJobId(null)}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Detalhes da Importação
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {detailItems.length} arquivo(s) processado(s)
              </p>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5">
              {detailItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum item encontrado</p>
              ) : (
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="font-semibold text-foreground">Arquivo</TableHead>
                      <TableHead className="font-semibold text-foreground">Referência</TableHead>
                      <TableHead className="font-semibold text-foreground">Status</TableHead>
                      <TableHead className="font-semibold text-foreground">Obs</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailItems.map((item) => {
                      const cfg = ITEM_STATUS_CONFIG[item.status] || ITEM_STATUS_CONFIG.processing;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm font-medium text-foreground max-w-[200px] truncate">
                            {item.file_name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.reference_month && item.reference_year
                              ? `${String(item.reference_month).padStart(2, "0")}/${item.reference_year}`
                              : "—"}
                          </TableCell>
                          <TableCell>
                            <span className={`text-xs font-medium ${cfg.className}`}>
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                            {item.error_message || "—"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ActiveJobCard({ job, onDetails }: { job: InvoiceImportJob; onDetails: () => void }) {
  const progress = job.total_files > 0 ? Math.round((job.processed_files / job.total_files) * 100) : 0;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm font-medium text-foreground">Importando...</span>
        </div>
        <span className="text-xs font-mono text-muted-foreground">
          {job.processed_files}/{job.total_files}
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {job.success_count > 0 && <span className="text-success">{job.success_count} ok</span>}
          {job.duplicate_count > 0 && <span className="text-warning ml-2">{job.duplicate_count} dup</span>}
          {job.error_count > 0 && <span className="text-destructive ml-2">{job.error_count} erro</span>}
        </span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onDetails}>
          Detalhes <ChevronRight className="w-3 h-3 ml-1" />
        </Button>
      </div>
    </div>
  );
}

function RecentJobRow({ job, onDetails }: { job: InvoiceImportJob; onDetails: () => void }) {
  const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
  const StatusIcon = cfg.icon;
  const isSpinning = job.status === "processing";

  return (
    <div
      className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/30 cursor-pointer transition-colors"
      onClick={onDetails}
    >
      <div className="flex items-center gap-2 min-w-0">
        <StatusIcon className={`w-4 h-4 shrink-0 ${isSpinning ? "animate-spin text-primary" : job.status === "completed" ? "text-success" : job.status === "failed" ? "text-destructive" : "text-muted-foreground"}`} />
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">
            {job.total_files} arquivo(s) — {job.success_count} importado(s)
            {job.duplicate_count > 0 && `, ${job.duplicate_count} duplicado(s)`}
            {job.error_count > 0 && `, ${job.error_count} erro(s)`}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {job.finished_at
              ? new Date(job.finished_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })
              : new Date(job.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
          </p>
        </div>
      </div>
      <Badge variant={cfg.variant} className="text-[10px] shrink-0">
        {cfg.label}
      </Badge>
    </div>
  );
}
