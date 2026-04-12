/**
 * EconomiaDetailCards — Exibe detalhes tarifários na página pública da proposta.
 * Componente de exibição apenas — não altera cálculos.
 * Página pública — exceção RB-02 aprovada.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, ArrowRight, Receipt, Info } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { getFioBCobranca } from "@/lib/calcGrupoB";

interface EconomiaDetailProps {
  snapshot: Record<string, any> | null;
  economiaMensal: number;
  potenciaKwp: number;
}

/** Resolve value from snapshot with camelCase/snake_case fallback */
function snap(s: Record<string, any> | null, ...keys: string[]): any {
  if (!s) return undefined;
  for (const k of keys) {
    if (s[k] !== undefined && s[k] !== null && s[k] !== "") return s[k];
  }
  // Check nested ucs[0]
  const ucs = s.ucs ?? s.units ?? [];
  if (ucs.length > 0) {
    const uc = ucs[0];
    for (const k of keys) {
      if (uc[k] !== undefined && uc[k] !== null && uc[k] !== "") return uc[k];
    }
  }
  return undefined;
}

export default function EconomiaDetailCards({ snapshot, economiaMensal, potenciaKwp }: EconomiaDetailProps) {
  if (!snapshot) return null;

  // ── Extract data from snapshot ──
  const geracaoMensal = Number(snap(snapshot, "geracao_mensal_kwh", "geracaoMensalKwh", "geracao_mensal") ?? 0);
  const consumoMensal = Number(snap(snapshot, "consumo_total", "consumoTotal", "consumo_mensal") ?? 0);
  const tarifa = Number(snap(snapshot, "tarifa_distribuidora", "tarifaBase", "tarifa_base") ?? 0);
  const custoDisp = Number(snap(snapshot, "custo_disponibilidade_valor", "custoDisponibilidade", "custo_disponibilidade") ?? 0);
  const regra = snap(snapshot, "regra", "regra_compensacao") as string | undefined;
  const grupo = snap(snapshot, "grupo", "grupo_tarifario") as string | undefined;

  // Bail out if essential data is missing
  if (geracaoMensal <= 0 && consumoMensal <= 0) return null;

  // ── Subgrupo badge ──
  const subgrupoLabel = grupo === "A" ? "Grupo A"
    : regra === "GD1" ? "GD I"
    : regra === "GD3" ? "GD III"
    : "GD II";

  const subgrupoBadgeColor = grupo === "A"
    ? "bg-info/10 text-info border-info/20"
    : "bg-primary/10 text-primary border-primary/20";

  // ── Economy breakdown ──
  const economiaDireta = consumoMensal > 0 && tarifa > 0
    ? Math.min(geracaoMensal, consumoMensal) * tarifa
    : economiaMensal;
  const excedente = Math.max(0, geracaoMensal - consumoMensal);
  const creditosGerados = excedente * tarifa;
  const contaResidual = custoDisp > 0 ? custoDisp : undefined;

  // ── Coverage ──
  const coberturaPercent = consumoMensal > 0
    ? Math.round((geracaoMensal / consumoMensal) * 100)
    : 0;
  const excedentePercent = consumoMensal > 0
    ? Math.max(0, Math.round(((geracaoMensal - consumoMensal) / consumoMensal) * 100))
    : 0;
  const barWidth = consumoMensal > 0 ? Math.min(100, (geracaoMensal / consumoMensal) * 100) : 0;

  // ── Fio B info ──
  const anoAtual = new Date().getFullYear();
  const fioBPercent = getFioBCobranca(anoAtual);
  const fioBPercentDisplay = fioBPercent !== null ? Math.round(fioBPercent * 100) : null;
  const showFioB = regra !== "GD1" && grupo !== "A";

  return (
    <div className="space-y-3">
      {/* Badge do subgrupo */}
      <div className="flex items-center justify-center gap-2">
        <Badge variant="outline" className={`text-xs ${subgrupoBadgeColor}`}>
          <Zap className="w-3 h-3 mr-1" />
          {subgrupoLabel}
        </Badge>
        {potenciaKwp > 0 && (
          <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border">
            {potenciaKwp} kWp
          </Badge>
        )}
      </div>

      {/* Cards de economia separados */}
      <div className="grid grid-cols-1 gap-2">
        {/* Economia direta */}
        <div className="bg-success/5 border border-success/20 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded flex items-center justify-center bg-success/10">
              <Zap className="w-3.5 h-3.5 text-success" />
            </div>
            <p className="text-xs font-medium text-foreground">Economia direta</p>
          </div>
          <p className="text-lg font-bold text-success">{formatBRL(economiaDireta)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Energia gerada que você consome diretamente — sai da sua conta
          </p>
        </div>

        {/* Créditos gerados */}
        {excedente > 0 && (
          <div className="bg-info/5 border border-info/20 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-info/10">
                <ArrowRight className="w-3.5 h-3.5 text-info" />
              </div>
              <p className="text-xs font-medium text-foreground">Créditos gerados</p>
            </div>
            <p className="text-lg font-bold text-info">{formatBRL(creditosGerados)}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Excedente injetado na rede — vira crédito para os próximos meses
            </p>
          </div>
        )}

        {/* Conta residual */}
        {contaResidual !== undefined && contaResidual > 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-6 h-6 rounded flex items-center justify-center bg-muted">
                <Receipt className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <p className="text-xs font-medium text-foreground">Conta residual estimada</p>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatBRL(contaResidual)}<span className="text-xs font-normal text-muted-foreground">/mês</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Taxa mínima obrigatória da distribuidora (custo de disponibilidade)
            </p>
          </div>
        )}
      </div>

      {/* Barra de cobertura */}
      {consumoMensal > 0 && geracaoMensal > 0 && (
        <div className="bg-muted/30 border border-border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Cobertura solar</span>
            <span className="font-semibold text-foreground">
              {coberturaPercent >= 100
                ? `100% coberto${excedentePercent > 0 ? ` + ${excedentePercent}% excedente` : ""}`
                : `${coberturaPercent}% do consumo`
              }
            </span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden relative">
            <div
              className="h-full rounded-full bg-gradient-to-r from-success to-success/70 transition-all duration-500"
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Geração: {Math.round(geracaoMensal)} kWh</span>
            <span>Consumo: {Math.round(consumoMensal)} kWh</span>
          </div>
        </div>
      )}

      {/* Nota sobre Fio B */}
      {showFioB && fioBPercentDisplay !== null && (
        <div className="flex items-start gap-2 bg-warning/5 border border-warning/20 rounded-lg p-3">
          <Info className="w-4 h-4 text-warning shrink-0 mt-0.5" />
          <div className="text-[10px] text-muted-foreground leading-relaxed">
            <span className="font-medium text-foreground">Lei 14.300 (REN 1000)</span> — O valor do crédito
            excedente é reduzido progressivamente até 2029. Em {anoAtual}, {fioBPercentDisplay}% do Fio B
            é cobrado sobre a energia injetada na rede.
          </div>
        </div>
      )}
    </div>
  );
}
