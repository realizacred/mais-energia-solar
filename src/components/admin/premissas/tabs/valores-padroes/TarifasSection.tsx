import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { FieldTooltip, NumField } from "./shared";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
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
  "nenhum", "carport", "ceramico", "fibrocimento", "laje", "shingle",
  "metalico", "zipado", "solo", "sem_estrutura",
];
const TELHADO_LABELS: Record<string, string> = {
  nenhum: "Nenhum", carport: "Carport", ceramico: "Cerâmico", fibrocimento: "Fibrocimento",
  laje: "Laje", shingle: "Shingle", metalico: "Metálico", zipado: "Zipado",
  solo: "Solo", sem_estrutura: "Sem Estrutura",
};

const INCLINACAO_OPTIONS = ["nenhum", "0", "10", "20", "30", "40", "50", "60", "70", "80", "90"];

const TOPOLOGIA_OPTIONS = [
  { value: "tradicional", label: "Tradicional" },
  { value: "microinversor", label: "Microinversor" },
  { value: "otimizador", label: "Otimizador" },
];

export function TarifasSection({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "topologias" | "tipo_kits", item: string) => {
    onChange((p) => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  const isBT = premises.grupo_tarifario === "BT";

  return (
    <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-5 space-y-6">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-warning" />
        <p className="text-xs font-semibold uppercase tracking-wider text-warning">Tarifas e encargos</p>
      </div>

      {/* Grupo tarifário + Tarifa base */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Grupo Tarifário
            <FieldTooltip text="BT = Baixa Tensão (residencial/comercial pequeno). MT = Média Tensão (industrial/comercial grande). Define quais campos de tarifa são exibidos." />
          </Label>
          <Select value={premises.grupo_tarifario} onValueChange={(v) => set("grupo_tarifario", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="BT">Baixa Tensão</SelectItem>
              <SelectItem value="MT">Média Tensão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <NumField label="Tarifa" suffix="R$/kWh" value={premises.tarifa} step="0.00001" tooltip="Tarifa de energia da concessionária (R$/kWh)." onChange={(v) => set("tarifa", v)} />
        {!isBT && (
          <NumField label="Tarifa TE - Ponta" suffix="R$/kWh" value={premises.tarifa_te_ponta} step="0.00001" tooltip="Tarifa de Energia no horário de ponta. Aplicável para Média Tensão." onChange={(v) => set("tarifa_te_ponta", v)} />
        )}
      </div>

      {/* MT-only fields */}
      {!isBT && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Tarifa TUSD - Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_ponta", v)} />
          <NumField label="Tarifa TE - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_te_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_te_fora_ponta", v)} />
          <NumField label="Tarifa TUSD - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_fora_ponta", v)} />
        </div>
      )}

      {/* GD II - Fio B */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GD II — TUSD Fio B (100%)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="TUSD Fio B - Baixa Tensão (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_bt} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_bt", v)} />
          {!isBT && (
            <>
              <NumField label="TUSD Fio B - Fora Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_fora_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_fora_ponta", v)} />
              <NumField label="TUSD Fio B - Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_ponta", v)} />
            </>
          )}
        </div>
      </div>

      {/* GD III - Tarifação Compensada */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          GD III — Tarifação Compensada
          <FieldTooltip text="Tarifação aplicada à energia compensada conforme Lei 14.300/2022." />
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Tarifação Energia Compensada - BT (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_bt} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_bt", v)} />
          {!isBT && (
            <>
              <NumField label="Tarifação Compensada - Fora Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_fora_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_fora_ponta", v)} />
              <NumField label="Tarifação Compensada - Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_ponta", v)} />
            </>
          )}
        </div>
      </div>

      {/* Demanda (MT only) + Fase + Encargos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {!isBT && (
          <>
            <NumField label="Preço da Demanda Geração" suffix="R$" value={premises.preco_demanda_geracao} step="0.01" tooltip="Valor da demanda contratada para geração. Aplicável em Média Tensão." onChange={(v) => set("preco_demanda_geracao", v)} />
            <NumField label="Preço da Demanda" suffix="R$" value={premises.preco_demanda} step="0.01" tooltip="Valor da demanda contratada." onChange={(v) => set("preco_demanda", v)} />
          </>
        )}
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

      {/* Encargos gerais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NumField label="Fator de Simultaneidade" suffix="%" value={premises.fator_simultaneidade} tooltip="Percentual do consumo simultâneo à geração solar." onChange={(v) => set("fator_simultaneidade", v)} />
        <NumField label="Imposto sobre energia" suffix="%" value={premises.imposto_energia} tooltip="Alíquota de ICMS sobre a tarifa de energia." onChange={(v) => set("imposto_energia", v)} />
        <NumField label="Outros Encargos (Atual)" suffix="R$" value={premises.outros_encargos_atual} step="0.01" onChange={(v) => set("outros_encargos_atual", v)} />
      </div>

      {/* Config técnica */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <NumField label="Outros Encargos (Novo)" suffix="R$" value={premises.outros_encargos_novo} step="0.01" onChange={(v) => set("outros_encargos_novo", v)} />
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo de Telhado</Label>
          <Select value={premises.tipo_telhado_padrao} onValueChange={(v) => set("tipo_telhado_padrao", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TELHADO_OPTIONS.map((t) => (
                <SelectItem key={t} value={t}>{TELHADO_LABELS[t] || t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">
            Desvio Azimutal dos Módulos
            <FieldTooltip text="Desvio em graus da orientação Norte." />
          </Label>
          <div className="relative">
            <Input
              type="number"
              step="1"
              value={premises.desvio_azimutal}
              onChange={(e) => set("desvio_azimutal", Number(e.target.value))}
              className="pr-10"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">º</span>
          </div>
        </div>
      </div>

      {/* Inclinação, Topologias, Tipo sistema */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Inclinação dos Módulos</Label>
          <Select value={String(premises.inclinacao_modulos)} onValueChange={(v) => set("inclinacao_modulos", v === "nenhum" ? 0 : Number(v))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCLINACAO_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>{o === "nenhum" ? "Nenhum" : `${o}º`}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Topologias</Label>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {TOPOLOGIA_OPTIONS.map((o) => (
              <Badge
                key={o.value}
                variant={(premises.topologias || []).includes(o.value) ? "default" : "outline"}
                className="cursor-pointer select-none"
                onClick={() => toggleArrayItem("topologias", o.value)}
              >
                {o.label}
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipo de Sistema</Label>
          <Select value={premises.tipo_sistema} onValueChange={(v) => set("tipo_sistema", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="on_grid">On grid</SelectItem>
              <SelectItem value="hibrido">Híbrido</SelectItem>
              <SelectItem value="off_grid">Off grid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
