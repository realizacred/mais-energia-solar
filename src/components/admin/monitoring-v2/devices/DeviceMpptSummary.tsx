import React from "react";
import { Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MonitorDevice } from "@/services/monitoring/monitorTypes";

interface MpptChannel {
  index: number;
  power_w: number;
}

/**
 * Extract MPPT/string data from device metadata (Growatt, Solis, SolarEdge).
 * Metadata fields: pow1..pow32 (power per string in W), dcInputTypeMppt (MPPT count)
 */
function extractMpptData(metadata: Record<string, unknown>): {
  mpptCount: number;
  channels: MpptChannel[];
  totalStringPower: number;
  acPower: number;
  energyToday: number;
  energyTotal: number;
  machineName: string;
  maxPvVoltage: number | null;
} {
  const meta = metadata || {};
  const mpptCount = Number(meta.dcInputTypeMppt ?? meta.dcInputType ?? 0);

  const channels: MpptChannel[] = [];
  for (let i = 1; i <= 32; i++) {
    const val = Number(meta[`pow${i}`] ?? 0);
    if (val > 0 || i <= mpptCount) {
      channels.push({ index: i, power_w: val });
    }
  }
  // Only keep channels up to the last non-zero one or mpptCount
  let lastNonZero = -1;
  for (let j = channels.length - 1; j >= 0; j--) {
    if (channels[j].power_w > 0) { lastNonZero = j; break; }
  }
  const trimmed = channels.slice(0, Math.max(mpptCount, lastNonZero + 1));

  const totalStringPower = trimmed.reduce((s, c) => s + c.power_w, 0);
  const acPower = Number(meta.pac ?? 0) * 1000; // pac is in kW
  const energyToday = Number(meta.etoday ?? meta.etoday1 ?? 0);
  const energyTotal = Number(meta.etotal ?? meta.etotal1 ?? 0);
  const machineName = String(meta.machine ?? meta.productModel ?? "");
  const maxPvVoltage = meta.maxUpv ? Number(meta.maxUpv) : null;

  return { mpptCount, channels: trimmed, totalStringPower, acPower, energyToday, energyTotal, machineName, maxPvVoltage };
}

interface DeviceMpptSummaryProps {
  device: MonitorDevice;
  onViewDetail?: () => void;
}

export function DeviceMpptSummary({ device, onViewDetail }: DeviceMpptSummaryProps) {
  const data = extractMpptData(device.metadata);

  const hasAnyData = data.channels.length > 0 || data.energyToday > 0;
  if (!hasAnyData && device.type !== "inverter") return null;

  return (
    <div className="space-y-3">
      {/* Machine + energy row */}
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium truncate max-w-[60%]">
          {data.machineName || device.model || device.type}
        </span>
        <div className="flex items-center gap-3">
          {data.energyToday > 0 && (
            <span className="text-foreground">
              <span className="text-muted-foreground">Hoje: </span>
              <span className="font-semibold">{data.energyToday.toFixed(1)} kWh</span>
            </span>
          )}
          {data.energyTotal > 0 && (
            <span className="text-muted-foreground">
              Total: {data.energyTotal >= 1000
                ? `${(data.energyTotal / 1000).toFixed(1)} MWh`
                : `${data.energyTotal.toFixed(0)} kWh`}
            </span>
          )}
        </div>
      </div>

      {/* MPPT channels grid */}
      {data.channels.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {data.channels.map((ch) => (
            <div
              key={ch.index}
              className={cn(
                "rounded-lg border px-3 py-2 text-center transition-colors",
                ch.power_w > 0
                  ? "border-success/30 bg-success/5"
                  : "border-border/50 bg-muted/20"
              )}
            >
              <p className="text-[10px] text-muted-foreground font-medium">
                {data.mpptCount > 0 ? `MPPT ${Math.ceil(ch.index / (32 / Math.max(data.mpptCount, 1)))}` : `String ${ch.index}`}
              </p>
              <p className={cn(
                "text-sm font-bold",
                ch.power_w > 0 ? "text-success" : "text-muted-foreground"
              )}>
                {ch.power_w > 0 ? `${ch.power_w} W` : "0 W"}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Max PV voltage */}
      {data.maxPvVoltage && data.maxPvVoltage > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="h-3 w-3" />
          <span>Vmáx PV: <span className="font-medium text-foreground">{data.maxPvVoltage.toFixed(1)} V</span></span>
        </div>
      )}

      {/* View detail link */}
      {onViewDetail && device.type === "inverter" && (
        <button
          onClick={onViewDetail}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Ver detalhes técnicos
          <ArrowRight className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

export { extractMpptData };
