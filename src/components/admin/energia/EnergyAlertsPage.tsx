/**
 * EnergyAlertsPage — Admin view for energy alerts.
 * §26: Header. §27: KPIs. §4: Table. §12: Skeleton. §16: Queries in hooks.
 */
import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, Bell, Filter, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useEnergyAlerts, useResolveEnergyAlert, type EnergyAlert } from "@/hooks/useEnergyAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const ALERT_TYPE_LABELS: Record<string, string> = {
  no_generation: "Sem geração",
  missing_invoice: "Fatura ausente",
  allocation_mismatch: "Rateio ≠ 100%",
  meter_offline: "Medidor offline",
  reconciliation_critical: "Divergência crítica",
};

const SEVERITY_STYLES: Record<string, { dot: string; badge: string; label: string }> = {
  critical: { dot: "bg-destructive", badge: "bg-destructive/10 text-destructive border-destructive/20", label: "Crítico" },
  warning: { dot: "bg-warning", badge: "bg-warning/10 text-warning border-warning/20", label: "Alerta" },
  info: { dot: "bg-info", badge: "bg-info/10 text-info border-info/20", label: "Info" },
};

export function EnergyAlertsPage() {
  const [showResolved, setShowResolved] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [resolveModal, setResolveModal] = useState<EnergyAlert | null>(null);
  const [resolveNote, setResolveNote] = useState("");

  const { data: alerts = [], isLoading } = useEnergyAlerts({
    pending: !showResolved ? true : undefined,
    severity: filterSeverity !== "all" ? filterSeverity : undefined,
    alert_type: filterType !== "all" ? filterType : undefined,
    limit: 200,
  });

  const resolveAlert = useResolveEnergyAlert();

  const criticalCount = alerts.filter(a => a.severity === "critical" && !a.resolved_at).length;
  const warningCount = alerts.filter(a => a.severity === "warning" && !a.resolved_at).length;
  const pendingCount = alerts.filter(a => !a.resolved_at).length;

  const handleResolve = async () => {
    if (!resolveModal) return;
    try {
      await resolveAlert.mutateAsync({ alertId: resolveModal.id, resolution_note: resolveNote });
      toast.success("Alerta resolvido com sucesso");
      setResolveModal(null);
      setResolveNote("");
    } catch {
      toast.error("Erro ao resolver alerta");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* §26: Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Alertas Energéticos</h1>
            <p className="text-sm text-muted-foreground">Monitoramento de anomalias em geração, faturas e rateio</p>
          </div>
        </div>
      </div>

      {/* §27: KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{criticalCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Críticos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{warningCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Alertas</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{pendingCount}</p>
                <p className="text-sm text-muted-foreground mt-1">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterSeverity} onValueChange={setFilterSeverity}>
          <SelectTrigger className="w-[160px]">
            <Filter className="w-3.5 h-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="Severidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Alerta</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="no_generation">Sem geração</SelectItem>
            <SelectItem value="missing_invoice">Fatura ausente</SelectItem>
            <SelectItem value="allocation_mismatch">Rateio ≠ 100%</SelectItem>
            <SelectItem value="meter_offline">Medidor offline</SelectItem>
            <SelectItem value="reconciliation_critical">Divergência crítica</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant={showResolved ? "default" : "outline"}
          size="sm"
          onClick={() => setShowResolved(!showResolved)}
        >
          {showResolved ? "Mostrando todos" : "Apenas pendentes"}
        </Button>
      </div>

      {/* §4: Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-7 h-7 text-success" />
          </div>
          <p className="text-lg font-semibold text-foreground">Nenhum alerta encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">O sistema está operando normalmente 🎉</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground w-[100px]">Severidade</TableHead>
                <TableHead className="font-semibold text-foreground w-[160px]">Tipo</TableHead>
                <TableHead className="font-semibold text-foreground">Descrição</TableHead>
                <TableHead className="font-semibold text-foreground w-[160px]">Entidade</TableHead>
                <TableHead className="font-semibold text-foreground w-[120px]">Quando</TableHead>
                <TableHead className="w-[100px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.map((alert) => {
                const sev = SEVERITY_STYLES[alert.severity] || SEVERITY_STYLES.info;
                const entity = alert.gd_groups?.nome
                  || alert.units_consumidoras?.codigo_uc
                  || alert.monitor_plants?.name
                  || "—";
                return (
                  <TableRow key={alert.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${sev.badge}`}>
                        {sev.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">
                      {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground truncate max-w-[400px]">{alert.title}</p>
                      {alert.description && (
                        <p className="text-xs text-muted-foreground truncate max-w-[400px]">{alert.description}</p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entity}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {!alert.resolved_at ? (
                        <Button variant="outline" size="sm" onClick={() => setResolveModal(alert)}>
                          Resolver
                        </Button>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
                          Resolvido
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Resolve Modal */}
      <Dialog open={!!resolveModal} onOpenChange={(o) => !o && setResolveModal(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Resolver alerta</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-foreground font-medium">{resolveModal?.title}</p>
            <Textarea
              placeholder="Nota de resolução (opcional)"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResolveModal(null)}>Cancelar</Button>
            <Button onClick={handleResolve} disabled={resolveAlert.isPending}>
              {resolveAlert.isPending ? "Resolvendo..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
