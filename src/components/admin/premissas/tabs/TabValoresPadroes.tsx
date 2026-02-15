import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

function NumField({ label, suffix, value, step, subtext, onChange }: {
  label: string; suffix: string; value: number; step?: string; subtext?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step={step || "0.01"}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-16"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">{suffix}</span>
      </div>
      {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
    </div>
  );
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

const TIPO_KIT_OPTIONS = [
  { value: "fechados", label: "Fechados" },
  { value: "customizados", label: "Customizados" },
];

export function TabValoresPadroes({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "topologias" | "tipo_kits", item: string) => {
    onChange((p) => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Linha 1 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Grupo Tarifário</Label>
            <Select value={premises.grupo_tarifario} onValueChange={(v) => set("grupo_tarifario", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BT">Baixa Tensão</SelectItem>
                <SelectItem value="MT">Média Tensão</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumField label="Tarifa" suffix="R$/kWh" value={premises.tarifa} step="0.00001" onChange={(v) => set("tarifa", v)} />
          <NumField label="Tarifa TE - Ponta" suffix="R$/kWh" value={premises.tarifa_te_ponta} step="0.00001" onChange={(v) => set("tarifa_te_ponta", v)} />
        </div>

        {/* Linha 2 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Tarifa TUSD - Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_ponta", v)} />
          <NumField label="Tarifa TE - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_te_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_te_fora_ponta", v)} />
          <NumField label="Tarifa TUSD - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_fora_ponta", v)} />
        </div>

        {/* Linha 3 - Fio B GD II */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="TUSD Fio B - Baixa Tensão (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_bt} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_bt", v)} />
          <NumField label="TUSD Fio B - Fora Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_fora_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_fora_ponta", v)} />
          <NumField label="TUSD Fio B - Ponta (GD II)" suffix="R$/kWh" value={premises.tusd_fio_b_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_ponta", v)} />
        </div>

        {/* Linha 4 - GD III */}
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground">100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Tarifação Energia Compensada - Baixa Tensão (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_bt} step="0.00001" onChange={(v) => set("tarifacao_compensada_bt", v)} />
            <NumField label="Tarifação Energia Compensada - Fora Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_fora_ponta} step="0.00001" onChange={(v) => set("tarifacao_compensada_fora_ponta", v)} />
            <NumField label="Tarifação Energia Compensada - Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_ponta} step="0.00001" onChange={(v) => set("tarifacao_compensada_ponta", v)} />
          </div>
        </div>

        {/* Linha 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Preço da Demanda Geração" suffix="R$" value={premises.preco_demanda_geracao} step="0.01" onChange={(v) => set("preco_demanda_geracao", v)} />
          <NumField label="Preço da Demanda" suffix="R$" value={premises.preco_demanda} step="0.01" onChange={(v) => set("preco_demanda", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Fase e Tensão da Rede</Label>
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

        {/* Linha 6 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Fator de Simultaneidade" suffix="%" value={premises.fator_simultaneidade} onChange={(v) => set("fator_simultaneidade", v)} />
          <NumField label="Imposto sobre energia" suffix="%" value={premises.imposto_energia} onChange={(v) => set("imposto_energia", v)} />
          <NumField label="Outros Encargos (Atual)" suffix="R$" value={premises.outros_encargos_atual} step="0.01" onChange={(v) => set("outros_encargos_atual", v)} />
        </div>

        {/* Linha 7 */}
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
            <Label className="text-xs font-medium text-muted-foreground">Desvio Azimutal dos Módulos</Label>
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

        {/* Linha 8 */}
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

        {/* Linha 9 - Desempenho */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Taxa de Desempenho do Sistema (Tradicional)" suffix="%" value={premises.taxa_desempenho_tradicional} onChange={(v) => set("taxa_desempenho_tradicional", v)} />
          <NumField label="Taxa de Desempenho do Sistema (Microinversor)" suffix="%" value={premises.taxa_desempenho_microinversor} onChange={(v) => set("taxa_desempenho_microinversor", v)} />
          <NumField label="Taxa de Desempenho do Sistema (Otimizador)" suffix="%" value={premises.taxa_desempenho_otimizador} onChange={(v) => set("taxa_desempenho_otimizador", v)} />
        </div>

        {/* Linha 10 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de Kits</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {TIPO_KIT_OPTIONS.map((o) => (
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
            <Select
              value={premises.considerar_kits_transformador ? "habilitado" : "desabilitado"}
              onValueChange={(v) => set("considerar_kits_transformador", v === "habilitado")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="habilitado">Habilitado</SelectItem>
                <SelectItem value="desabilitado">Desabilitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Tipo de Preço</Label>
            <Select value={premises.tipo_preco} onValueChange={(v) => set("tipo_preco", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="equipamentos">Equipamentos</SelectItem>
                <SelectItem value="venda_total">Venda total</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Linha 11 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="DoD" suffix="%" value={premises.dod} onChange={(v) => set("dod", v)} />
          <div />
          <div />
        </div>

        {/* Fornecedores */}
        <div className="rounded-xl border border-border/50 p-4 space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fornecedores</Label>
          <Select value={premises.fornecedor_filtro} onValueChange={(v) => set("fornecedor_filtro", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="qualquer">Qualquer fornecedor</SelectItem>
              <SelectItem value="escolher">Escolher fornecedores</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}
