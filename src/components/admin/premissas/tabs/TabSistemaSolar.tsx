import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Info, CheckCircle2, AlertTriangle, Sun, Gauge, RefreshCw, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises } from "@/hooks/useTenantPremises";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { FieldTooltip, NumField } from "./valores-padroes/shared";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
}

export function TabSistemaSolar({ premises, onChange }: Props) {
  const set = (key: keyof TenantPremises, value: any) =>
    onChange((p) => ({ ...p, [key]: value }));

  // Fetch irradiance base status
  const [baseStatus, setBaseStatus] = useState<Record<string, { active: boolean; points: number; tag: string }>>({});
  useEffect(() => {
    (async () => {
      const { data: datasets } = await supabase
        .from("irradiance_datasets")
        .select("id, code");
      if (!datasets) return;
      const { data: versions } = await supabase
        .from("irradiance_dataset_versions")
        .select("dataset_id, status, row_count, version_tag")
        .eq("status", "active");
      const status: typeof baseStatus = {};
      const codeMap: Record<string, string> = {
        INPE_2017_SUNDATA: "inpe_2017",
        INPE_2009_10KM: "inpe_2009",
      };
      for (const ds of datasets) {
        const key = codeMap[ds.code];
        if (!key) continue;
        const ver = versions?.find(v => v.dataset_id === ds.id);
        status[key] = {
          active: !!ver && (ver.row_count ?? 0) > 0,
          points: ver?.row_count ?? 0,
          tag: ver?.version_tag ?? "",
        };
      }
      setBaseStatus(status);
    })();
  }, []);

  const BASES = [
    { value: "inpe_2017", label: "Atlas Brasileiro 2ª Edição (INPE 2017 - SUNDATA)" },
    { value: "inpe_2009", label: "Brazil Solar Global 10KM (INPE 2009)" },
  ];

  const currentBase = baseStatus[premises.base_irradiancia];

  return (
    <div className="space-y-5">
      {/* Base de irradiância */}
      <SectionCard icon={Sun} title="Base de irradiância" variant="neutral">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Fonte dos dados
              <FieldTooltip text="Fonte dos dados de irradiação solar. INPE 2017 é mais recente e recomendado." />
            </Label>
            <Select value={premises.base_irradiancia} onValueChange={(v) => set("base_irradiancia", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASES.map(base => {
                  const st = baseStatus[base.value];
                  const hasData = st?.active;
                  return (
                    <SelectItem key={base.value} value={base.value} disabled={!hasData && st !== undefined}>
                      <div className="flex items-center gap-2">
                        <span className={!hasData && st !== undefined ? "text-muted-foreground" : ""}>{base.label}</span>
                        {st !== undefined && (
                          hasData ? (
                            <Badge variant="secondary" className="text-[9px] bg-success/10 text-success border-success/30 px-1.5 py-0">
                              {st.points.toLocaleString("pt-BR")} pts
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] bg-destructive/10 text-destructive border-destructive/30 px-1.5 py-0">
                              Sem dados
                            </Badge>
                          )
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {currentBase !== undefined && (
              <div className="flex items-center gap-1.5 mt-1">
                {currentBase.active ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 text-success" />
                    <span className="text-[11px] text-success">
                      Base ativa — {currentBase.points.toLocaleString("pt-BR")} pontos carregados
                    </span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    <span className="text-[11px] text-warning">
                      Sem dados importados — importe via Meteorologia
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
          <NumField label="Sobredimensionamento padrão" suffix="%" value={premises.sobredimensionamento_padrao} tooltip="Margem extra sobre a potência calculada para compensar perdas reais." onChange={(v) => set("sobredimensionamento_padrao", v)} />
        </div>
      </SectionCard>

      {/* Eficiência */}
      <SectionCard icon={Gauge} title="Perda de eficiência anual" variant="neutral">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="%" value={premises.perda_eficiencia_tradicional} tooltip="Degradação anual dos módulos com inversor string. ~0.5-0.7%/ano." onChange={(v) => set("perda_eficiencia_tradicional", v)} />
          <NumField label="Microinversor" suffix="%" value={premises.perda_eficiencia_microinversor} tooltip="Degradação anual com microinversores." onChange={(v) => set("perda_eficiencia_microinversor", v)} />
          <NumField label="Otimizador" suffix="%" value={premises.perda_eficiencia_otimizador} tooltip="Degradação anual com otimizadores DC." onChange={(v) => set("perda_eficiencia_otimizador", v)} />
        </div>
      </SectionCard>

      {/* Troca inversor - Tempo */}
      <SectionCard icon={RefreshCw} title="Troca de inversor — vida útil" variant="blue">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="Anos" step="1" value={premises.troca_inversor_anos_tradicional} tooltip="Vida útil estimada do inversor string. Dura 10-15 anos." onChange={(v) => set("troca_inversor_anos_tradicional", v)} />
          <NumField label="Microinversor" suffix="Anos" step="1" value={premises.troca_inversor_anos_microinversor} tooltip="Microinversores geralmente têm garantia de 25 anos." onChange={(v) => set("troca_inversor_anos_microinversor", v)} />
          <NumField label="Otimizador" suffix="Anos" step="1" value={premises.troca_inversor_anos_otimizador} tooltip="Otimizadores DC têm garantia de 20-25 anos." onChange={(v) => set("troca_inversor_anos_otimizador", v)} />
        </div>
      </SectionCard>


      {/* Troca inversor - Custo */}
      <SectionCard icon={DollarSign} title="Custo da troca de inversor" variant="neutral">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="%" value={premises.custo_troca_inversor_tradicional} tooltip="Custo como % do valor total do sistema." onChange={(v) => set("custo_troca_inversor_tradicional", v)} />
          <NumField label="Microinversor" suffix="%" value={premises.custo_troca_inversor_microinversor} onChange={(v) => set("custo_troca_inversor_microinversor", v)} />
          <NumField label="Otimizador" suffix="%" value={premises.custo_troca_inversor_otimizador} onChange={(v) => set("custo_troca_inversor_otimizador", v)} />
        </div>
      </SectionCard>

      {/* Geração e ambiental */}
      <SectionCard icon={Sun} title="Geração e impacto ambiental" variant="green">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NumField label="Geração mensal por kWp" suffix="kWh/kWp" value={premises.geracao_mensal_por_kwp} step="1" tooltip="Geração média mensal por kWp instalado." onChange={(v) => set("geracao_mensal_por_kwp", v)} />
          <NumField label="CO₂ evitado por kWh" suffix="kg/kWh" value={premises.kg_co2_por_kwh} step="0.001" tooltip="CO₂ evitado por kWh gerado pelo sistema solar." onChange={(v) => set("kg_co2_por_kwh", v)} />
        </div>
      </SectionCard>

      {/* Outros parâmetros */}
      <SectionCard icon={CheckCircle2} title="Outros parâmetros" variant="green">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Margem para potência ideal" suffix="%" value={premises.margem_potencia_ideal} tooltip="Margem de tolerância para potência 'ideal'." onChange={(v) => set("margem_potencia_ideal", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Considerar custo de disponibilidade?
              <FieldTooltip text="Subtrai o custo mínimo de disponibilidade do cálculo de economia." />
            </Label>
            <Select
              value={premises.considerar_custo_disponibilidade_solar ? "sim" : "nao"}
              onValueChange={(v) => set("considerar_custo_disponibilidade_solar", v === "sim")}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Info className="h-3 w-3" />
              Afeta somente na Regra Anterior
            </p>
          </div>
          <div />
        </div>
      </SectionCard>
    </div>
  );
}
