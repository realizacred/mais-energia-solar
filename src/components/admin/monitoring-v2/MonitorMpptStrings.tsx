import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Button } from "@/components/ui/button";
import { Cpu, Zap, AlertTriangle, BarChart3, RefreshCw, ShieldCheck } from "lucide-react";
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
import type { PlantWithHealth } from "@/services/monitoring/monitorTypes";

// ═══ Status helpers ═══

const ALERT_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  ok: { bg: "bg-success/10", text: "text-success", label: "OK" },
  warn: { bg: "bg-warning/10", text: "text-warning", label: "Baixa" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", label: "Parada" },
  unknown: { bg: "bg-muted", text: "text-muted-foreground", label: "—" },
};

// ═══ Main component ═══

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

  const handleRecalculate = async () => {
    if (!activePlant || recalculating) return;
    setRecalculating(true);
    try {
      const result = await recalculateBaseline(activePlant);
      toast.success(`Baseline recalculado para ${result.updated} strings`);
    } catch {
      toast.error("Erro ao recalcular baseline");
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

  return (
    <div className="space-y-5">
      {/* Plant selector */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {plants.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPlantId(p.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all border",
              activePlant === p.id
                ? "bg-card text-foreground border-border shadow-sm"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-card/50"
            )}
          >
            {p.name}
          </button>
        ))}
      </div>

      {/* Tabs: Strings | Baseline | Alertas */}
      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-muted/50 border border-border/50 w-fit">
        {([
          { key: "strings", label: "MPPT & Strings", icon: Cpu },
          { key: "baseline", label: "Baseline", icon: BarChart3 },
          { key: "alerts", label: `Alertas (${allAlerts.filter((a) => a.status === "open").length})`, icon: AlertTriangle },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loadingCards ? (
        <LoadingState message="Carregando strings..." />
      ) : tab === "strings" ? (
        <StringsTab cards={cards} />
      ) : tab === "baseline" ? (
        <BaselineTab cards={cards} onRecalculate={handleRecalculate} recalculating={recalculating} />
      ) : (
        <AlertsTab alerts={allAlerts} />
      )}
    </div>
  );
}

// ═══ Strings Tab ═══

function StringsTab({ cards }: { cards: DeviceStringCard[] }) {
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={Cpu}
        title="Nenhum inversor com dados de string"
        description="Sincronize a usina para começar a registrar dados MPPT/String."
      />
    );
  }

  return (
    <div className="space-y-4">
      {cards.map((card) => (
        <SectionCard
          key={card.device_id}
          title={card.device_model || "Inversor"}
          icon={Cpu}
          description={card.device_serial || undefined}
          actions={
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  card.device_status === "online" ? "bg-success" : "bg-destructive"
                )}
              />
              <span className="text-xs font-medium text-muted-foreground">
                {card.device_status === "online" ? "Online" : "Offline"}
              </span>
              {card.open_alerts.length > 0 && (
                <span className="ml-2 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-bold">
                  {card.open_alerts.length} alerta{card.open_alerts.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
          }
        >
          {card.strings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma string registrada. Aguardando sincronização.
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {card.strings.map((s) => (
                <StringCell key={s.id} entry={s} />
              ))}
            </div>
          )}
        </SectionCard>
      ))}
    </div>
  );
}

function StringCell({ entry }: { entry: StringRegistryWithMetric }) {
  const badge = ALERT_BADGE[entry.alert_status || "unknown"];
  const label = entry.string_number
    ? `${entry.mppt_number ? `MPPT ${entry.mppt_number} ·` : ""} S${entry.string_number}`
    : "Inversor";

  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5 text-center transition-colors",
        entry.alert_status === "ok" ? "border-success/30 bg-success/5" :
        entry.alert_status === "critical" ? "border-destructive/30 bg-destructive/5" :
        entry.alert_status === "warn" ? "border-warning/30 bg-warning/5" :
        "border-border/50 bg-muted/20"
      )}
    >
      <p className="text-[10px] text-muted-foreground font-medium">{label}</p>
      <p className={cn("text-sm font-bold", badge.text)}>
        {entry.latest_power_w !== null ? `${entry.latest_power_w} W` : "— W"}
      </p>
      {entry.baseline_pct !== null && (
        <p className="text-[10px] text-muted-foreground">{entry.baseline_pct.toFixed(0)}% base</p>
      )}
      <span className={cn("inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold", badge.bg, badge.text)}>
        {badge.label}
      </span>
    </div>
  );
}

// ═══ Baseline Tab ═══

function BaselineTab({
  cards,
  onRecalculate,
  recalculating,
}: {
  cards: DeviceStringCard[];
  onRecalculate: () => void;
  recalculating: boolean;
}) {
  const allStrings = cards.flatMap((c) => c.strings);
  const withBaseline = allStrings.filter((s) => s.baseline_day);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {withBaseline.length}/{allStrings.length} strings com baseline definido
        </p>
        <Button size="sm" variant="outline" onClick={onRecalculate} disabled={recalculating} className="gap-1.5">
          <RefreshCw className={cn("h-3.5 w-3.5", recalculating && "animate-spin")} />
          {recalculating ? "Recalculando..." : "Recalcular Baseline"}
        </Button>
      </div>

      {withBaseline.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Nenhum baseline definido"
          description="O baseline será calculado automaticamente após acumular dados suficientes de geração."
        />
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/30">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">String</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">P50 (W)</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Média (W)</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">P90 (W)</th>
                <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {withBaseline.map((s) => (
                <tr key={s.id} className="hover:bg-muted/10">
                  <td className="px-3 py-2 font-medium">
                    {s.string_number ? `MPPT ${s.mppt_number || "?"} · S${s.string_number}` : "Inversor"}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{s.baseline_power_p50_w?.toFixed(0) || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.baseline_power_avg_w?.toFixed(0) || "—"}</td>
                  <td className="px-3 py-2 text-right font-mono">{s.baseline_power_p90_w?.toFixed(0) || "—"}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{s.baseline_day || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ═══ Alerts Tab ═══

function AlertsTab({ alerts }: { alerts: StringAlert[] }) {
  const open = alerts.filter((a) => a.status === "open");
  const resolved = alerts.filter((a) => a.status === "resolved");

  return (
    <div className="space-y-4">
      <SectionCard title={`Abertos (${open.length})`} icon={AlertTriangle} variant="warning">
        {open.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta aberto 🎉</p>
        ) : (
          <div className="space-y-2">
            {open.map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        )}
      </SectionCard>

      {resolved.length > 0 && (
        <SectionCard title={`Resolvidos (${resolved.length})`} icon={ShieldCheck}>
          <div className="space-y-2">
            {resolved.slice(0, 20).map((a) => (
              <AlertRow key={a.id} alert={a} />
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function AlertRow({ alert }: { alert: StringAlert }) {
  const isOpen = alert.status === "open";
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        isOpen ? "border-warning/30 bg-warning/5" : "border-border/40 bg-muted/10"
      )}
    >
      <AlertTriangle
        className={cn("h-4 w-4 mt-0.5 shrink-0", isOpen ? "text-warning" : "text-muted-foreground")}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{alert.message}</p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span>Tipo: {alert.alert_type.replace("_", " ")}</span>
          <span>•</span>
          <span>{new Date(alert.detected_at).toLocaleString("pt-BR")}</span>
          {alert.resolved_at && (
            <>
              <span>•</span>
              <span className="text-success">Resolvido: {new Date(alert.resolved_at).toLocaleString("pt-BR")}</span>
            </>
          )}
        </div>
      </div>
      <span
        className={cn(
          "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
          alert.severity === "critical"
            ? "bg-destructive/10 text-destructive"
            : "bg-warning/10 text-warning"
        )}
      >
        {alert.severity === "critical" ? "Crítico" : "Atenção"}
      </span>
    </div>
  );
}
