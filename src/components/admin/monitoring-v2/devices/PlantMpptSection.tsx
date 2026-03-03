/**
 * PlantMpptSection — MPPT/String data embedded in the plant detail page.
 * Shows string-level power data from monitor_string_registry.
 */
import React, { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Cpu, Zap, AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  isMpptStringEnabled,
  getDeviceStringCards,
  recalculateBaseline,
} from "@/services/monitoring/mpptStringService";
import type { MonitorDevice } from "@/services/monitoring/monitorTypes";
import type { DeviceStringCard, StringRegistryWithMetric } from "@/services/monitoring/mpptStringTypes";

// ─── Alert badge styles ───
const ALERT_BADGE: Record<string, { bg: string; text: string; label: string; dot: string }> = {
  ok:       { bg: "bg-success/10", text: "text-success", label: "Normal", dot: "bg-success" },
  warn:     { bg: "bg-warning/10", text: "text-warning", label: "Baixa", dot: "bg-warning" },
  critical: { bg: "bg-destructive/10", text: "text-destructive", label: "Parada", dot: "bg-destructive" },
  unknown:  { bg: "bg-muted", text: "text-muted-foreground", label: "—", dot: "bg-muted-foreground" },
};

interface PlantMpptSectionProps {
  plantId: string;
  devices: MonitorDevice[];
  isOffline: boolean;
}

export function PlantMpptSection({ plantId, devices, isOffline }: PlantMpptSectionProps) {
  const queryClient = useQueryClient();
  const [recalculating, setRecalculating] = useState(false);

  const { data: enabled } = useQuery({
    queryKey: ["mppt-string-feature-flag"],
    queryFn: isMpptStringEnabled,
    staleTime: 60_000,
  });

  const deviceIds = devices.map(d => d.id).sort().join(",");
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["mppt-string-cards", plantId, deviceIds],
    queryFn: () => getDeviceStringCards(plantId, devices),
    enabled: !!enabled && devices.length > 0,
  });
  // Also fall back to normalizer if registry is empty but devices have metadata
  const hasAnyInverter = devices.some((d) => d.type === "inverter");
  if (!enabled || isLoading) return null;
  if (!hasAnyInverter) return null;

  const totalStrings = cards.reduce((s, c) => s + c.strings.length, 0);

  const handleRecalculate = async () => {
    if (recalculating) return;
    setRecalculating(true);
    try {
      const result = await recalculateBaseline(plantId);
      queryClient.invalidateQueries({ queryKey: ["mppt-string-cards", plantId] });
      if (result.updated === 0) {
        toast.info("Sem dados suficientes para calibração (mínimo 5 leituras válidas).");
      } else {
        toast.success(`Baseline recalculado para ${result.updated} strings`);
      }
    } catch (err: any) {
      console.error("[PlantMpptSection] recalculate error:", err);
      toast.error(err?.message || "Erro ao recalcular baseline");
    } finally {
      setRecalculating(false);
    }
  };

  const calibrated = cards.reduce(
    (s, c) => s + c.strings.filter((st) => st.baseline_day).length, 0
  );

  return (
    <SectionCard
      title={`MPPT & Strings (${totalStrings})`}
      icon={Cpu}
      variant="blue"
      actions={
        <Button
          size="sm"
          variant="outline"
          onClick={handleRecalculate}
          disabled={recalculating}
          className="gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", recalculating && "animate-spin")} />
          {recalculating ? "Recalculando..." : "Recalcular Baseline"}
        </Button>
      }
    >
      {totalStrings === 0 ? (
        <div className="text-center py-6">
          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Aguardando dados de strings</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            O baseline será calculado automaticamente após 5 leituras válidas
          </p>
        </div>
      ) : (
        <>
          {/* Baseline summary */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
            {calibrated > 0 ? (
              <span className="font-medium">
                {calibrated}/{totalStrings} strings calibradas
              </span>
            ) : (
              <span className="font-medium text-muted-foreground/70">
                Dados em tempo real • Baseline será calculado após 5 leituras
              </span>
            )}
          </div>

          {/* Device cards */}
          <div className="space-y-4">
            {cards.map((card) => (
              <DeviceStringsCard key={card.device_id} card={card} isOffline={isOffline} />
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

function DeviceStringsCard({ card, isOffline }: { card: DeviceStringCard; isOffline: boolean }) {
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

  if (card.strings.length === 0) {
    return (
      <div className="text-center py-4">
        <Clock className="h-6 w-6 text-muted-foreground/40 mx-auto mb-1" />
        <p className="text-xs text-muted-foreground">Aguardando dados...</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", isOffline && "opacity-60")}>
      {/* Device label */}
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-foreground">
          {card.device_model || "Inversor"} — {card.device_serial || "—"}
        </span>
        {card.open_alerts.length > 0 && (
          <span className="px-2 py-0.5 rounded-md bg-destructive/10 text-destructive text-[10px] font-bold">
            {card.open_alerts.length} alerta{card.open_alerts.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* MPPT groups */}
      {sortedMppts.map(([mpptNum, strings]) => (
        <div key={mpptNum}>
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3 w-3 text-primary" />
            <span className="text-[11px] font-bold text-foreground uppercase tracking-wide">
              MPPT {mpptNum}
            </span>
            <div className="flex-1 h-px bg-border/40" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {strings.map((s) => (
              <StringCell key={s.id} entry={s} />
            ))}
          </div>
        </div>
      ))}

      {ungrouped.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {ungrouped.map((s) => (
            <StringCell key={s.id} entry={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function StringCell({ entry }: { entry: StringRegistryWithMetric }) {
  const badge = ALERT_BADGE[entry.alert_status || "unknown"];
  const label = entry.string_number ? `S${entry.string_number}` : "Inversor";
  const powerVal = entry.latest_power_w;
  const baselinePct = entry.baseline_pct;

  return (
    <div className={cn(
      "rounded-lg border p-2.5 transition-all",
      entry.alert_status === "ok" ? "border-success/25 bg-success/5" :
      entry.alert_status === "critical" ? "border-destructive/25 bg-destructive/5" :
      entry.alert_status === "warn" ? "border-warning/25 bg-warning/5" :
      "border-border/40 bg-muted/15"
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
        <span className={cn("h-2 w-2 rounded-full", badge.dot)} />
      </div>
      <p className={cn("text-base font-bold leading-tight", badge.text)}>
        {powerVal !== null && powerVal !== undefined ? `${powerVal}` : "—"}
        <span className="text-[10px] font-medium ml-0.5">W</span>
      </p>
      {baselinePct !== null && baselinePct !== undefined && (
        <div className="mt-1 space-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-[9px] text-muted-foreground">vs base</span>
            <span className={cn("text-[9px] font-bold", badge.text)}>
              {baselinePct.toFixed(0)}%
            </span>
          </div>
          <Progress value={Math.min(baselinePct, 100)} className="h-1" />
        </div>
      )}
    </div>
  );
}
