/**
 * MeterAlertConfig — Per-meter alert threshold configuration.
 * Stores config in meter_devices.metadata.alert_config
 */
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Save, Loader2, Settings, Zap, Thermometer, ShieldAlert, Activity, Gauge, RefreshCw } from "lucide-react";

interface Props {
  meterId: string;
  metadata: Record<string, any> | null;
  latestStatus?: Record<string, any> | null;
  configId?: string;
  externalDeviceId?: string;
}

interface AlertConfig {
  nominal_voltage: 127 | 220;
  min_voltage: number;
  max_voltage: number;
  max_power: number;
  max_current: number;
  max_temperature: number;
  max_leakage_current: number;
  min_frequency: number;
  max_frequency: number;
  max_energy_daily_kwh: number;
  offline_alerts_enabled: boolean;
  overvoltage_alerts_enabled: boolean;
  overcurrent_alerts_enabled: boolean;
  temperature_alerts_enabled: boolean;
  leakage_alerts_enabled: boolean;
  power_alerts_enabled: boolean;
  energy_alerts_enabled: boolean;
}

const VOLTAGE_PRESETS = {
  127: { min: 110, max: 133 },
  220: { min: 201, max: 231 },
} as const;

const DEFAULTS: AlertConfig = {
  nominal_voltage: 127,
  min_voltage: 110,
  max_voltage: 133,
  max_power: 10000,
  max_current: 63,
  max_temperature: 85,
  max_leakage_current: 30,
  min_frequency: 59,
  max_frequency: 61,
  max_energy_daily_kwh: 100,
  offline_alerts_enabled: true,
  overvoltage_alerts_enabled: true,
  overcurrent_alerts_enabled: true,
  temperature_alerts_enabled: true,
  leakage_alerts_enabled: true,
  power_alerts_enabled: true,
  energy_alerts_enabled: false,
};

export function MeterAlertConfig({ meterId, metadata, latestStatus, configId, externalDeviceId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [config, setConfig] = useState<AlertConfig>(DEFAULTS);
  const [baseline, setBaseline] = useState<AlertConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function handleResync() {
    if (!configId || !externalDeviceId) {
      toast({ title: "Sem configuração Tuya vinculada", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Sessão expirada");

      const resp = await supabase.functions.invoke("tuya-proxy", {
        body: { action: "sync_readings", config_id: configId, device_id: externalDeviceId },
      });
      if (resp.error) throw resp.error;
      qc.invalidateQueries({ queryKey: ["meter_status_latest", meterId] });
      toast({ title: "Dados resincronizados com sucesso" });
    } catch (err: any) {
      toast({ title: "Erro ao resincronizar", description: err?.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }

  useEffect(() => {
    const ac = metadata?.alert_config;
    if (ac) setConfig({ ...DEFAULTS, ...ac });
  }, [metadata]);

  async function handleSave() {
    setSaving(true);
    try {
      const newMetadata = { ...(metadata || {}), alert_config: config } as any;
      const { error } = await supabase
        .from("meter_devices")
        .update({ metadata: newMetadata, updated_at: new Date().toISOString() } as any)
        .eq("id", meterId);
      if (error) throw error;
      toast({ title: "Configurações de alerta salvas" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Extract current values from latestStatus for display
  const raw = latestStatus as any;
  const dps: any[] = raw?.raw_payload?.dps || [];
  const currentVoltage = raw?.voltage_v;
  const currentCurrent = raw?.current_a;
  const currentPower = raw?.power_w;
  const currentTemp = dps.find((d: any) => d.code === "temp_current")?.value;
  const currentLeakage = dps.find((d: any) => d.code === "leakage_current")?.value;

  return (
    <div className="space-y-4 mt-4">
      {/* Current Device Status */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Settings className="w-4 h-4" /> Configuração Atual do Dispositivo
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleResync} disabled={syncing || !configId}>
            {syncing ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
            Resincronizar
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <StatusItem
              icon={<Zap className="w-3.5 h-3.5" />}
              label="Tensão"
              value={currentVoltage != null ? `${currentVoltage.toFixed(1)} V` : "—"}
              status={currentVoltage != null ? getStatus(currentVoltage, config.min_voltage, config.max_voltage) : "neutral"}
            />
            <StatusItem
              icon={<Gauge className="w-3.5 h-3.5" />}
              label="Corrente"
              value={currentCurrent != null ? `${currentCurrent.toFixed(2)} A` : "—"}
              status={currentCurrent != null && currentCurrent > config.max_current ? "danger" : "ok"}
            />
            <StatusItem
              icon={<Activity className="w-3.5 h-3.5" />}
              label="Potência"
              value={currentPower != null ? `${currentPower} W` : "—"}
              status={currentPower != null && currentPower > config.max_power ? "danger" : "ok"}
            />
            <StatusItem
              icon={<Thermometer className="w-3.5 h-3.5" />}
              label="Temperatura"
              value={currentTemp != null ? `${currentTemp} °C` : "—"}
              status={currentTemp != null && currentTemp > config.max_temperature ? "danger" : "ok"}
            />
            <StatusItem
              icon={<ShieldAlert className="w-3.5 h-3.5" />}
              label="Corrente Fuga"
              value={currentLeakage != null ? `${currentLeakage} mA` : "—"}
              status={currentLeakage != null && currentLeakage > config.max_leakage_current ? "danger" : "ok"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alert Thresholds */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Configurações de Alerta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Voltage */}
          <AlertSection
            title="Tensão"
            icon={<Zap className="w-3.5 h-3.5" />}
            enabled={config.overvoltage_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, overvoltage_alerts_enabled: v }))}
          >
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">Tensão Nominal da Rede</label>
                <Select
                  value={String(config.nominal_voltage)}
                  onValueChange={(v) => {
                    const nominal = Number(v) as 127 | 220;
                    const preset = VOLTAGE_PRESETS[nominal];
                    setConfig(c => ({ ...c, nominal_voltage: nominal, min_voltage: preset.min, max_voltage: preset.max }));
                  }}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="127">127V (Monofásico)</SelectItem>
                    <SelectItem value="220">220V (Bifásico/Trifásico)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ConfigInput label="Tensão Mínima (V)" value={config.min_voltage} onChange={(v) => setConfig(c => ({ ...c, min_voltage: v }))} />
                <ConfigInput label="Tensão Máxima (V)" value={config.max_voltage} onChange={(v) => setConfig(c => ({ ...c, max_voltage: v }))} />
              </div>
            </div>
          </AlertSection>

          {/* Current */}
          <AlertSection
            title="Sobrecorrente"
            icon={<Gauge className="w-3.5 h-3.5" />}
            enabled={config.overcurrent_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, overcurrent_alerts_enabled: v }))}
          >
            <ConfigInput label="Corrente Máxima (A)" value={config.max_current} onChange={(v) => setConfig(c => ({ ...c, max_current: v }))} />
          </AlertSection>

          {/* Power */}
          <AlertSection
            title="Sobrepotência"
            icon={<Activity className="w-3.5 h-3.5" />}
            enabled={config.power_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, power_alerts_enabled: v }))}
          >
            <ConfigInput label="Potência Máxima (W)" value={config.max_power} onChange={(v) => setConfig(c => ({ ...c, max_power: v }))} />
          </AlertSection>

          {/* Temperature */}
          <AlertSection
            title="Temperatura"
            icon={<Thermometer className="w-3.5 h-3.5" />}
            enabled={config.temperature_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, temperature_alerts_enabled: v }))}
          >
            <ConfigInput label="Temperatura Máxima (°C)" value={config.max_temperature} onChange={(v) => setConfig(c => ({ ...c, max_temperature: v }))} />
          </AlertSection>

          {/* Leakage */}
          <AlertSection
            title="Corrente de Fuga"
            icon={<ShieldAlert className="w-3.5 h-3.5" />}
            enabled={config.leakage_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, leakage_alerts_enabled: v }))}
          >
            <ConfigInput label="Corrente Fuga Máx. (mA)" value={config.max_leakage_current} onChange={(v) => setConfig(c => ({ ...c, max_leakage_current: v }))} />
          </AlertSection>

          {/* Frequency */}
          <AlertSection title="Frequência" icon={<Activity className="w-3.5 h-3.5" />} enabled={true} onToggle={() => {}}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ConfigInput label="Frequência Mínima (Hz)" value={config.min_frequency} onChange={(v) => setConfig(c => ({ ...c, min_frequency: v }))} />
              <ConfigInput label="Frequência Máxima (Hz)" value={config.max_frequency} onChange={(v) => setConfig(c => ({ ...c, max_frequency: v }))} />
            </div>
          </AlertSection>

          {/* Energy daily */}
          <AlertSection
            title="Consumo Diário"
            icon={<BarChart3Icon />}
            enabled={config.energy_alerts_enabled}
            onToggle={(v) => setConfig(c => ({ ...c, energy_alerts_enabled: v }))}
          >
            <ConfigInput label="Máximo Diário (kWh)" value={config.max_energy_daily_kwh} onChange={(v) => setConfig(c => ({ ...c, max_energy_daily_kwh: v }))} />
          </AlertSection>

          {/* Offline */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-2">
              <Switch
                checked={config.offline_alerts_enabled}
                onCheckedChange={(v) => setConfig(c => ({ ...c, offline_alerts_enabled: v }))}
              />
              <span className="text-sm text-muted-foreground">Alertas de dispositivo offline</span>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
              Salvar Configurações
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Sub-components ─── */

function BarChart3Icon() {
  // Using inline to avoid extra import
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18" /><path d="M13 17V9" /><path d="M18 17V5" /><path d="M8 17v-3" />
    </svg>
  );
}

function ConfigInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground">{label}</label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1"
      />
    </div>
  );
}

function AlertSection({ title, icon, enabled, onToggle, children }: {
  title: string;
  icon: React.ReactNode;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2 border-b border-border pb-4 last:border-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          {icon} {title}
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && <div className="pl-6">{children}</div>}
    </div>
  );
}

function StatusItem({ icon, label, value, status }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  status: "ok" | "danger" | "neutral";
}) {
  const colors = {
    ok: "border-success/30 bg-success/5",
    danger: "border-destructive/30 bg-destructive/5",
    neutral: "border-border bg-muted/30",
  };
  const textColors = {
    ok: "text-success",
    danger: "text-destructive",
    neutral: "text-muted-foreground",
  };
  return (
    <div className={`rounded-lg border p-3 ${colors[status]}`}>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon} {label}
      </div>
      <p className={`text-sm font-semibold font-mono ${textColors[status]}`}>{value}</p>
    </div>
  );
}

function getStatus(value: number, min: number, max: number): "ok" | "danger" | "neutral" {
  if (value < min || value > max) return "danger";
  return "ok";
}
