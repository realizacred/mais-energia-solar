import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, HelpCircle, Info, Zap, ShieldCheck, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { calcGrupoB, type CalcGrupoBInput, type RegraGD, type TipoFase, type TariffComponentes, type CustoDisponibilidade, type NivelPrecisao } from "@/lib/calcGrupoB";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ResumoGrupoBProps {
  geracaoMensalKwh: number;
  consumoMensalKwh: number;
  regra: RegraGD;
  fase?: TipoFase;
  tariff: TariffComponentes;
  custoDisponibilidade: CustoDisponibilidade;
  ano?: number;
  className?: string;
}

// ── Tooltip helpers ──────────────────────────────────────────────────────────

function AuditTooltip({ children, content }: { children: React.ReactNode; content: React.ReactNode }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-0.5 cursor-help">{children}<Info className="w-3 h-3 text-muted-foreground/60" /></span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{content}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HelpTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="w-3 h-3 text-muted-foreground/50 cursor-help inline ml-0.5" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function OrigemBadge({ origem }: { origem?: string }) {
  if (!origem) return null;
  const config = {
    ANEEL:    { label: "ANEEL", variant: "default" as const },
    manual:   { label: "Editado", variant: "outline" as const },
    premissa: { label: "Premissa", variant: "secondary" as const },
  };
  const cfg = config[origem as keyof typeof config] ?? { label: origem, variant: "outline" as const };
  return <Badge variant={cfg.variant} className="text-xs px-1.5 py-0">{cfg.label}</Badge>;
}

function PrecisaoBadge({ precisao, motivo }: { precisao: NivelPrecisao; motivo: string }) {
  if (precisao === 'exato') {
    return (
      <AuditTooltip content={motivo}>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success">
          <ShieldCheck className="w-3 h-3" />
          EXATO
        </span>
      </AuditTooltip>
    );
  }
  return (
    <AuditTooltip content={motivo}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-warning/10 text-warning">
        <ShieldAlert className="w-3 h-3" />
        ESTIMADO
      </span>
    </AuditTooltip>
  );
}

function CalcRow({ label, value, sub, highlight, help }: { label: string; value: string; sub?: string; highlight?: boolean; help?: string }) {
  return (
    <div className={cn("flex items-start justify-between py-2 border-b border-border/40 last:border-0 gap-2", highlight && "font-semibold")}>
      <span className={cn("text-xs text-muted-foreground flex items-center", highlight && "text-foreground")}>
        {label}
        {help && <HelpTooltip text={help} />}
      </span>
      <div className="text-right">
        <span className={cn("text-xs tabular-nums", highlight && "text-primary")}>{value}</span>
        {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
      </div>
    </div>
  );
}

const REGRA_LABEL: Record<RegraGD, string> = {
  GD_I: "GD I — Compensação integral",
  GD_II: "GD II — Lei 14.300",
  GD_III: "GD III — Alta tensão",
};

// ── Main component ───────────────────────────────────────────────────────────

export function ResumoGrupoB({
  geracaoMensalKwh,
  consumoMensalKwh,
  regra,
  fase = "monofasico",
  tariff,
  custoDisponibilidade,
  ano = 2026,
  className,
}: ResumoGrupoBProps) {
  const [open, setOpen] = useState(false);

  if (!tariff.te_kwh && !tariff.tusd_fio_b_kwh) return null;

  const result = calcGrupoB({
    regra, fase,
    geracao_mensal_kwh: geracaoMensalKwh,
    consumo_mensal_kwh: consumoMensalKwh,
    tariff, custo_disponibilidade: custoDisponibilidade,
    ano,
  });

  const hasAlertas = result.alertas.length > 0;
  const fmtKwh = (v: number) => `${v.toFixed(1)} kWh/mês`;
  const fmtRS = (v: number) => `R$ ${v.toFixed(2)}/mês`;
  const fioBPctLabel = result.fio_b_percent_cobrado != null
    ? `${Math.round((1 - result.fio_b_percent_cobrado) * 100)}%`
    : "N/A";

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn("rounded-lg border border-border/50 bg-card", className)}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center justify-between p-3 hover:bg-muted/30 rounded-lg transition-colors">
          <div className="flex items-center gap-2 flex-wrap">
            <Zap className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Resumo do Cálculo GD</span>
            <Badge variant="secondary" className="text-xs">{REGRA_LABEL[regra]}</Badge>
            <PrecisaoBadge precisao={result.precisao} motivo={result.precisao_motivo} />
            {result.regra_nao_modelada && (
              <Badge variant="outline" className="text-xs text-destructive border-destructive/40 bg-destructive/10">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Regra 2029+ não modelada
              </Badge>
            )}
            {result.incompleto_gd3 && (
              <Badge variant="outline" className="text-xs text-warning border-warning/40 bg-warning/10">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Incompleto
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-primary">{fmtRS(result.economia_mensal_rs)}</span>
            {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="px-3 pb-3 space-y-3">
          {/* Regra não modelada warning */}
          {result.regra_nao_modelada && (
            <div className="p-2.5 rounded-md bg-destructive/5 border border-destructive/20 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-destructive">Ano {ano} — regra GD II pós-2028 não modelada.</strong>{" "}
                O cálculo usa fallback conservador (90% cobrado). Confirme os valores antes de gerar proposta.
              </p>
            </div>
          )}

          {/* Precision microcopy */}
          {result.precisao === 'estimado' && (
            <div className="p-2.5 rounded-md bg-warning/5 border border-warning/20 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-warning">Precisão estimada:</strong> {result.precisao_motivo}
              </p>
            </div>
          )}
          {result.precisao === 'exato' && (
            <div className="p-2.5 rounded-md bg-success/5 border border-success/20 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-success mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                <strong className="text-success">Precisão exata:</strong> {result.precisao_motivo}
              </p>
            </div>
          )}

          {/* Tariff origin with audit tooltip */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b border-border/40">
            <AuditTooltip content={
              <div className="space-y-1">
                <div><strong>Fonte:</strong> {result.origem_tariff}</div>
                {result.vigencia_tariff && <div><strong>Vigência:</strong> {result.vigencia_tariff}</div>}
                <div><strong>Precisão:</strong> {result.precisao === 'exato' ? 'EXATO (Fio B real)' : 'ESTIMADO (TUSD proxy)'}</div>
              </div>
            }>
              <span>Tarifa:</span>
            </AuditTooltip>
            <OrigemBadge origem={result.origem_tariff} />
            {result.vigencia_tariff && (
              <span>· vigência {result.vigencia_tariff}</span>
            )}
            <span className="ml-auto font-mono">{ano} · {regra.replace("_", " ")}</span>
          </div>

          {/* Cálculo passo a passo */}
          <div>
            <CalcRow
              label="Consumo mensal"
              value={fmtKwh(result.consumo_kwh)}
            />
            <CalcRow
              label={`Custo de disponibilidade (${fase})`}
              value={`− ${result.custo_disponibilidade_kwh} kWh`}
              sub="mínimo cobrado pela distribuidora"
              help="Custo de disponibilidade: mínimo cobrado pela distribuidora mesmo com sistema solar instalado."
            />
            <CalcRow
              label="Consumo compensável"
              value={fmtKwh(result.consumo_compensavel_kwh)}
              help="Energia compensável = consumo − custo de disponibilidade."
            />
            <CalcRow
              label="Geração mensal"
              value={fmtKwh(result.geracao_kwh)}
            />
            <CalcRow
              label="Energia compensada"
              value={fmtKwh(result.energia_compensada_kwh)}
              sub={result.energia_compensada_kwh < result.geracao_kwh ? "limitada ao consumo compensável" : "geração totalmente compensada"}
              help="Energia compensada = menor entre geração e consumo compensável."
            />
          </div>

          {/* Composição do crédito */}
          <div className="rounded-md bg-muted/40 p-2.5 space-y-1">
            <div className="text-xs font-medium text-foreground mb-2 flex items-center gap-1">
              Composição do crédito (R$/kWh)
              <HelpTooltip text={
                regra === "GD_II"
                  ? `GD II ${ano}: ${result.fio_b_percent_cobrado != null ? Math.round(result.fio_b_percent_cobrado * 100) : '?'}% do Fio B é cobrado → ${fioBPctLabel} vira crédito.`
                  : regra === "GD_III"
                  ? "GD III: TE + 100% Fio B + 40% Fio A + TFSEE + P&D."
                  : "GD I: compensação integral de TE + Fio B."
              } />
            </div>
            <div className="flex justify-between text-xs">
              <AuditTooltip content={
                <div className="space-y-1">
                  <div><strong>Tarifa de Energia (TE)</strong></div>
                  <div>Fonte: {result.origem_tariff}</div>
                  {result.vigencia_tariff && <div>Vigência: {result.vigencia_tariff}</div>}
                </div>
              }>
                <span className="text-muted-foreground">TE (Tarifa de Energia)</span>
              </AuditTooltip>
              <span className="font-mono">{result.valor_credito_breakdown.te.toFixed(6)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <AuditTooltip content={
                result.valor_credito_breakdown.fio_b_fonte === 'tusd_proxy'
                  ? "ESTIMADO: Fio B real indisponível; usamos TUSD total como aproximação. Economia pode variar."
                  : "EXATO: Fio B real configurado manualmente na distribuidora."
              }>
                <span className="text-muted-foreground">
                  Fio B compensado
                  {result.valor_credito_breakdown.fio_b_fonte === 'tusd_proxy' && (
                    <span className="text-warning"> (TUSD proxy)</span>
                  )}
                  {regra === "GD_II" && <span className="text-info"> ({fioBPctLabel} em {ano})</span>}
                  {regra === "GD_III" && <span className="text-info"> (100% em GD III)</span>}
                </span>
              </AuditTooltip>
              <span className="font-mono">{result.valor_credito_breakdown.fio_b_compensado.toFixed(6)}</span>
            </div>
            {regra === "GD_III" && result.valor_credito_breakdown.fio_a !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Fio A (40%)</span>
                <span className={cn("font-mono", result.incompleto_gd3 && "text-warning")}>{result.valor_credito_breakdown.fio_a.toFixed(6)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs border-t border-border/40 pt-1 font-semibold">
              <span>Total crédito/kWh</span>
              <span className="font-mono text-primary">{result.valor_credito_kwh.toFixed(6)}</span>
            </div>
          </div>

          {/* Resultado */}
          <CalcRow
            label="Economia mensal estimada"
            value={fmtRS(result.economia_mensal_rs)}
            sub={`${fmtKwh(result.energia_compensada_kwh)} × R$ ${result.valor_credito_kwh.toFixed(4)}/kWh`}
            highlight
          />

          {/* Alertas */}
          {hasAlertas && (
            <div className="space-y-1">
              {result.alertas.map((a, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs text-warning">
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{a}</span>
                </div>
              ))}
            </div>
          )}

          {!hasAlertas && (
            <div className="flex items-center gap-1.5 text-xs text-success">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Cálculo completo e auditável</span>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
