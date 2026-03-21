import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Database, Trash2, AlertTriangle, Calendar, HardDrive } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useStorageManagement } from "@/hooks/useStorageManagement";

export function StorageManagementSection() {
  const { tables, isLoading, executePurge, isPurging, purgeResult } = useStorageManagement();
  const [confirmOpen, setConfirmOpen] = useState(false);

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="pb-3 border-b border-border">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const TABLE_LABELS: Record<string, string> = {
    monitor_provider_payloads: "Payloads de Providers (auditoria)",
    wa_webhook_events: "Eventos de Webhook WhatsApp",
  };

  return (
    <>
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-warning" />
            <CardTitle className="text-base font-semibold text-foreground">
              Gerenciamento de Storage
            </CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmOpen(true)}
            disabled={isPurging}
            className="border-destructive text-destructive hover:bg-destructive/10"
          >
            {isPurging ? (
              <Spinner size="sm" className="mr-2" />
            ) : (
              <Trash2 className="h-4 w-4 mr-2" />
            )}
            {isPurging ? "Executando..." : "Executar Purge Agora"}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Tabela</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Registros</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Tamanho Est.</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Retenção</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tables.map((t) => (
                  <TableRow key={t.table_name} className="hover:bg-muted/30 transition-colors align-middle">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm text-foreground font-mono">{t.table_name}</p>
                        <p className="text-xs text-muted-foreground">{TABLE_LABELS[t.table_name] || ""}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {t.row_count.toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      <Badge variant="outline" className={
                        parseFloat(t.total_size) > 500
                          ? "bg-destructive/10 text-destructive border-destructive/20"
                          : "bg-warning/10 text-warning border-warning/20"
                      }>
                        {t.total_size}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-xs gap-1">
                              <Calendar className="w-3 h-3" />
                              {t.retention_days} dias
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            Dados mais antigos que {t.retention_days} dias são removidos automaticamente
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Purge result */}
          {purgeResult && (
            <div className="p-4 border-t border-border bg-success/5">
              <div className="flex items-center gap-2 text-sm text-success">
                <HardDrive className="w-4 h-4" />
                <span className="font-medium">
                  Último purge: {(purgeResult.payloads_deleted + purgeResult.webhooks_deleted).toLocaleString("pt-BR")} registros removidos
                </span>
              </div>
            </div>
          )}

          {/* Info */}
          <div className="p-4 border-t border-border">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Purge automático roda <strong>todo domingo às 00h (BRT)</strong>.</p>
                <p>Payloads de providers: retenção de 7 dias. Webhooks WA processados: retenção de 14 dias.</p>
                <p>Dados não processados nunca são removidos automaticamente.</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirm Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Executar Purge Manual
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Esta ação irá remover permanentemente:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li><strong>monitor_provider_payloads</strong> com mais de 7 dias</li>
                <li><strong>wa_webhook_events</strong> processados com mais de 14 dias</li>
              </ul>
              <p className="text-xs text-muted-foreground mt-2">
                Eventos de webhook não processados serão preservados independentemente da idade.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPurging}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={isPurging}
              onClick={() => {
                executePurge();
                setConfirmOpen(false);
              }}
              className="gap-2"
            >
              {isPurging ? <Spinner size="sm" /> : <Trash2 className="h-4 w-4" />}
              Confirmar Purge
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
