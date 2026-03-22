import { useState } from "react";
import { StorageManagementSection } from "./StorageManagementSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  HardDrive,
  Download,
  Trash2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  FileJson,
} from "lucide-react";
import { motion } from "framer-motion";
import { useBackupRestore } from "@/hooks/useBackupRestore";
import { Spinner } from "@/components/ui-kit/Spinner";
import { formatIntegerBR } from "@/lib/formatters";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  completed: { label: "Concluído", className: "bg-success/10 text-success border-success/20", icon: CheckCircle2 },
  running: { label: "Em andamento", className: "bg-warning/10 text-warning border-warning/20", icon: Loader2 },
  pending: { label: "Pendente", className: "bg-info/10 text-info border-info/20", icon: Clock },
  failed: { label: "Falhou", className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDateBR(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BackupRestorePage() {
  const {
    logs,
    isLoading,
    refetch,
    createBackup,
    isCreating,
    downloadBackup,
    isDownloading,
    deleteBackup,
    isDeleting,
  } = useBackupRestore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80 mt-1" />
          </div>
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  const totalRows = logs
    .filter((l) => l.status === "completed")
    .reduce((sum, l) => {
      const counts = l.tables_row_counts || {};
      return sum + Object.values(counts).reduce((s, v) => s + (v || 0), 0);
    }, 0);

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Backup de Dados</h1>
            <p className="text-sm text-muted-foreground">
              Exporte os dados do banco de dados do seu tenant para backup seguro
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => createBackup()} disabled={isCreating}>
            {isCreating ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            {isCreating ? "Criando..." : "Novo Backup"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {logs.length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Backups realizados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <FileJson className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {formatFileSize(
                  logs
                    .filter((l) => l.status === "completed")
                    .reduce((sum, l) => sum + (l.file_size_bytes || 0), 0)
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Armazenamento total</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {formatIntegerBR(totalRows)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Registros no último backup</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Backup History Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold text-foreground">
            Histórico de Backups
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <HardDrive className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Nenhum backup encontrado</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Clique em "Novo Backup" para criar o primeiro
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Status</TableHead>
                    <TableHead className="font-semibold text-foreground">Data</TableHead>
                    <TableHead className="font-semibold text-foreground">Tamanho</TableHead>
                    <TableHead className="font-semibold text-foreground">Tabelas</TableHead>
                    <TableHead className="font-semibold text-foreground">Duração</TableHead>
                    <TableHead className="w-[100px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const config = STATUS_CONFIG[log.status] || STATUS_CONFIG.pending;
                    const StatusIcon = config.icon;
                    const totalTableRows = log.tables_row_counts
                      ? Object.values(log.tables_row_counts).reduce((s, v) => s + (v || 0), 0)
                      : 0;

                    let duration = "—";
                    if (log.started_at && log.completed_at) {
                      const ms = new Date(log.completed_at).getTime() - new Date(log.started_at).getTime();
                      duration = ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
                    }

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30 transition-colors align-middle">
                        <TableCell>
                          <Badge variant="outline" className={`text-xs gap-1 ${config.className}`}>
                            <StatusIcon className={`w-3 h-3 ${log.status === "running" ? "animate-spin" : ""}`} />
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-foreground whitespace-nowrap">
                          {formatDateBR(log.created_at)}
                        </TableCell>
                        <TableCell className="text-sm font-mono text-foreground">
                          {formatFileSize(log.file_size_bytes)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <TooltipProvider delayDuration={300}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help underline decoration-dotted">
                                  {log.tables_included?.length || 0} tabelas
                                  {totalTableRows > 0 && ` · ${totalTableRows.toLocaleString("pt-BR")} reg.`}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <div className="text-xs space-y-0.5">
                                  {log.tables_row_counts &&
                                    Object.entries(log.tables_row_counts)
                                      .filter(([, v]) => v > 0)
                                      .map(([table, count]) => (
                                        <p key={table}>
                                          <span className="font-mono">{table}</span>: {count}
                                        </p>
                                      ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{duration}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {log.status === "completed" && (
                              <TooltipProvider delayDuration={300}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7"
                                      onClick={() => downloadBackup(log.id)}
                                      disabled={isDownloading}
                                    >
                                      <Download className="w-4 h-4 text-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Baixar backup</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setDeleteTarget(log.id)}
                                    disabled={isDeleting}
                                  >
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Remover backup</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Storage Management */}
      <StorageManagementSection />

      {/* Info Card */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Informações sobre o backup</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                <li>O backup exporta apenas os dados do banco de dados do seu tenant em formato JSON</li>
                <li>Arquivos de storage (fotos, documentos, PDFs) <strong>não</strong> são incluídos</li>
                <li>Este recurso não substitui um plano de disaster recovery completo</li>
                <li>Os backups são armazenados de forma privada e acessíveis apenas por administradores</li>
                <li>Para restauração, entre em contato com o suporte técnico</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remover Backup
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. O arquivo de backup será removido permanentemente do
              armazenamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={() => {
                if (deleteTarget) {
                  deleteBackup(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
              className="gap-2"
            >
              {isDeleting ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}
              {isDeleting ? "Removendo..." : "Remover"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
