/**
 * MeterAlertConfig — Per-meter alert threshold configuration.
 * Stores config in meter_devices.metadata.alert_config
 */
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Save, Loader2 } from "lucide-react";

interface Props {
  meterId: string;
  metadata: Record<string, any> | null;
}

interface AlertConfig {
  min_voltage: number;
  max_voltage: number;
  max_power: number;
  offline_alerts_enabled: boolean;
}

const DEFAULTS: AlertConfig = {
  min_voltage: 200,
  max_voltage: 240,
  max_power: 10000,
  offline_alerts_enabled: true,
};

export function MeterAlertConfig({ meterId, metadata }: Props) {
  const { toast } = useToast();
  const [config, setConfig] = useState<AlertConfig>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const ac = metadata?.alert_config;
    if (ac) setConfig({ ...DEFAULTS, ...ac });
  }, [metadata]);

  async function handleSave() {
    setSaving(true);
    try {
      const newMetadata = { ...(metadata || {}), alert_config: config };
      const { error } = await supabase
        .from("meter_devices")
        .update({ metadata: newMetadata, updated_at: new Date().toISOString() })
        .eq("id", meterId);
      if (error) throw error;
      toast({ title: "Configurações de alerta salvas" });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4" /> Configurações de Alerta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Tensão Mínima (V)</label>
            <Input
              type="number"
              value={config.min_voltage}
              onChange={(e) => setConfig(c => ({ ...c, min_voltage: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Tensão Máxima (V)</label>
            <Input
              type="number"
              value={config.max_voltage}
              onChange={(e) => setConfig(c => ({ ...c, max_voltage: Number(e.target.value) }))}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Potência Máxima (W)</label>
            <Input
              type="number"
              value={config.max_power}
              onChange={(e) => setConfig(c => ({ ...c, max_power: Number(e.target.value) }))}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={config.offline_alerts_enabled}
              onCheckedChange={(v) => setConfig(c => ({ ...c, offline_alerts_enabled: v }))}
            />
            <span className="text-xs text-muted-foreground">Alertas de offline ativo</span>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
