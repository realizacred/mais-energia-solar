/**
 * MeterCommandPanel — Send DP commands to a Tuya device.
 * SRP: UI for selecting a DP code, entering a value, and sending the command.
 */
import { useState } from "react";
import { tuyaIntegrationService } from "@/services/tuyaIntegrationService";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Terminal, AlertTriangle } from "lucide-react";

interface Props {
  configId: string;
  externalDeviceId: string;
  meterId: string;
}

/** Known writable DPs from the user's device specification */
const WRITABLE_DPS = [
  { code: "switch", label: "Liga/Desliga", type: "boolean" },
  { code: "switch_prepayment", label: "Pré-pagamento", type: "boolean" },
  { code: "clear_energy", label: "Limpar Energia", type: "boolean" },
  { code: "recover_enable", label: "Recuperação Automática", type: "boolean" },
  { code: "charge_energy", label: "Energia de Carga (kWh)", type: "number", min: 0, max: 999999, scale: 2 },
  { code: "recover_sec", label: "Tempo Recuperação (s)", type: "number", min: 1, max: 99 },
  { code: "recover_cnt", label: "Tentativas Recuperação", type: "number", min: 1, max: 30 },
  { code: "countdown_1", label: "Contagem Regressiva (s)", type: "number", min: 0, max: 86400 },
  { code: "leak_delay", label: "Atraso Vazamento (s)", type: "number", min: 1, max: 99 },
  { code: "power_on_delay", label: "Atraso Ligar (s)", type: "number", min: 1, max: 9999 },
  { code: "alarm_v_delay", label: "Atraso Alarme Tensão (s)", type: "number", min: 1, max: 9999 },
  { code: "alarm_over_c_delay", label: "Atraso Alarme Sobrecorrente (s)", type: "number", min: 1, max: 9999 },
  { code: "alarm_low_c_delay", label: "Atraso Alarme Subcorrente (s)", type: "number", min: 1, max: 9999 },
  { code: "alam_v_cnt", label: "Contagem Alarme Tensão (s)", type: "number", min: 1, max: 9999 },
  { code: "alarm_over_c_cnt", label: "Contagem Alarme Sobrecorrente (s)", type: "number", min: 1, max: 999 },
  { code: "alarm_low_c_cnt", label: "Contagem Alarme Subcorrente (s)", type: "number", min: 1, max: 999 },
  { code: "switch_delay", label: "Atraso Switch", type: "number", min: 0, max: 9999 },
  { code: "energy_pt", label: "Energy PT", type: "number", min: 0, max: 9999 },
  { code: "energy_ct", label: "Energy CT", type: "number", min: 0, max: 9999 },
] as const;

export function MeterCommandPanel({ configId, externalDeviceId, meterId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [numberValue, setNumberValue] = useState<string>("");
  const [boolValue, setBoolValue] = useState(false);
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; msg?: string } | null>(null);

  const selectedDP = WRITABLE_DPS.find(dp => dp.code === selectedCode);

  async function handleSend() {
    if (!selectedDP) return;

    let value: any;
    if (selectedDP.type === "boolean") {
      value = boolValue;
    } else {
      const num = Number(numberValue);
      if (isNaN(num) || num < (selectedDP.min ?? 0) || num > (selectedDP.max ?? 99999)) {
        toast({ title: "Valor inválido", description: `Deve ser entre ${selectedDP.min ?? 0} e ${selectedDP.max ?? 99999}`, variant: "destructive" });
        return;
      }
      value = num;
    }

    setSending(true);
    setLastResult(null);
    try {
      const resp = await tuyaIntegrationService.sendCommand(configId, externalDeviceId, [
        { code: selectedDP.code, value },
      ]);
      setLastResult({ success: resp.success, msg: resp.msg });
      if (resp.success) {
        toast({ title: "Comando enviado com sucesso", description: `${selectedDP.label}: ${value}` });
        // Refresh status after a small delay
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["meter_status_latest", meterId] });
        }, 2000);
      } else {
        toast({ title: "Falha ao enviar comando", description: resp.msg || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      setLastResult({ success: false, msg: err?.message });
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Enviar Comando ao Dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-muted-foreground">
            Comandos são enviados diretamente ao dispositivo. Use com cuidado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* DP Selector */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Data Point (DP)</label>
            <Select value={selectedCode} onValueChange={(v) => {
              setSelectedCode(v);
              setNumberValue("");
              setBoolValue(false);
              setLastResult(null);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um DP..." />
              </SelectTrigger>
              <SelectContent>
                {WRITABLE_DPS.map(dp => (
                  <SelectItem key={dp.code} value={dp.code}>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] font-mono">{dp.code}</Badge>
                      <span className="text-xs">{dp.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value Input */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Valor</label>
            {selectedDP?.type === "boolean" ? (
              <div className="flex items-center gap-3 h-10">
                <Switch checked={boolValue} onCheckedChange={setBoolValue} />
                <span className="text-sm text-foreground">{boolValue ? "Ligado (true)" : "Desligado (false)"}</span>
              </div>
            ) : selectedDP ? (
              <Input
                type="number"
                placeholder={`${selectedDP.min ?? 0} — ${selectedDP.max ?? 99999}`}
                value={numberValue}
                onChange={(e) => setNumberValue(e.target.value)}
                min={selectedDP.min}
                max={selectedDP.max}
              />
            ) : (
              <Input disabled placeholder="Selecione um DP primeiro" />
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          {lastResult && (
            <Badge variant={lastResult.success ? "default" : "destructive"} className="text-xs">
              {lastResult.success ? "✓ Sucesso" : `✗ Falha: ${lastResult.msg || "erro"}`}
            </Badge>
          )}
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!selectedDP || sending}
            >
              {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4 mr-1" />}
              Enviar Comando
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
