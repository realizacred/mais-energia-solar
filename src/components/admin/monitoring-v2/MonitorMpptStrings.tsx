import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Cpu, Zap, AlertTriangle, BarChart3, RefreshCw, ShieldCheck,
  Activity, WifiOff, CheckCircle2, Clock, Radio, Server,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { listPlantsWithHealth, listDevices } from "@/services/monitoring/monitorService";
import {
  isMpptStringEnabled,
  getDeviceStringCards,
  listStringAlerts,
  recalculateBaseline,
} from "@/services/monitoring/mpptStringService";
import type { DeviceStringCard, StringAlert, StringRegistryWithMetric } from "@/services/monitoring/mpptStringTypes";
import type { PlantWithHealth, MonitorDevice } from "@/services/monitoring/monitorTypes";
import { motion, AnimatePresence } from "framer-motion";
import {
  deriveDeviceStatus, resolveHealthToUiStatus, formatRelativeSeenAt, getDeviceSsotTimestamp,
  DEVICE_STATUS_LABELS, DEVICE_STATUS_DOT,
} from "@/services/monitoring/plantStatusEngine";
import { DataOriginBadge, DataOriginLegend } from "./ui/DataOriginBadge";

/* ═══════════════════════════════════════════
   Device status resolver — SSOT via deriveDeviceStatus()
═══════════════════════════════════════════ */

function DeviceStatusIndicator({ deviceStatus, devices, deviceId }: {
  deviceStatus: string;
  devices?: MonitorDevice[];
  deviceId?: string;
}) {
  const device = devices?.find((d) => d.id === deviceId);
  const deviceSeenAt = device ? getDeviceSsotTimestamp(device) : null;
  const derived = deriveDeviceStatus({
    rawStatus: deviceStatus,
    lastSeenAt: deviceSeenAt,
  });
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2.5 w-2.5 rounded-full", DEVICE_STATUS_DOT[derived.status])} />
      <span className="text-xs font-medium text-muted-foreground">{DEVICE_STATUS_LABELS[derived.status]}</span>
      {deviceSeenAt && (
        <span className="text-[10px] text-muted-foreground">
          ({formatRelativeSeenAt(deviceSeenAt, { addSuffix: true })})
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   Status helpers
═══════════════════════════════════════════ */

const ALERT_BADGE: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  ok:       { bg: "bg-success/10", text: "text-success", label: "Normal", dot: "bg-success" },
  warn:     { bg: "bg-warning/10", text: "text-warning", label: "Baixa", dot: "bg-warning" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", label: "Parada", dot: "bg-destructive" },
  unknown:  { bg: "bg-muted", text: "text-muted-foreground", label: "—", dot: "bg-muted-foreground" },
};

/* ═══════════════════════════════════════════
   Main Component
═══════════════════════════════════════════ */

export default function MonitorMpptStrings() {
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [tab, setTab] = useState<"strings" | "baseline" | "alerts">("strings");
  const [recalculating, setRecalculating] = useState(false);

  const { data: enabled, isLoading: loadingFlag } = useQuery({
    queryKey: ["mppt-string-feature-flag"],
    queryFn: isMpptStringEnabled,
  });

  const { data: plants = [], isLoading: loadingPlants } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
    enabled: !!enabled,
  });

  const activePlant = selectedPlantId || plants[0]?.id;
  const activePlantData = plants.find((p) => p.id === activePlant);

  const { data: devices = [] } = useQuery({
    queryKey: ["monitor-devices", activePlant],
    queryFn: () => listDevices(activePlant!),
    enabled: !!activePlant && !!enabled,
  });

  const { data: cards = [], isLoading: loadingCards } = useQuery({
    queryKey: ["mppt-string-cards", activePlant],
    queryFn: () => getDeviceStringCards(activePlant!, devices),
    enabled: !!activePlant && devices.length > 0 && !!enabled,
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ["mppt-string-alerts", activePlant],
    queryFn: () => listStringAlerts({ plantId: activePlant }),
    enabled: !!activePlant && !!enabled,
  });

  const openAlertCount = allAlerts.filter((a) => a.status === "open").length;

  const handleRecalculate = async () => {
    if (!activePlant || recalculating) return;
    setRecalculating(true);
    try {
      const result = await recalculateBaseline(activePlant);
      if (result.updated === 0) {
        toast.info("Nenhuma string com dados suficientes para calibração (mínimo 5 leituras). Aguarde mais ciclos de sincronização.");
      } else {
        toast.success(`Baseline recalculado para ${result.updated} strings`);
      }
    } catch (err) {
      console.error("[handleRecalculate]", err);
      toast.error("Erro ao recalcular baseline. Verifique se há dados de geração suficientes.");
    } finally {
      setRecalculating(false);
    }
  };

  if (loadingFlag || loadingPlants) return <LoadingState message="Carregando..." />;

  if (!enabled) {
    return (
      <EmptyState
        icon={ShieldCheck}
        title="Recurso não habilitado"
        description="O monitoramento de MPPT/Strings ainda não está ativado para a sua empresa. Entre em contato com o suporte."
      />
    );
  }

  const uiStatus = activePlantData ? resolveHealthToUiStatus(activePlantData.health?.status) : "offline";
  const isOffline = uiStatus === "offline";

  return (
    <div className="space-y-5">
      {/* ─── Plant selector pills ─── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {plants.map((p) => {
          const isActive = activePlant === p.id;
          const pStatus = resolveHealthToUiStatus(p.health?.status);
          return (
            <button
              key={p.id}
              onClick={() => setSelectedPlantId(p.id)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all border",
                isActive
                  ? "bg-card text-foreground border-border shadow-sm"
                  : "text-muted-foreground border-transparent hover:text-foreground hover:bg-card/60"
              )}
            >
              <span className={cn(
                "h-2 w-2 rounded-full shrink-0",
                pStatus === "online" ? "bg-success" : pStatus === "standby" ? "bg-warning" : "bg-destructive"
              )} />
              {p.name}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════
          DUAL-PANE HEADER: SSOT + RAW
      ═══════════════════════════════════════════ */}
      {activePlantData && (
        <DualPaneHeader
          plant={activePlantData}
          devices={devices}
          cards={cards}
          openAlerts={openAlertCount}
          isOffline={isOffline}
        />
      )}

      {/* ─── Tabs ─── */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/40 w-fit">
        {([
          { key: "strings" as const, label: "MPPT & Strings", icon: Cpu },
          { key: "baseline" as const, label: "Baseline", icon: BarChart3 },
          { key: "alerts" as const, label: `Alertas${openAlertCount > 0 ? ` (${openAlertCount})` : ""}`, icon: AlertTriangle },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className={cn("h-3.5 w-3.5", t.key === "alerts" && openAlertCount > 0 && "text-destructive")} />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Content ─── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
        >
          {loadingCards ? (
            <LoadingState message="Carregando strings..." />
          ) : tab === "strings" ? (
            <StringsTab cards={cards} devices={devices} isOffline={isOffline} />
          ) : tab === "baseline" ? (
            <BaselineTab cards={cards} onRecalculate={handleRecalculate} recalculating={recalculating} />
          ) : (
            <AlertsTab alerts={allAlerts} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ─── Footer Legend ─── */}
      <DataOriginLegend />
    </div>
  );
}

/* ═══════════════════════════════════════════
   DUAL-PANE HEADER (SSOT vs RAW)
═══════════════════════════════════════════ */

function DualPaneHeader({
  plant, devices, cards, openAlerts, isOffline,
}: {
  plant: PlantWithHealth;
  devices: MonitorDevice[];
  cards: DeviceStringCard[];
  openAlerts: number;
  isOffline: boolean;
}) {
  const inverters = devices.filter((d) => d.type === "inverter");
  const firstInverter = inverters[0];
  const health = plant.health;
  const uiStatus = resolveHealthToUiStatus(health?.status);

  const totalStrings = cards.reduce((s, c) => s + c.strings.length, 0);
  const calibratedStrings = cards.reduce(
    (s, c) => s + c.strings.filter((st) => st.baseline_day).length, 0
  );

  // RAW data from inverter metadata
  const inverterMeta = firstInverter?.metadata as Record<string, unknown> | undefined;
  const rawEtoday = inverterMeta?.etoday != null ? Number(inverterMeta.etoday) : null;
  const rawPower = inverterMeta?.pac != null ? Number(inverterMeta.pac) : (inverterMeta?.power != null ? Number(inverterMeta.power) : null);
  const rawPowerKw = rawPower != null ? (rawPower > 1000 ? rawPower / 1000 : rawPower) : null;
  const providerStatus = (firstInverter?.status as string) || "—";

  const statusConfig: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    online:  { label: "Online", bg: "bg-success/10", text: "text-success", dot: "bg-success" },
    standby: { label: "Standby", bg: "bg-warning/10", text: "text-warning", dot: "bg-warning" },
    offline: { label: "Offline", bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive" },
  };
  const sc = statusConfig[uiStatus] || statusConfig.offline;

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden">
      {/* Plant name row */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border/30 bg-muted/20">
        <div>
          <h2 className="text-lg font-bold text-foreground">{plant.name}</h2>
          {firstInverter && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {firstInverter.model || "Inversor"} • Serial: {firstInverter.serial || "—"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-xl", sc.bg)}>
            <span className={cn("h-2.5 w-2.5 rounded-full", sc.dot)} />
            <span className={cn("text-sm font-bold", sc.text)}>{sc.label}</span>
          </div>
          {openAlerts > 0 && (
            <span className="px-3 py-1.5 rounded-xl bg-destructive/10 text-destructive text-xs font-bold">
              {openAlerts} alerta{openAlerts > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Dual-pane metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border/30">
        {/* LEFT: SSOT (System consolidated) */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Status do Sistema</span>
            <DataOriginBadge type="ssot" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <MetricItem
              icon={Activity}
              label="Energia Hoje"
              value={health?.energy_today_kwh ? `${Number(health.energy_today_kwh.toFixed(1))} kWh` : "0 kWh"}
              origin="ssot"
            />
            <MetricItem
              icon={Zap}
              label="Potência Atual"
              value={health?.current_power_kw ? `${Number(health.current_power_kw.toFixed(2))} kW` : "0 kW"}
              origin="ssot"
            />
            <MetricItem
              icon={Server}
              label="Inversores"
              value={`${inverters.length}`}
              origin="ssot"
            />
            <MetricItem
              icon={Cpu}
              label="Strings"
              value={`${totalStrings}`}
              origin="ssot"
            />
          </div>
          {/* Status checklist */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <StatusCheckItem
              ok={health?.last_seen_at != null}
              label={health?.last_seen_at
                ? `Sync: ${formatRelativeSeenAt(health.last_seen_at)}`
                : "Sem sincronização"
              }
            />
            <StatusCheckItem
              ok={calibratedStrings > 0}
              label={calibratedStrings > 0
                ? `Baseline: ${calibratedStrings}/${totalStrings}`
                : "Aguardando calibração"
              }
              pending={calibratedStrings === 0 && totalStrings > 0}
            />
          </div>
        </div>

        {/* RIGHT: RAW (Inverter provider data) */}
        <div className={cn("p-5 space-y-3 transition-opacity", isOffline && "opacity-60")}>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-xs font-bold text-foreground uppercase tracking-wider">Dados do Inversor</span>
            <DataOriginBadge type="raw" />
          </div>

          {isOffline && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/20 mb-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
              <span className="text-[11px] text-warning font-medium">Dados do provedor podem estar desatualizados.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <MetricItem
              icon={Activity}
              label="Energia Inversor"
              value={rawEtoday != null ? `${rawEtoday.toFixed(1)} kWh` : "—"}
              origin="raw"
            />
            <MetricItem
              icon={Zap}
              label="Potência Inversor"
              value={rawPowerKw != null ? `${rawPowerKw.toFixed(2)} kW` : "—"}
              origin="raw"
            />
            <MetricItem
              icon={Radio}
              label="Status Provedor"
              value={providerStatus}
              origin="raw"
            />
            <MetricItem
              icon={Cpu}
              label="Modelo"
              value={firstInverter?.model || "—"}
              origin="raw"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Small reusable sub-components
═══════════════════════════════════════════ */

function MetricItem({ icon: Icon, label, value, origin }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  origin: "ssot" | "raw";
}) {
  return (
    <div className="flex items-center gap-2.5 bg-muted/30 rounded-xl px-3 py-2.5">
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
        origin === "ssot" ? "bg-primary/10" : "bg-muted"
      )}>
        <Icon className={cn("h-4 w-4", origin === "ssot" ? "text-primary" : "text-muted-foreground")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold text-foreground leading-tight truncate">{value}</p>
        <p className="text-[10px] text-muted-foreground leading-none">{label}</p>
      </div>
    </div>
  );
}

function StatusCheckItem({ ok, label, pending }: { ok: boolean; label: string; pending?: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {pending ? (
        <Clock className="h-3.5 w-3.5 text-warning shrink-0" />
      ) : ok ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
      ) : (
        <WifiOff className="h-3.5 w-3.5 text-destructive shrink-0" />
      )}
      <span className={cn(
        "truncate",
        pending ? "text-warning" : ok ? "text-foreground" : "text-destructive"
      )}>
        {label}
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   STRINGS TAB
═══════════════════════════════════════════ */

function StringsTab({ cards, devices, isOffline }: { cards: DeviceStringCard[]; devices: MonitorDevice[]; isOffline: boolean }) {
  if (cards.length === 0) {
    return <MonitoringAwaitingState />;
  }

  return (
    <div className="space-y-5">
      {cards.map((card) => {
        const mpptGroups = new Map<number, StringRegistryWithMetric[]>();
        const ungrouped: StringRegistryWithMetric[] = [];

        card.strings.forEach((s) => {
          if (s.mppt_number) {
            const arr = mpptGroups.get(s.mppt_number) || [];
            arr.push(s);
            mpptGroups.set(s.mppt_number, arr);
          } else {
            ungrouped.push(s);
          }
        });

        const sortedMppts = Array.from(mpptGroups.entries()).sort((a, b) => a[0] - b[0]);

        return (
          <div key={card.device_id} className={cn(
            "rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm transition-opacity",
            isOffline && "opacity-60"
          )}>
            {/* Device header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/30 bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/8 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">
                      {card.device_model || "Inversor"}
                    </h3>
                    <DataOriginBadge type="raw" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Serial: {card.device_serial || "—"} • Dados de string (raw do provedor)
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <DeviceStatusIndicator deviceStatus={card.device_status} devices={devices} deviceId={card.device_id} />
                {card.open_alerts.length > 0 && (
                  <span className="px-2.5 py-1 rounded-lg bg-destructive/10 text-destructive text-[11px] font-bold">
                    {card.open_alerts.length} alerta{card.open_alerts.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>

            {isOffline && (
              <div className="flex items-center gap-2 px-5 py-2 bg-warning/5 border-b border-warning/20">
                <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
                <span className="text-[11px] text-warning font-medium">Dados do provedor podem estar desatualizados.</span>
              </div>
            )}

            {/* MPPT groups */}
            <div className="p-4 space-y-4">
              {card.strings.length === 0 ? (
                <div className="text-center py-6">
                  <Clock className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Aguardando sincronização de dados...</p>
                </div>
              ) : (
                <>
                  {sortedMppts.map(([mpptNum, strings]) => (
                    <div key={mpptNum}>
                      <div className="flex items-center gap-2 mb-2.5">
                        <div className="h-5 w-5 rounded-md bg-primary/8 flex items-center justify-center">
                          <Zap className="h-3 w-3 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-foreground uppercase tracking-wide">
                          MPPT {mpptNum}
                        </span>
                        <div className="flex-1 h-px bg-border/40" />
                        <span className="text-[10px] text-muted-foreground">
                          {strings.length} string{strings.length > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                        {strings.map((s) => (
                          <StringCell key={s.id} entry={s} isSystemOnline={!isOffline} />
                        ))}
                      </div>
                    </div>
                  ))}

                  {ungrouped.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2.5">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                          Strings
                        </span>
                        <div className="flex-1 h-px bg-border/40" />
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5">
                        {ungrouped.map((s) => (
                          <StringCell key={s.id} entry={s} isSystemOnline={!isOffline} />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Monitoring Awaiting State ─── */

function MonitoringAwaitingState() {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
      <div className="text-center max-w-md mx-auto space-y-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto">
          <Radio className="h-7 w-7 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Monitoramento MPPT aguardando dados</h3>
          <p className="text-sm text-muted-foreground mt-1">
            O sistema registrará automaticamente MPPTs e Strings após a próxima sincronização.
          </p>
        </div>
        <div className="space-y-2 text-left bg-muted/30 rounded-xl p-4">
          <StatusCheckItem ok={true} label="Integração ativa" />
          <StatusCheckItem ok={true} label="API conectada" />
          <StatusCheckItem ok={false} pending={true} label="Aguardando primeira coleta válida" />
          <StatusCheckItem ok={true} label="Alertas habilitados" />
        </div>
      </div>
    </div>
  );
}

/* ─── String Cell (enhanced with origin badge + offline awareness) ─── */

function StringCell({ entry, isSystemOnline }: { entry: StringRegistryWithMetric; isSystemOnline: boolean }) {
  const badge = ALERT_BADGE[entry.alert_status || "unknown"];
  const label = entry.string_number ? `S${entry.string_number}` : "Inversor";

  const powerVal = entry.latest_power_w;
  const baselinePct = entry.baseline_pct;

  // String stopped while system online = yellow warning
  const isStoppedWhileOnline = isSystemOnline && powerVal != null && powerVal === 0 && entry.alert_status !== "unknown";

  return (
    <div
      className={cn(
        "rounded-xl border p-3 transition-all hover:shadow-sm hover:-translate-y-0.5 cursor-default relative",
        entry.alert_status === "ok" ? "border-success/25 bg-success/5" :
        entry.alert_status === "critical" ? "border-destructive/25 bg-destructive/5" :
        entry.alert_status === "warn" ? "border-warning/25 bg-warning/5" :
        "border-border/40 bg-muted/15"
      )}
      title={isStoppedWhileOnline ? "Inversor online, mas string sem geração." : "Baseado em dados diretos do inversor."}
    >
      {/* Label + status dot + warning icon */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
          {isStoppedWhileOnline && (
            <AlertTriangle className="h-3 w-3 text-warning" />
          )}
          <span className={cn("h-2 w-2 rounded-full", badge.dot)} />
        </div>
      </div>

      {/* Power value */}
      <p className={cn("text-lg font-bold leading-tight", badge.text)}>
        {powerVal !== null && powerVal !== undefined ? `${powerVal}` : "—"}
        <span className="text-xs font-medium ml-0.5">W</span>
      </p>

      {/* Baseline % */}
      {baselinePct !== null && baselinePct !== undefined && (
        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">vs base</span>
            <span className={cn("text-[10px] font-bold", badge.text)}>
              {baselinePct.toFixed(0)}%
            </span>
          </div>
          <Progress value={Math.min(baselinePct, 100)} className="h-1" />
        </div>
      )}

      {/* Status badge */}
      <div className="mt-2">
        <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold", badge.bg, badge.text)}>
          {badge.label}
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   BASELINE TAB
═══════════════════════════════════════════ */

function BaselineTab({
  cards, onRecalculate, recalculating,
}: {
  cards: DeviceStringCard[];
  onRecalculate: () => void;
  recalculating: boolean;
}) {
  const allStrings = cards.flatMap((c) =>
    c.strings.map((s) => ({
      ...s,
      deviceModel: c.device_model,
      deviceSerial: c.device_serial,
    }))
  );
  const withBaseline = allStrings.filter((s) => s.baseline_day);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-card px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-primary/8 flex items-center justify-center">
            <BarChart3 className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {withBaseline.length}/{allStrings.length} strings calibradas
            </p>
            <p className="text-[11px] text-muted-foreground">
              Baseline calculado automaticamente após 5 leituras válidas
            </p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={onRecalculate}
          disabled={recalculating}
          className="gap-1.5 rounded-xl"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", recalculating && "animate-spin")} />
          {recalculating ? "Recalculando..." : "Recalcular"}
        </Button>
      </div>

      {withBaseline.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum baseline definido"
          description="O baseline será calculado automaticamente após acumular dados suficientes de geração."
        />
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 border-b border-border/30">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">MPPT · String</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">P50 (W)</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Média (W)</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">P90 (W)</th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Calibração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/20">
              {withBaseline.map((s) => (
                <tr key={s.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-semibold text-foreground">
                      {s.string_number ? `MPPT ${s.mppt_number || "?"} · S${s.string_number}` : "Inversor"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-foreground">
                    {s.baseline_power_p50_w?.toFixed(0) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {s.baseline_power_avg_w?.toFixed(0) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">
                    {s.baseline_power_p90_w?.toFixed(0) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {s.baseline_day || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════
   ALERTS TAB
═══════════════════════════════════════════ */

function AlertsTab({ alerts }: { alerts: StringAlert[] }) {
  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status === "resolved");

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30 bg-muted/20">
          <AlertTriangle className={cn("h-4 w-4", open.length > 0 ? "text-destructive" : "text-muted-foreground")} />
          <span className="text-sm font-bold text-foreground">
            Alertas Abertos ({open.length})
          </span>
        </div>
        <div className="p-4">
          {open.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle2 className="h-10 w-10 text-success/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum alerta aberto 🎉</p>
            </div>
          ) : (
            <div className="space-y-2">
              {open.map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
            </div>
          )}
        </div>
      </div>

      {resolved.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border/30 bg-muted/20">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm font-bold text-foreground">
              Resolvidos ({resolved.length})
            </span>
          </div>
          <div className="p-4 space-y-2">
            {resolved.slice(0, 20).map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: StringAlert }) {
  const isOpen = alert.status === "open";
  const isCritical = alert.severity === "critical";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3.5 rounded-xl border transition-colors",
        isOpen && isCritical && "border-l-[3px] border-l-destructive border-destructive/20 bg-destructive/5",
        isOpen && !isCritical && "border-l-[3px] border-l-warning border-warning/20 bg-warning/5",
        !isOpen && "border-border/30 bg-muted/10"
      )}
    >
      <AlertTriangle
        className={cn(
          "h-4 w-4 mt-0.5 shrink-0",
          isCritical ? "text-destructive" : isOpen ? "text-warning" : "text-muted-foreground"
        )}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{alert.message}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted-foreground">
          <span className="font-medium">{alert.alert_type.replace(/_/g, " ")}</span>
          <span>•</span>
          <span>{new Date(alert.detected_at).toLocaleString("pt-BR")}</span>
          {alert.resolved_at && (
            <>
              <span>•</span>
              <span className="text-success font-medium">
                Resolvido: {new Date(alert.resolved_at).toLocaleString("pt-BR")}
              </span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0",
          isCritical ? "bg-destructive/10 text-destructive" : "bg-warning/10 text-warning"
        )}
      >
        {isCritical ? "Crítico" : "Atenção"}
      </span>
    </div>
  );
}
