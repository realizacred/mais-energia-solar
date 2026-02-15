import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  aliquota_icms: number | null;
  custo_disponibilidade_monofasico: number | null;
  custo_disponibilidade_bifasico: number | null;
  custo_disponibilidade_trifasico: number | null;
  possui_isencao_scee: boolean | null;
  percentual_isencao: number | null;
}

function FieldTooltip({ text }: { text: string }) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 hover:text-primary cursor-help inline-block ml-1" />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] text-xs">
          <p>{text}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function NumField({ label, suffix, value, step, subtext, tooltip, onChange }: {
  label: string; suffix: string; value: number; step?: string; subtext?: string; tooltip?: string;
  onChange: (v: number) => void;
}) {
  const isPercent = suffix === "%";
  const isKwh = suffix === "R$/kWh";
  const isReais = suffix === "R$";

  const formatValue = () => {
    if (isPercent) return value.toFixed(2);
    if (isKwh) return value.toFixed(5);
    if (isReais) return value.toFixed(2);
    return value;
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step || (isKwh ? "0.00001" : "0.01")}
          value={formatValue()}
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
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(true);

  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  const toggleArrayItem = (key: "topologias" | "tipo_kits", item: string) => {
    onChange((p) => {
      const arr = p[key] as string[];
      return { ...p, [key]: arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item] };
    });
  };

  useEffect(() => {
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b, aliquota_icms, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, possui_isencao_scee, percentual_isencao")
      .eq("ativo", true)
      .order("nome")
      .then(({ data }) => {
        if (data) setConcessionarias(data as Concessionaria[]);
        setLoadingConc(false);
      });
  }, []);

  const handleConcessionariaChange = useCallback((concId: string) => {
    const conc = concessionarias.find((c) => c.id === concId);
    if (!conc) return;

    onChange((p) => ({
      ...p,
      concessionaria_id: concId,
      tarifa: conc.tarifa_energia ?? p.tarifa,
      tusd_fio_b_bt: conc.tarifa_fio_b ?? p.tusd_fio_b_bt,
      imposto_energia: conc.aliquota_icms ?? p.imposto_energia,
    }));
  }, [concessionarias, onChange]);

  const isBT = premises.grupo_tarifario === "BT";
  const isOnGrid = premises.tipo_sistema === "on_grid";
  const selectedConc = concessionarias.find((c) => c.id === (premises as any).concessionaria_id);

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">

        {/* Concessionária Selector */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            Concessionária Padrão
            <FieldTooltip text="Selecione a concessionária para preencher automaticamente os campos de tarifa, Fio B e ICMS. Os valores podem ser ajustados manualmente depois." />
          </Label>
          <Select
            value={(premises as any).concessionaria_id || ""}
            onValueChange={handleConcessionariaChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={loadingConc ? "Carregando..." : "Selecione a concessionária"} />
            </SelectTrigger>
            <SelectContent>
              {concessionarias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome} {c.sigla ? `(${c.sigla})` : ""} — {c.estado || ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedConc && (
            <div className="flex flex-wrap gap-2 text-[10px]">
              <Badge variant="outline" className="text-[10px]">Tarifa: R$ {selectedConc.tarifa_energia?.toFixed(3) ?? "—"}/kWh</Badge>
              <Badge variant="outline" className="text-[10px]">Fio B: R$ {selectedConc.tarifa_fio_b?.toFixed(3) ?? "—"}/kWh</Badge>
              <Badge variant="outline" className="text-[10px]">ICMS: {selectedConc.aliquota_icms ?? "—"}%</Badge>
              {selectedConc.possui_isencao_scee && (
                <Badge variant="secondary" className="text-[10px]">Isenção SCEE: {selectedConc.percentual_isencao}%</Badge>
              )}
            </div>
          )}
        </div>

        {/* Linha 1 */}
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
          <NumField label="Tarifa" suffix="R$/kWh" value={premises.tarifa} step="0.00001" tooltip="Tarifa de energia da concessionária (R$/kWh). Auto-preenchido pela concessionária selecionada." onChange={(v) => set("tarifa", v)} />
          {!isBT && (
            <NumField label="Tarifa TE - Ponta" suffix="R$/kWh" value={premises.tarifa_te_ponta} step="0.00001" tooltip="Tarifa de Energia no horário de ponta. Aplicável apenas para Média Tensão." onChange={(v) => set("tarifa_te_ponta", v)} />
          )}
        </div>

        {/* Campos MT - Ponta/Fora Ponta */}
        {!isBT && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Tarifa TUSD - Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_ponta", v)} />
            <NumField label="Tarifa TE - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_te_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_te_fora_ponta", v)} />
            <NumField label="Tarifa TUSD - Fora Ponta" suffix="R$/kWh" value={premises.tarifa_tusd_fora_ponta} step="0.00001" onChange={(v) => set("tarifa_tusd_fora_ponta", v)} />
          </div>
        )}

        {/* Linha 3 - Fio B GD II */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GD II — TUSD Fio B (100%)</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="TUSD Fio B - Baixa Tensão" suffix="R$/kWh" value={premises.tusd_fio_b_bt} step="0.00001" subtext="100% TUSD Fio B" tooltip="Componente da tarifa referente ao uso do fio da distribuidora. Auto-preenchido pela concessionária." onChange={(v) => set("tusd_fio_b_bt", v)} />
            {!isBT && (
              <>
                <NumField label="TUSD Fio B - Fora Ponta" suffix="R$/kWh" value={premises.tusd_fio_b_fora_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_fora_ponta", v)} />
                <NumField label="TUSD Fio B - Ponta" suffix="R$/kWh" value={premises.tusd_fio_b_ponta} step="0.00001" subtext="100% TUSD Fio B" onChange={(v) => set("tusd_fio_b_ponta", v)} />
              </>
            )}
          </div>
        </div>

        {/* Linha 4 - GD III */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            GD III — Tarifação Compensada
            <FieldTooltip text="Tarifação aplicada à energia compensada conforme Lei 14.300/2022. Composta por: 100% da TUSD Fio B + 40% da TUSD Fio A + TFSEE (Taxa de Fiscalização) + P&D (Pesquisa e Desenvolvimento). Este valor é cobrado sobre cada kWh de energia injetada e compensada na rede." />
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField label="Tarifação Compensada - Baixa Tensão (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_bt} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_bt", v)} />
            {!isBT && (
              <>
                <NumField label="Tarifação Compensada - Fora Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_fora_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_fora_ponta", v)} />
                <NumField label="Tarifação Compensada - Ponta (GD III)" suffix="R$/kWh" value={premises.tarifacao_compensada_ponta} step="0.00001" subtext="100% TUSD Fio B + 40% TUSD Fio A + TFSEE + P&D" onChange={(v) => set("tarifacao_compensada_ponta", v)} />
              </>
            )}
          </div>
        </div>

        {/* Linha 5 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {!isBT && (
            <>
              <NumField label="Preço da Demanda Geração" suffix="R$" value={premises.preco_demanda_geracao} step="0.01" tooltip="Valor da demanda contratada para geração. Aplicável apenas em Média Tensão." onChange={(v) => set("preco_demanda_geracao", v)} />
              <NumField label="Preço da Demanda" suffix="R$" value={premises.preco_demanda} step="0.01" tooltip="Valor da demanda contratada. Aplicável apenas em Média Tensão." onChange={(v) => set("preco_demanda", v)} />
            </>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Fase e Tensão da Rede
              <FieldTooltip text="Define a tensão da rede elétrica do local. Afeta o custo de disponibilidade (mono/bi/trifásico)." />
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

        {/* Linha 6 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Fator de Simultaneidade" suffix="%" value={premises.fator_simultaneidade} tooltip="Percentual do consumo que é simultâneo à geração solar. Maior fator = mais autoconsumo e maior economia. Típico: 20-40% residencial, 50-80% comercial." onChange={(v) => set("fator_simultaneidade", v)} />
          <NumField label="Imposto sobre energia" suffix="%" value={premises.imposto_energia} tooltip="Alíquota de ICMS sobre a tarifa de energia. Auto-preenchido pela concessionária selecionada." onChange={(v) => set("imposto_energia", v)} />
          <NumField label="Outros Encargos (Atual)" suffix="R$" value={premises.outros_encargos_atual} step="0.01" tooltip="Encargos adicionais cobrados atualmente na fatura (bandeira tarifária, CIP, etc.)." onChange={(v) => set("outros_encargos_atual", v)} />
        </div>

        {/* Linha 7 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <NumField label="Outros Encargos (Novo)" suffix="R$" value={premises.outros_encargos_novo} step="0.01" tooltip="Encargos estimados na fatura após a instalação do sistema solar." onChange={(v) => set("outros_encargos_novo", v)} />
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
              <FieldTooltip text="Desvio em graus da orientação Norte. 0° = Norte puro (ideal no hemisfério sul). Valores positivos = desvio para leste." />
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
          <NumField label="Taxa de Desempenho (Tradicional)" suffix="%" value={premises.taxa_desempenho_tradicional} tooltip="Performance Ratio (PR) do sistema com inversor string. Considera perdas por sujeira, sombreamento, fiação, temperatura. Típico: 65-75%." onChange={(v) => set("taxa_desempenho_tradicional", v)} />
          <NumField label="Taxa de Desempenho (Microinversor)" suffix="%" value={premises.taxa_desempenho_microinversor} tooltip="Performance Ratio para microinversores. Maior por eliminar mismatch entre módulos. Típico: 70-78%." onChange={(v) => set("taxa_desempenho_microinversor", v)} />
          <NumField label="Taxa de Desempenho (Otimizador)" suffix="%" value={premises.taxa_desempenho_otimizador} tooltip="Performance Ratio para otimizadores DC. Melhora MPPT individual por módulo. Típico: 72-80%." onChange={(v) => set("taxa_desempenho_otimizador", v)} />
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

        {/* DoD - Condicional: só exibe para híbrido/off-grid */}
        {!isOnGrid && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NumField
              label="DoD (Profundidade de Descarga)"
              suffix="%"
              value={premises.dod}
              tooltip="Depth of Discharge — percentual máximo que a bateria pode ser descarregada por ciclo. Valores maiores = mais energia utilizável, mas reduz a vida útil. Recomendado: 80% para lítio, 50% para chumbo-ácido."
              onChange={(v) => set("dod", v)}
            />
            <div />
            <div />
          </div>
        )}

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