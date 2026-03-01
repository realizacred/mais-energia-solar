import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Eye, Filter } from "lucide-react";
import { listAlerts } from "@/services/monitoring/monitorService";
import { listPlantsWithHealth } from "@/services/monitoring/monitorService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { AlertSeverity } from "@/services/monitoring/monitorTypes";

const SEVERITY_LABELS: Record<string, string> = {
  critical: "Crítico",
  warn: "Alerta",
  info: "Info",
};

const TYPE_LABELS: Record<string, string> = {
  offline: "Offline",
  low_generation: "Baixa geração",
  comm_fault: "Falha comunicação",
  inverter_fault: "Falha inversor",
  other: "Outro",
};

export default function MonitorAlerts() {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState<boolean | undefined>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["monitor-alerts", filterOpen, filterSeverity],
    queryFn: () =>
      listAlerts({
        isOpen: filterOpen,
        severity: filterSeverity !== "all" ? filterSeverity : undefined,
      }),
  });

  const { data: plants = [] } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
  });

  const plantMap = new Map(plants.map((p) => [p.id, p]));

  if (isLoading) return <LoadingState message="Carregando alertas..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Alertas"
        description="Monitore e gerencie alertas das usinas"
        icon={AlertTriangle}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={filterOpen === true ? "default" : "outline"}
          onClick={() => setFilterOpen(filterOpen === true ? undefined : true)}
          className="text-xs"
        >
          Abertos
        </Button>
        <Button
          size="sm"
          variant={filterOpen === false ? "default" : "outline"}
          onClick={() => setFilterOpen(filterOpen === false ? undefined : false)}
          className="text-xs"
        >
          Fechados
        </Button>
        <div className="w-px h-6 bg-border self-center mx-1" />
        {(["all", "critical", "warn", "info"] as const).map((sev) => (
          <Button
            key={sev}
            size="sm"
            variant={filterSeverity === sev ? "default" : "outline"}
            onClick={() => setFilterSeverity(sev)}
            className="text-xs"
          >
            {sev === "all" ? "Todas" : SEVERITY_LABELS[sev] || sev}
          </Button>
        ))}
      </div>

      {alerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhum alerta encontrado"
          description="Ajuste os filtros ou aguarde a próxima sincronização."
        />
      ) : (
        <SectionCard title={`${alerts.length} alertas`} icon={AlertTriangle} variant="warning" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-medium">Severidade</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Usina</th>
                  <th className="text-left px-4 py-3 font-medium">Título</th>
                  <th className="text-left px-4 py-3 font-medium">Tempo aberto</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => {
                  const plant = plantMap.get(alert.plant_id);
                  return (
                    <tr key={alert.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <StatusBadge status={SEVERITY_LABELS[alert.severity] || alert.severity} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[alert.type] || alert.type}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {plant?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[200px] truncate">
                        {alert.title}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(alert.starts_at), { locale: ptBR })}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={alert.is_open ? "Aberto" : "Fechado"} size="sm" />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/monitoramento/usinas/${alert.plant_id}`)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
