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
import { useToast } from "@/hooks/use-toast";
import { Send, Loader2, Terminal, AlertTriangle, Info } from "lucide-react";
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

/** Known writable DPs from the user's device specification */
const WRITABLE_DPS: WritableDP[] = [
  { code: "switch", label: "Liga/Desliga", description: "Controla o estado do disjuntor. Ligado = energia passa, Desligado = corta a energia da instalação remotamente.", type: "boolean" },
  { code: "switch_prepayment", label: "Pré-pagamento", description: "Modo pré-pago: quando ativo, o medidor corta a energia automaticamente ao atingir o limite de kWh configurado em 'Energia de Carga'.", type: "boolean" },
  { code: "clear_energy", label: "Zerar Consumo", description: "Zera o contador acumulado de energia (kWh) do medidor. Útil para reiniciar a contagem após manutenção ou troca de período.", type: "boolean" },
  { code: "recover_enable", label: "Religamento Automático", description: "Se ativo, o disjuntor tenta religar sozinho após um desligamento por proteção (sobrecorrente, sobretensão, etc).", type: "boolean" },
  { code: "charge_energy", label: "Limite Pré-pago (kWh)", description: "Define quantos kWh o consumidor pode usar no modo pré-pago. Ao atingir esse valor, o disjuntor desliga automaticamente. Ex: 500 = 500 kWh.", type: "number", min: 0, max: 999999, scale: 2 },
  { code: "recover_sec", label: "Intervalo Religamento (s)", description: "Tempo em segundos que o disjuntor aguarda entre cada tentativa de religamento automático. Ex: 30 = espera 30s antes de tentar religar.", type: "number", min: 1, max: 99 },
  { code: "recover_cnt", label: "Máx. Tentativas Religamento", description: "Quantas vezes o disjuntor tenta religar automaticamente. Se todas falharem, permanece desligado até intervenção manual. Ex: 3 = tenta 3 vezes.", type: "number", min: 1, max: 30 },
  { code: "countdown_1", label: "Timer Desligamento (s)", description: "Programa o desligamento automático após X segundos. Útil para testes ou desligamentos programados. Ex: 3600 = desliga em 1 hora. 0 = desativado.", type: "number", min: 0, max: 86400 },
  { code: "leak_delay", label: "Tolerância Fuga (s)", description: "Tempo em segundos que o medidor tolera fuga de corrente antes de desligar por proteção. Evita desarmes por picos momentâneos. Ex: 5 = tolera 5s.", type: "number", min: 1, max: 99 },
  { code: "power_on_delay", label: "Atraso ao Ligar (s)", description: "Tempo de espera após o comando 'Ligar' antes de efetivamente energizar. Útil para dar tempo de preparação. Ex: 10 = liga após 10s.", type: "number", min: 1, max: 9999 },
  { code: "alarm_v_delay", label: "Tolerância Tensão (s)", description: "Tempo que o medidor tolera tensão fora da faixa (sub ou sobretensão) antes de disparar alarme/proteção. Ex: 30 = tolera 30s fora da faixa.", type: "number", min: 1, max: 9999 },
  { code: "alarm_over_c_delay", label: "Tolerância Sobrecorrente (s)", description: "Tempo que o medidor tolera corrente acima do limite antes de disparar proteção. Evita desarme por picos curtos de partida de motores. Ex: 10.", type: "number", min: 1, max: 9999 },
  { code: "alarm_low_c_delay", label: "Tolerância Subcorrente (s)", description: "Tempo que o medidor tolera corrente abaixo do mínimo antes de alertar. Pode indicar equipamento desligado ou com defeito. Ex: 60.", type: "number", min: 1, max: 9999 },
  { code: "alam_v_cnt", label: "Máx. Alarmes Tensão", description: "Quantas vezes o alarme de tensão pode disparar antes de o disjuntor desligar definitivamente. Ex: 5 = após 5 alarmes, desliga por segurança.", type: "number", min: 1, max: 9999 },
  { code: "alarm_over_c_cnt", label: "Máx. Alarmes Sobrecorrente", description: "Quantas vezes o alarme de sobrecorrente pode disparar antes de desligar. Ex: 3 = após 3 ocorrências, corta energia.", type: "number", min: 1, max: 999 },
  { code: "alarm_low_c_cnt", label: "Máx. Alarmes Subcorrente", description: "Quantas vezes o alarme de subcorrente pode disparar antes de alertar o operador. Ex: 10.", type: "number", min: 1, max: 999 },
  { code: "switch_delay", label: "Anti-Bounce (s)", description: "Tempo mínimo entre acionamentos do switch para evitar liga/desliga rápido que pode danificar equipamentos. Ex: 5 = mínimo 5s entre comandos.", type: "number", min: 0, max: 9999 },
  { code: "energy_pt", label: "Fator PT (Tensão)", description: "Fator de calibração do Transformador de Potencial (PT). Usado para corrigir a leitura de tensão do medidor. Valor padrão de fábrica geralmente é 1. Altere apenas se souber o fator do seu TP.", type: "number", min: 0, max: 9999 },
  { code: "energy_ct", label: "Fator CT (Corrente)", description: "Fator de calibração do Transformador de Corrente (CT). Usado para corrigir a leitura de corrente/potência. Se usa TC externo de 200/5A, o fator é 40. Altere apenas com conhecimento técnico.", type: "number", min: 0, max: 9999 },
];

export function MeterCommandPanel({ configId, externalDeviceId, meterId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [sendingCode, setSendingCode] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [boolValues, setBoolValues] = useState<Record<string, boolean>>({});
  const [lastResults, setLastResults] = useState<Record<string, { success: boolean; msg?: string }>>({});

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
      value = num;
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Terminal className="w-4 h-4" /> Enviar Comando ao Dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
          <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
          <p className="text-xs text-muted-foreground">
            Comandos são enviados diretamente ao dispositivo. Use com cuidado.
          </p>
        </div>

        <div className="space-y-2">
          {WRITABLE_DPS.map(dp => {
            const isSending = sendingCode === dp.code;
            const result = lastResults[dp.code];

            return (
              <div
                key={dp.code}
                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
              >
                {/* Info col */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">{dp.code}</Badge>
                    <span className="text-sm font-medium text-foreground truncate">{dp.label}</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs">
                        {dp.description}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 hidden sm:block">{dp.description}</p>
                </div>

                {/* Value col */}
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
                      className="w-28 h-8 text-xs"
                    />
                  )}

                  {result && (
                    <Badge variant={result.success ? "default" : "destructive"} className="text-[10px] shrink-0">
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
                    <span className="hidden sm:inline ml-1 text-xs">Enviar</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
