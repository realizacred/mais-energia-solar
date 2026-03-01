import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, Eye, BookOpen, ShieldCheck, ShieldAlert } from "lucide-react";
import { listAlerts, listPlantsWithHealth } from "@/services/monitoring/monitorService";
import { calcConfidenceScore, classifyAlert } from "@/services/monitoring/confidenceService";
import { getMonthlyAvgHsp, type HspResult } from "@/services/monitoring/irradiationService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

const LAYER_LABELS: Record<string, { label: string; color: string }> = {
  internal: { label: "Interno", color: "text-muted-foreground" },
  preventive: { label: "Preventivo", color: "text-warning" },
  urgent: { label: "Urgente", color: "text-destructive" },
};

export default function MonitorAlerts() {
  const navigate = useNavigate();
  const [filterOpen, setFilterOpen] = useState<boolean | undefined>(true);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [filterLayer, setFilterLayer] = useState<string>("all");

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

  // LEGACY JOIN: monitor_events.plant_id = monitor_plants.id
  // but listPlantsWithHealth returns solar_plants.id as the id.
  // We need to map monitor_plants.id → solar_plants.id via legacy_plant_id.
  const { data: monitorPlantMapping = new Map<string, string>() } = useQuery({
    queryKey: ["monitor-plant-id-mapping"],
    queryFn: async () => {
      const { data } = await supabase
        .from("monitor_plants" as any)
        .select("id, legacy_plant_id")
        .not("legacy_plant_id", "is", null);
      const map = new Map<string, string>();
      ((data as any[]) || []).forEach((row: any) => {
        // map monitor_plants.id → solar_plants.id (legacy_plant_id)
        map.set(row.id, row.legacy_plant_id);
      });
      return map;
    },
  });

  // Pre-fetch HSP for unique plant locations
  const uniqueLocations = useMemo(() => {
    const seen = new Map<string, { lat: number | null; lng: number | null }>();
    plants.forEach((p) => {
      const key = `${p.lat ?? "null"}_${p.lng ?? "null"}`;
      if (!seen.has(key)) seen.set(key, { lat: p.lat ?? null, lng: p.lng ?? null });
    });
    return seen;
  }, [plants]);

  const { data: hspMap = new Map<string, HspResult>() } = useQuery({
    queryKey: ["monitor-hsp-alerts", Array.from(uniqueLocations.keys()).join(",")],
    queryFn: async () => {
      const result = new Map<string, HspResult>();
      for (const [key, loc] of uniqueLocations.entries()) {
        const hsp = await getMonthlyAvgHsp({ lat: loc.lat, lon: loc.lng, month: new Date().getMonth() + 1 });
        result.set(key, hsp);
      }
      return result;
    },
    enabled: uniqueLocations.size > 0,
  });

  const plantMap = new Map(plants.map((p) => [p.id, p]));

  // Enrich alerts with REAL confidence score and layer
  // LEGACY JOIN: alert.plant_id may be monitor_plants.id, so resolve to solar_plants.id
  const enrichedAlerts = alerts.map((alert) => {
    const resolvedPlantId = monitorPlantMapping.get(alert.plant_id) ?? alert.plant_id;
    const plant = plantMap.get(resolvedPlantId);
    const locKey = `${plant?.lat ?? "null"}_${plant?.lng ?? "null"}`;
    const hspResult = hspMap.get(locKey);
    const hspValue = hspResult?.hsp_kwh_m2 ?? null;
    const hspSource = hspResult?.source ?? "unavailable";

    const hasEnergy = (plant?.health?.energy_today_kwh ?? 0) > 0;
    const hasCapacity = (plant?.installed_power_kwp ?? 0) > 0;
    const hasHsp = hspValue != null && hspValue > 0;

    // Determine real pr_status
    let prStatus: string = "ok";
    if (!hasCapacity) prStatus = "config_required";
    else if (!hasHsp) prStatus = "irradiation_unavailable";
    else if (!hasEnergy) prStatus = "no_data";

    const confidence = calcConfidenceScore({
      energyKwh: hasEnergy ? plant!.health!.energy_today_kwh : null,
      capacityKwp: plant?.installed_power_kwp ?? null,
      hspValue,
      hspSource,
      dayIsClosed: true,
      unitIsKwh: true,
    });

    const isOffline = alert.type === "offline";
    const isZeroGen = !hasEnergy;

    const classification = classifyAlert({
      confidenceScore: confidence.total,
      prStatus,
      deviationPercent: 0,
      consecutiveDays: 1,
      isOffline,
      isZeroGenWithHighHsp: isZeroGen && hasHsp,
    });

    return { ...alert, plant, confidence, classification };
  });

  // Apply layer filter
  const filteredAlerts = filterLayer === "all"
    ? enrichedAlerts
    : enrichedAlerts.filter((a) => a.classification.layer === filterLayer);

  if (isLoading) return <LoadingState message="Carregando alertas..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Alertas"
        description="Monitore e gerencie alertas das usinas"
        icon={AlertTriangle}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/monitoramento/entenda-alertas")}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Entenda os alertas
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/50 w-fit">
          <FilterPill active={filterOpen === true} onClick={() => setFilterOpen(filterOpen === true ? undefined : true)}>
            Abertos
          </FilterPill>
          <FilterPill active={filterOpen === false} onClick={() => setFilterOpen(filterOpen === false ? undefined : false)}>
            Fechados
          </FilterPill>
          <div className="w-px h-6 bg-border/60 self-center mx-1" />
          {(["all", "critical", "warn", "info"] as const).map((sev) => (
            <FilterPill key={sev} active={filterSeverity === sev} onClick={() => setFilterSeverity(sev)}>
              {sev === "all" ? "Todas" : SEVERITY_LABELS[sev] || sev}
            </FilterPill>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-muted/30 border border-border/50 w-fit">
          {(["all", "internal", "preventive", "urgent"] as const).map((layer) => (
            <FilterPill key={layer} active={filterLayer === layer} onClick={() => setFilterLayer(layer)}>
              {layer === "all" ? "Todas camadas" : LAYER_LABELS[layer]?.label || layer}
            </FilterPill>
          ))}
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Nenhum alerta encontrado"
          description="Ajuste os filtros ou aguarde a próxima sincronização."
        />
      ) : (
        <SectionCard title={`${filteredAlerts.length} alertas`} icon={AlertTriangle} variant="warning" noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground text-xs">
                  <th className="text-left px-4 py-3 font-medium">Severidade</th>
                  <th className="text-left px-4 py-3 font-medium">Camada</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Usina</th>
                  <th className="text-left px-4 py-3 font-medium">Título</th>
                  <th className="text-left px-4 py-3 font-medium">Confiança</th>
                  <th className="text-left px-4 py-3 font-medium">Tempo aberto</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-right px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredAlerts.map((alert) => {
                  const layerInfo = LAYER_LABELS[alert.classification.layer];
                  return (
                    <tr key={alert.id} className="border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <StatusBadge status={SEVERITY_LABELS[alert.severity] || alert.severity} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger>
                            <span className={cn("text-xs font-medium", layerInfo?.color)}>
                              {layerInfo?.label}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs max-w-[200px]">{alert.classification.reason}</p>
                          </TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {TYPE_LABELS[alert.type] || alert.type}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground">
                        {alert.plant?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground max-w-[200px] truncate">
                        {alert.title}
                      </td>
                      <td className="px-4 py-3">
                        <Tooltip>
                          <TooltipTrigger>
                            <div className="flex items-center gap-1.5">
                              {alert.confidence.total >= 80 ? (
                                <ShieldCheck className="h-3.5 w-3.5 text-success" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                              )}
                              <span className="text-xs font-mono">{alert.confidence.total}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-xs space-y-1">
                              <p>Energia: {alert.confidence.energy_valid ? "✅" : "❌"} (+30)</p>
                              <p>Capacidade: {alert.confidence.capacity_valid ? "✅" : "❌"} (+25)</p>
                              <p>HSP: {alert.confidence.hsp_available ? "✅" : "❌"} (+25)</p>
                              <p>Timezone: {alert.confidence.timezone_ok ? "✅" : "❌"} (+10)</p>
                              <p>Unidade: {alert.confidence.unit_validated ? "✅" : "❌"} (+10)</p>
                            </div>
                          </TooltipContent>
                        </Tooltip>
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
                          className="h-7 w-7 p-0"
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

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200",
        active
          ? "bg-card text-foreground shadow-sm border border-border/60"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}
