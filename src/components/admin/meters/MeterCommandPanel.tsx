/**
 * MeterCommandPanel — Send DP commands to a Tuya device.
 * SRP: UI for selecting a DP code, entering a value, and sending the command.
 */
import { useState, useEffect } from "react";
import { tuyaIntegrationService } from "@/services/tuyaIntegrationService";
import { meterService } from "@/services/meterService";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Terminal, AlertTriangle, Info, Power, Shield, Zap, Clock, Gauge, Settings, ThermometerSun, RefreshCw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  configId: string;
  externalDeviceId: string;
  meterId: string;
}

interface WritableDP {
  code: string;
  label: string;
  description: string;
  type: "boolean" | "number";
  min?: number;
  max?: number;
  scale?: number;
}

interface DPCategory {
  title: string;
  icon: React.ReactNode;
  dps: WritableDP[];
}

/** All writable DPs from the device, organized by category */
const DP_CATEGORIES: DPCategory[] = [
  {
    title: "Controle de Energia",
    icon: <Power className="w-4 h-4" />,
    dps: [
      { code: "switch", label: "Liga/Desliga", description: "Controla o estado do disjuntor. Ligado = energia passa para a instalação. Desligado = corta totalmente a energia remotamente.", type: "boolean" },
      { code: "countdown_1", label: "Timer Desligamento (s)", description: "Programa o desligamento automático após X segundos. Útil para testes ou desligamentos programados. Ex: 3600 = desliga em 1 hora. 0 = desativado.", type: "number", min: 0, max: 86400 },
      { code: "power_on_delay", label: "Atraso ao Ligar (s)", description: "Tempo de espera após o comando 'Ligar' antes de efetivamente energizar a saída. Protege contra inrush. Ex: 10 = liga após 10 segundos.", type: "number", min: 1, max: 9999 },
      { code: "switch_delay", label: "Anti-Bounce (s)", description: "Tempo mínimo entre acionamentos do switch. Evita liga/desliga rápido que pode danificar equipamentos conectados. Ex: 5 = mínimo 5s entre comandos.", type: "number", min: 0, max: 9999 },
      { code: "swithc_power_save", label: "Modo Economia", description: "Define o modo de economia de energia do próprio disjuntor. 0 = desativado, 1 = economia leve, 2 = economia máxima. Reduz consumo do medidor em standby.", type: "number", min: 0, max: 3 },
    ],
  },
  {
    title: "Pré-pagamento",
    icon: <Gauge className="w-4 h-4" />,
    dps: [
      { code: "switch_prepayment", label: "Ativar Pré-pagamento", description: "Modo pré-pago: quando ativo, o medidor corta a energia automaticamente ao atingir o limite de kWh configurado em 'Limite Pré-pago'. Usado para controle de créditos de energia.", type: "boolean" },
      { code: "charge_energy", label: "Limite Pré-pago (kWh)", description: "Define quantos kWh o consumidor pode usar no modo pré-pago. Ao atingir esse valor, o disjuntor desliga automaticamente. Ex: 500 = 500 kWh disponíveis.", type: "number", min: 0, max: 999999, scale: 2 },
      { code: "clear_energy", label: "Zerar Consumo Acumulado", description: "Zera o contador acumulado de energia (kWh) do medidor. Útil para reiniciar a contagem após manutenção, troca de período ou início de novo ciclo de faturamento.", type: "boolean" },
    ],
  },
  {
    title: "Religamento Automático",
    icon: <Zap className="w-4 h-4" />,
    dps: [
      { code: "recover_enable", label: "Ativar Religamento", description: "Se ativo, o disjuntor tenta religar sozinho após um desligamento por proteção (sobrecorrente, sobretensão, fuga, etc). Essencial para instalações remotas.", type: "boolean" },
      { code: "recover_sec", label: "Intervalo entre Tentativas (s)", description: "Tempo em segundos que o disjuntor aguarda entre cada tentativa de religamento automático. Ex: 30 = espera 30s antes de tentar religar.", type: "number", min: 1, max: 99 },
      { code: "recover_cnt", label: "Máx. Tentativas", description: "Número máximo de vezes que o disjuntor tenta religar. Se todas falharem, permanece desligado até intervenção manual. Ex: 3 = tenta 3 vezes.", type: "number", min: 1, max: 30 },
    ],
  },
  {
    title: "Proteção de Tensão",
    icon: <Shield className="w-4 h-4" />,
    dps: [
      { code: "alarm_v_delay", label: "Tolerância Tensão (s)", description: "Tempo que o medidor tolera tensão fora da faixa (sub ou sobretensão) antes de disparar proteção. Evita desarmes por flutuações momentâneas da rede. Ex: 20s.", type: "number", min: 1, max: 9999 },
      { code: "alam_v_cnt", label: "Máx. Alarmes antes de Desligar", description: "Quantas vezes o alarme de tensão pode disparar antes de o disjuntor desligar definitivamente. Ex: 5 = após 5 eventos, corta por segurança.", type: "number", min: 1, max: 9999 },
    ],
  },
  {
    title: "Proteção de Corrente",
    icon: <Shield className="w-4 h-4" />,
    dps: [
      { code: "alarm_over_c_delay", label: "Tolerância Sobrecorrente (s)", description: "Tempo que o medidor tolera corrente acima do limite antes de desligar. Evita desarme por picos curtos como partida de motores. Ex: 10s.", type: "number", min: 1, max: 9999 },
      { code: "alarm_over_c_cnt", label: "Máx. Alarmes Sobrecorrente", description: "Quantas vezes o alarme de sobrecorrente pode disparar antes de desligar definitivamente. Ex: 3 = após 3 ocorrências, corta.", type: "number", min: 1, max: 999 },
      { code: "alarm_low_c_delay", label: "Tolerância Subcorrente (s)", description: "Tempo que o medidor tolera corrente abaixo do mínimo antes de alertar. Pode indicar fio rompido ou problema na carga. Ex: 60s.", type: "number", min: 1, max: 9999 },
      { code: "alarm_low_c_cnt", label: "Máx. Alarmes Subcorrente", description: "Quantas vezes o alarme de subcorrente pode disparar antes de notificar. Ex: 10 = tolerante a oscilações.", type: "number", min: 1, max: 999 },
    ],
  },
  {
    title: "Proteção de Fuga (DR)",
    icon: <ThermometerSun className="w-4 h-4" />,
    dps: [
      { code: "leak_delay", label: "Tolerância Fuga (s)", description: "Tempo que o medidor tolera fuga de corrente (diferencial) antes de desligar por proteção DR. Evita desarmes por picos momentâneos. Ex: 5 = tolera 5 segundos.", type: "number", min: 1, max: 99 },
    ],
  },
  {
    title: "Calibração do Sensor",
    icon: <Settings className="w-4 h-4" />,
    dps: [
      { code: "energy_pt", label: "Fator PT (Tensão)", description: "Fator de calibração do Transformador de Potencial (PT). Corrige a leitura de tensão. Valor de fábrica: 10 (equivale a 1.0x). ⚠️ Altere apenas com conhecimento técnico — valores errados causam leituras incorretas.", type: "number", min: 0, max: 9999 },
      { code: "energy_ct", label: "Fator CT (Corrente)", description: "Fator de calibração do Transformador de Corrente (CT). Corrige a leitura de corrente e potência. Se usar TC externo de 200/5A, o fator seria 40. Valor de fábrica: 10. ⚠️ Altere apenas com conhecimento técnico.", type: "number", min: 0, max: 9999 },
    ],
  },
];

/** Extract current DP values from raw_payload — tries multiple known structures */
function extractCurrentValues(rawPayload: any): Record<string, any> {
  const map: Record<string, any> = {};
  if (!rawPayload || typeof rawPayload !== "object") return map;

  // Try multiple locations where DPs may live
  const candidates: any[] = [
    rawPayload?.dps,
    rawPayload?.device_info?.status,
    rawPayload?.status,
  ];

  for (const arr of candidates) {
    if (!Array.isArray(arr)) continue;
    for (const dp of arr) {
      if (dp?.code && dp.value !== undefined && !(dp.code in map)) {
        map[dp.code] = dp.value;
      }
    }
  }

  // console.log("[MeterCommandPanel] extractCurrentValues found", Object.keys(map).length, "DPs, sample:", 
  //   Object.fromEntries(Object.entries(map).slice(0, 5)));
  return map;
}

export function MeterCommandPanel({ configId, externalDeviceId, meterId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sendingCode, setSendingCode] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>({});
  const [lastResults, setLastResults] = useState<Record<string, { success: boolean; msg?: string }>>({});
  const [initialized, setInitialized] = useState(false);

  // Fetch current device status to pre-fill values
  const { data: statusLatest, isLoading: loadingStatus } = useQuery({
    queryKey: ["meter_status_latest", meterId],
    queryFn: () => meterService.getStatusLatest(meterId),
    staleTime: 1000 * 30,
    enabled: !!meterId,
  });

  // Pre-fill form values from raw_payload when data arrives
  useEffect(() => {
    if (initialized) return;
    if (!statusLatest) {
      // console.log("[MeterCommandPanel] No statusLatest yet for meterId:", meterId);
      return;
    }
    if (!statusLatest.raw_payload) {
      // console.log("[MeterCommandPanel] statusLatest exists but no raw_payload");
      return;
    }

    const current = extractCurrentValues(statusLatest.raw_payload);
    if (Object.keys(current).length === 0) {
      // console.log("[MeterCommandPanel] extractCurrentValues returned empty map");
      return;
    }

    const nums: Record<string, string> = {};
    const bools: Record<string, boolean> = {};

    for (const cat of DP_CATEGORIES) {
      for (const dp of cat.dps) {
        const val = current[dp.code];
        if (val === undefined) continue;
        if (dp.type === "boolean") {
          bools[dp.code] = !!val;
        } else {
          nums[dp.code] = String(val);
        }
      }
    }

    // console.log("[MeterCommandPanel] Pre-filling", Object.keys(nums).length, "numeric +", Object.keys(bools).length, "boolean values");
    setValues(prev => ({ ...prev, ...nums }));
    setBoolValues(prev => ({ ...prev, ...bools }));
    setInitialized(true);
  }, [statusLatest, initialized, meterId]);

  function setNumberValue(code: string, val: string) {
    setValues(prev => ({ ...prev, [code]: val }));
  }

  function setBoolValue(code: string, val: boolean) {
    setBoolValues(prev => ({ ...prev, [code]: val }));
  }

  async function handleSend(dp: WritableDP) {
    let value: any;
    if (dp.type === "boolean") {
      value = boolValues[dp.code] ?? false;
    } else {
      const num = Number(values[dp.code] ?? "");
      if (isNaN(num) || num < (dp.min ?? 0) || num > (dp.max ?? 99999)) {
        toast({ title: "Valor inválido", description: `Deve ser entre ${dp.min ?? 0} e ${dp.max ?? 99999}`, variant: "destructive" });
        return;
      }
      // Apply DP scale: charge_energy has scale=2, so kWh × 100 = raw value
      value = dp.scale ? Math.round(num * Math.pow(10, dp.scale)) : num;
    }

    setSendingCode(dp.code);
    setLastResults(prev => ({ ...prev, [dp.code]: undefined as any }));
    try {
      const resp = await tuyaIntegrationService.sendCommand(configId, externalDeviceId, [
        { code: dp.code, value },
      ]);
      setLastResults(prev => ({ ...prev, [dp.code]: { success: resp.success, msg: resp.msg } }));
      if (resp.success) {
        toast({ title: "Comando enviado", description: `${dp.label}: ${value}` });
        setTimeout(() => {
          qc.invalidateQueries({ queryKey: ["meter_status_latest", meterId] });
        }, 2000);
      } else {
        toast({ title: "Falha ao enviar", description: resp.msg || "Erro desconhecido", variant: "destructive" });
      }
    } catch (err: any) {
      setLastResults(prev => ({ ...prev, [dp.code]: { success: false, msg: err?.message } }));
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setSendingCode(null);
    }
  }

  const handleRefresh = () => {
    setInitialized(false);
    qc.invalidateQueries({ queryKey: ["meter_status_latest", meterId] });
  };

  if (loadingStatus) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Painel de Comandos do Dispositivo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Terminal className="w-4 h-4" /> Painel de Comandos do Dispositivo
          </CardTitle>
          <div className="flex items-center gap-2">
            {initialized && (
              <Badge variant="outline" className="text-xs text-success border-success/30 bg-success/10">
                Valores carregados do dispositivo
              </Badge>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleRefresh}>
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-muted-foreground">
            Os valores exibidos são da última leitura do dispositivo. Altere e clique Enviar para gravar no medidor.
          </p>
        </div>

        {DP_CATEGORIES.map(cat => (
          <div key={cat.title} className="space-y-2">
            <div className="flex items-center gap-2 pb-1 border-b border-border">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-primary shrink-0">
                {cat.icon}
              </div>
              <h3 className="text-sm font-semibold text-foreground">{cat.title}</h3>
              <Badge variant="outline" className="text-xs ml-auto">{cat.dps.length}</Badge>
            </div>

            <div className="space-y-2">
              {cat.dps.map(dp => {
                const isSending = sendingCode === dp.code;
                const result = lastResults[dp.code];

                  return (
                    <div
                      key={dp.code}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                    >
                      {/* Label + tooltip */}
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Badge variant="outline" className="text-xs font-mono shrink-0 px-2 py-0.5">{dp.code}</Badge>
                        <span className="text-sm font-medium text-foreground truncate">{dp.label}</span>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[360px] text-sm leading-relaxed p-3">
                            {dp.description}
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Controls */}
                      <div className="flex items-center gap-2 shrink-0">
                        {dp.type === "boolean" ? (
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={boolValues[dp.code] ?? false}
                              onCheckedChange={(v) => setBoolValue(dp.code, v)}
                            />
                            <span className="text-xs text-muted-foreground w-16">
                              {boolValues[dp.code] ? "Ligado" : "Desligado"}
                            </span>
                          </div>
                        ) : (
                          <Input
                            type="number"
                            placeholder={`${dp.min ?? 0}–${dp.max ?? 99999}`}
                            value={values[dp.code] ?? ""}
                            onChange={(e) => setNumberValue(dp.code, e.target.value)}
                            min={dp.min}
                            max={dp.max}
                            className="w-28 h-9 text-sm"
                          />
                        )}

                        {result && (
                          <Badge variant={result.success ? "default" : "destructive"} className="text-xs shrink-0">
                            {result.success ? "✓" : "✗"}
                          </Badge>
                        )}

                        <Button
                          size="sm"
                          className="h-8 px-3"
                          onClick={() => handleSend(dp)}
                          disabled={isSending}
                        >
                          {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </div>
                  );
              })}
            </div>
          </div>
        ))}

        <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 border border-border">
          <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground space-y-1.5">
            <p className="font-medium text-foreground">DPs somente leitura (exibidos no painel de status):</p>
            <p>
              <span className="font-mono">total_forward_energy</span> <span className="text-foreground font-medium">(Reg 03 — consumo)</span>, <span className="font-mono">reverse_energy_total</span> <span className="text-foreground font-medium">(Reg 103 — injeção)</span>, <span className="font-mono">phase_a/b/c</span>, <span className="font-mono">fault</span>, <span className="font-mono">balance_energy</span>, <span className="font-mono">leakage_current</span>, <span className="font-mono">temp_current</span>, <span className="font-mono">power_total</span>, <span className="font-mono">power_reactive</span>, <span className="font-mono">pa/pb/pc_instant</span>, <span className="font-mono">energy_total</span>, <span className="font-mono">energy_all</span>, <span className="font-mono">power_factor</span>, <span className="font-mono">status/status_b/status_c</span>, <span className="font-mono">n_current</span>, <span className="font-mono">over_current_cnt</span>, <span className="font-mono">lost_current_cnt</span>, <span className="font-mono">leak_cnt</span>
            </p>
            <p className="font-medium text-foreground mt-2">DPs codificados (Base64 — configuração avançada via app Tuya):</p>
            <p>
              <span className="font-mono">alarm_set_1/2/3</span> (limites tensão/corrente/potência), <span className="font-mono">cycle_time</span> (programação horária), <span className="font-mono">switch_inching</span> (modo pulso), <span className="font-mono">random_time</span> (timer aleatório)
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
