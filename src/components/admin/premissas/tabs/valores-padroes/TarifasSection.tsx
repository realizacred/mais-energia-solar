import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap, Info, Settings2, Wrench, Gauge, Package } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { FieldTooltip, NumField } from "./shared";
import { Switch } from "@/components/ui/switch";
import { SectionCard } from "@/components/ui-kit/SectionCard";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
  syncedFields?: string[];
}

function h(syncedFields: string[] | undefined, key: string): boolean {
  return syncedFields?.includes(key) ?? false;
}

const FASE_TENSAO_OPTIONS = [
  { value: "monofasico_127", label: "Monofásico 127V" },
  { value: "monofasico_220", label: "Monofásico 220V" },
  { value: "bifasico_127_220", label: "Bifásico 127/220V" },
  { value: "bifasico_220_380", label: "Bifásico 220/380V" },
  { value: "bifasico_277_480", label: "Bifásico 277/480V" },
  { value: "trifasico_127_220", label: "Trifásico 127/220V" },
  { value: "trifasico_220_380", label: "Trifásico 220/380V" },
  { value: "trifasico_277_480", label: "Trifásico 277/480V" },
];

const TELHADO_OPTIONS = [
  { value: "carport", label: "Carport" },
  { value: "ceramico", label: "Cerâmico" },
  { value: "fibrocimento", label: "Fibrocimento" },
  { value: "laje", label: "Laje" },
  { value: "shingle", label: "Shingle" },
  { value: "metalico", label: "Metálico" },
  { value: "zipado", label: "Zipado" },
  { value: "solo", label: "Solo" },
  { value: "sem_estrutura", label: "Sem Estrutura" },
];

const INCLINACAO_OPTIONS = ["nenhum", "0", "10", "20", "30", "40", "50", "60", "70", "80", "90"];

const TOPOLOGIA_OPTIONS = [
  { value: "tradicional", label: "Tradicional" },
  { value: "microinversor", label: "Microinversor" },
  { value: "otimizador", label: "Otimizador" },
];

const SISTEMA_OPTIONS = [
  { value: "on_grid", label: "On Grid" },
  { value: "hibrido", label: "Híbrido" },
  { value: "off_grid", label: "Off Grid" },
];

const KIT_OPTIONS = [
  { value: "fechados", label: "Fechados" },
  { value: "customizados", label: "Customizados" },
];

const PRECO_OPTIONS = [
  { value: "equipamentos", label: "Equipamentos" },
  { value: "total", label: "Total" },
];


export function TarifasSection({ premises, onChange, syncedFields }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "topologias" | "tipo_kits", item: string) => {
    onChange((p) => {
      const arr = (p[key] as string[]) || [];
      return { ...p, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  const toggleTelhado = (item: string) => {
    onChange((p) => {
      const current = (p.tipo_telhado_padrao || "").split(",").map(s => s.trim()).filter(Boolean);
      const next = current.includes(item) ? current.filter(x => x !== item) : [...current, item];
      return { ...p, tipo_telhado_padrao: next.join(",") };
    });
  };

  const telhadoValues = useMemo(() => {
    return (premises.tipo_telhado_padrao || "").split(",").map(s => s.trim()).filter(Boolean);
  }, [premises.tipo_telhado_padrao]);

  const toggleSistema = (item: string) => {
    // tipo_sistema is a string field — we'll treat it as a comma-separated multi-select
    onChange((p) => {
      const current = (p.tipo_sistema || "").split(",").map(s => s.trim()).filter(Boolean);
      const next = current.includes(item) ? current.filter(x => x !== item) : [...current, item];
      return { ...p, tipo_sistema: next.join(",") };
    });
  };

  const sistemaValues = useMemo(() => {
    return (premises.tipo_sistema || "").split(",").map(s => s.trim()).filter(Boolean);
  }, [premises.tipo_sistema]);

  const isBT = premises.grupo_tarifario === "BT";

  // Tarifa integral com impostos (read-only calculated)
  const tarifaIntegral = useMemo(() => {
    const icms = premises.imposto_energia || 0;
    const pis = 1.65;
    const cofins = 7.60;
    const divisor = 1 - (icms + pis + cofins) / 100;
    if (divisor <= 0) return 0;
    return premises.tarifa / divisor;
  }, [premises.tarifa, premises.imposto_energia]);

  return (
    <div className="space-y-5">
      {/* Card 1: Tarifas Básicas */}
      <SectionCard icon={Zap} title="Tarifas e Grupo Tarifário" variant="warning">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Grupo Tarifário
                <FieldTooltip text="BT = Baixa Tensão (residencial/comercial pequeno). MT = Média Tensão (industrial/comercial grande)." />
              </Label>
              <Select value={premises.grupo_tarifario} onValueChange={(v) => set("grupo_tarifario", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BT">Baixa Tensão</SelectItem>
                  <SelectItem value="MT">Média Tensão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumField label="Tarifa (TE + TUSD)" suffix="R$/kWh" value={premises.tarifa} step="0.00001" tooltip="Tarifa total da concessionária (TE + TUSD), sem impostos." highlight={h(syncedFields, "tarifa")} onChange={(v) => set("tarifa", v)} />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                Tarifa Integral c/ Impostos
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs space-y-1 max-w-xs">
                    <p className="font-semibold">Cálculo automático</p>
                    <p className="font-mono">Tarifa / (1 - (ICMS + PIS + COFINS) / 100)</p>
                    <p className="font-mono">= {premises.tarifa.toFixed(5)} / (1 - ({premises.imposto_energia} + 1,65 + 7,60) / 100)</p>
                  </TooltipContent>
                </Tooltip>
              </Label>
              <div className="relative">
                <Input type="text" readOnly value={tarifaIntegral.toFixed(5)} className="bg-muted/50 font-mono text-sm cursor-default pr-16" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">R$/kWh</span>
              </div>
              <p className="text-[10px] text-muted-foreground">Valor calculado (não editável)</p>
            </div>
          </div>

          {/* MT-only: TE/TUSD Ponta e Fora Ponta */}
          {!isBT && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <NumField label="Tarifa TE - Ponta" suffix="R$/kWh" value={premises.tarifa_te_ponta} step="0.00001" tooltip="Tarifa de Energia no horário de ponta." highlight={h(syncedFields, "tarifa_te_ponta")} onChange={(v) => set("tarifa_te_ponta", v)} />
              <NumField label="Tarifa TE - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_te_fora_ponta} step="0.00001" highlight={h(syncedFields, "tarifa_te_fora_ponta")} onChange={(v) => set("tarifa_te_fora_ponta", v)} />
              <NumField label="Tarifa TUSD - Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_ponta} step="0.00001" highlight={h(syncedFields, "tarifa_tusd_ponta")} onChange={(v) => set("tarifa_tusd_ponta", v)} />
              <NumField label="Tarifa TUSD - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_fora_ponta} step="0.00001" highlight={h(syncedFields, "tarifa_tusd_fora_ponta")} onChange={(v) => set("tarifa_tusd_fora_ponta", v)} />
            </div>
          )}
        </div>
      </SectionCard>

      {/* Card 2: GD II - Fio B */}
      <SectionCard icon={Zap} title="GD II — TUSD Fio B (100%)" variant="blue">
        {isBT ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="TUSD Fio B - BT (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_bt} step="0.00001" subtext="100% TUSD Fio B" highlight={h(syncedFields, "tusd_fio_b_bt")} onChange={(v) => set("tusd_fio_b_bt", v)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="TUSD Fio B - Fora Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_fora_ponta} step="0.00001" subtext="100% TUSD Fio B" highlight={h(syncedFields, "tusd_fio_b_fora_ponta")} onChange={(v) => set("tusd_fio_b_fora_ponta", v)} />
            <NumField label="TUSD Fio B - Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_ponta} step="0.00001" subtext="100% TUSD Fio B" highlight={h(syncedFields, "tusd_fio_b_ponta")} onChange={(v) => set("tusd_fio_b_ponta", v)} />
          </div>
        )}
      </SectionCard>

      {/* Card 3: GD III - Tarifação Compensada */}
      <SectionCard icon={Zap} title="GD III — Tarifação Compensada" description="Tarifação aplicada à energia compensada conforme Lei 14.300/2022." variant="blue">
        {isBT ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Tarifação Compensada - BT (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_bt} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" highlight={h(syncedFields, "tarifacao_compensada_bt")} onChange={(v) => set("tarifacao_compensada_bt", v)} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Tarifação Compensada - Fora Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_fora_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" highlight={h(syncedFields, "tarifacao_compensada_fora_ponta")} onChange={(v) => set("tarifacao_compensada_fora_ponta", v)} />
            <NumField label="Tarifação Compensada - Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" highlight={h(syncedFields, "tarifacao_compensada_ponta")} onChange={(v) => set("tarifacao_compensada_ponta", v)} />
          </div>
        )}
      </SectionCard>

      {/* Card 4: Encargos e Demanda */}
      <SectionCard icon={Settings2} title="Encargos e Demanda" variant="green">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Preço da Demanda Geração" suffix="R$" value={premises.preco_demanda_geracao} step="0.01" tooltip="Valor da demanda contratada para geração." highlight={h(syncedFields, "preco_demanda_geracao")} onChange={(v) => set("preco_demanda_geracao", v)} />
            <NumField label="Preço da Demanda" suffix="R$" value={premises.preco_demanda} step="0.01" tooltip="Valor da demanda contratada." highlight={h(syncedFields, "preco_demanda")} onChange={(v) => set("preco_demanda", v)} />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                Fase e Tensão da Rede
                <FieldTooltip text="Define a tensão da rede elétrica do local." />
              </Label>
              <Select value={premises.fase_tensao_rede} onValueChange={(v) => set("fase_tensao_rede", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FASE_TENSAO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Fator de Simultaneidade" suffix="%" value={premises.fator_simultaneidade} tooltip="Percentual do consumo simultâneo à geração solar." onChange={(v) => set("fator_simultaneidade", v)} />
            <NumField label="Imposto sobre energia" suffix="%" value={premises.imposto_energia} tooltip="Alíquota de ICMS sobre a tarifa de energia." highlight={h(syncedFields, "imposto_energia")} onChange={(v) => set("imposto_energia", v)} />
            <NumField label="Outros Encargos (Atual)" suffix="R$" value={premises.outros_encargos_atual} step="0.01" onChange={(v) => set("outros_encargos_atual", v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Outros Encargos (Novo)" suffix="R$" value={premises.outros_encargos_novo} step="0.01" onChange={(v) => set("outros_encargos_novo", v)} />
          </div>
        </div>
      </SectionCard>

      {/* Configuração Técnica removida — dados agora gerenciados por tipo de telhado */}

      {/* Card 6: Desempenho */}
      <SectionCard icon={Gauge} title="Taxas de Desempenho" variant="neutral">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Taxa de Desempenho (Tradicional)" suffix="%" value={premises.taxa_desempenho_tradicional} onChange={(v) => set("taxa_desempenho_tradicional", v)} />
          <NumField label="Taxa de Desempenho (Microinversor)" suffix="%" value={premises.taxa_desempenho_microinversor} onChange={(v) => set("taxa_desempenho_microinversor", v)} />
          <NumField label="Taxa de Desempenho (Otimizador)" suffix="%" value={premises.taxa_desempenho_otimizador} onChange={(v) => set("taxa_desempenho_otimizador", v)} />
        </div>
      </SectionCard>

      {/* Card 7: Kits e Fornecedores */}
      <SectionCard icon={Package} title="Kits e Fornecedores" variant="green">
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de Kits</Label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {KIT_OPTIONS.map((o) => (
                  <Badge
                    key={o.value}
                    variant={(premises.tipo_kits || []).includes(o.value) ? "default" : "outline"}
                    className="cursor-pointer select-none"
                    onClick={() => toggleArrayItem("tipo_kits", o.value)}
                  >
                    {o.label}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Considerar kits que necessitam de transformador</Label>
              <div className="flex items-center gap-2 pt-2">
                <Switch
                  checked={premises.considerar_kits_transformador}
                  onCheckedChange={(v) => set("considerar_kits_transformador", v)}
                />
                <span className="text-xs text-muted-foreground">
                  {premises.considerar_kits_transformador ? "Habilitado" : "Desabilitado"}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Tipo de Preço</Label>
              <Select value={premises.tipo_preco} onValueChange={(v) => set("tipo_preco", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRECO_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField
              label="DoD"
              suffix="%"
              value={premises.dod}
              tooltip="Depth of Discharge — profundidade de descarga para sistemas com bateria."
              onChange={(v) => set("dod", v)}
            />
          </div>
          <div className="space-y-3 pt-2 border-t border-border/30">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-medium text-muted-foreground">Filtrar por Fornecedores</Label>
                <p className="text-[10px] text-muted-foreground">
                  {premises.fornecedor_filtro === "escolher"
                    ? "Apenas fornecedores selecionados serão considerados"
                    : "Todos os fornecedores disponíveis serão considerados"}
                </p>
              </div>
              <Switch
                checked={premises.fornecedor_filtro === "escolher"}
                onCheckedChange={(v) => set("fornecedor_filtro", v ? "escolher" : "qualquer")}
              />
            </div>
            {premises.fornecedor_filtro === "escolher" && (
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                <p className="text-xs text-muted-foreground italic">
                  O cadastro de fornecedores ainda não está disponível. Em breve você poderá selecionar fornecedores específicos aqui.
                </p>
              </div>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
