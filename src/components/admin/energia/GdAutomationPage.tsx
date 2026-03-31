/**
 * GdAutomationPage — Admin page for GD automation queue.
 * §26: Header with icon. §27: KPI cards. §4: Table. §12: Skeleton.
 */
import { useState } from "react";
import { Zap, Clock, CheckCircle2, AlertTriangle, Loader2, PlayCircle, RotateCcw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  useGdRecalcQueue,
  useGdAutomationSummary,
  useProcessGdRecalcItem,
} from "@/hooks/useGdRecalcQueue";

const TRIGGER_LABELS: Record<string, string> = {
  invoice_import: "Fatura importada",
  meter_sync: "Medidor sincronizado",
  monitoring_sync: "Monitoramento sync",
  allocation_change: "Alteração de rateio",
  linkage_change: "Alteração de vínculo",
  manual: "Manual",
};

const STATUS_CONFIG: Record<string, { label: string; variant: string; className: string }> = {
  pending: { label: "Pendente", variant: "outline", className: "border-warning text-warning" },
  processing: { label: "Processando", variant: "outline", className: "border-info text-info" },
  completed: { label: "Concluído", variant: "outline", className: "border-success text-success" },
  failed: { label: "Falhou", variant: "outline", className: "border-destructive text-destructive" },
};

export function GdAutomationPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const { data: summary, isLoading: loadingSummary } = useGdAutomationSummary();
  const { data: items, isLoading: loadingItems } = useGdRecalcQueue(statusFilter);
  const processItem = useProcessGdRecalcItem();

  const handleProcess = async (itemId: string) => {
    try {
      const result = await processItem.mutateAsync(itemId);
      if (result.success) {
        toast.success("Recálculo processado com sucesso");
      } else {
        toast.error(`Erro: ${result.error}`);
      }
    } catch {
      toast.error("Erro ao processar item");
    }
  };

  const kpis = [
    { icon: Clock, label: "Pendentes", value: summary?.pending ?? 0, color: "warning" },
    { icon: Loader2, label: "Processando", value: summary?.processing ?? 0, color: "info" },
    { icon: CheckCircle2, label: "Concluídos hoje", value: summary?.completedToday ?? 0, color: "success" },
    { icon: AlertTriangle, label: "Falhos", value: summary?.failed ?? 0, color: "destructive" },
  ];

  return (
    <div className="space-y-6">
      {/* §26: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Automações Energéticas</h1>
            <p className="text-sm text-muted-foreground">
              Recalcule grupos GD automaticamente com base em eventos do sistema
            </p>
          </div>
        </div>
      </div>

      {/* §27: KPI Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {kpis.map((kpi) => {
            const colorClass = `border-l-${kpi.color}`;
            const bgClass = `bg-${kpi.color}/10`;
            const textClass = `text-${kpi.color}`;
            return (
              <Card key={kpi.label} className={`border-l-[3px] ${colorClass} bg-card shadow-sm`}>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bgClass} ${textClass} shrink-0`}>
                    <kpi.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                      {kpi.value}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">{kpi.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-3">
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="processing">Processando</SelectItem>
            <SelectItem value="completed">Concluídos</SelectItem>
            <SelectItem value="failed">Falhos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* §4: Table */}
      {loadingItems ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <Card className="p-8 text-center">
          <Zap className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground">Nenhum item na fila de recálculo</p>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Grupo GD</TableHead>
                <TableHead className="font-semibold text-foreground">Mês/Ano</TableHead>
                <TableHead className="font-semibold text-foreground">Gatilho</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Tentativas</TableHead>
                <TableHead className="font-semibold text-foreground">Criado em</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                return (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium text-foreground">
                      {item.gd_groups?.nome || item.gd_group_id.slice(0, 8)}
                    </TableCell>
                    <TableCell>{`${String(item.reference_month).padStart(2, "0")}/${item.reference_year}`}</TableCell>
                    <TableCell className="text-sm">
                      {TRIGGER_LABELS[item.trigger_type] || item.trigger_type}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusCfg.className}`}>
                        {statusCfg.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">{item.attempts}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {(item.status === "pending" || item.status === "failed") && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={processItem.isPending}
                                onClick={() => handleProcess(item.id)}
                              >
                                <PlayCircle className="w-4 h-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Processar agora</TooltipContent>
                          </Tooltip>
                        )}
                        {item.last_error && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <AlertTriangle className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-[300px]">{item.last_error}</TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
