import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Info, CheckCircle2, AlertTriangle, Sun, Gauge, RefreshCw, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TenantPremises } from "@/hooks/useTenantPremises";

interface Props {
  premises: TenantPremises;
  onChange: (fn: (prev: TenantPremises) => TenantPremises) => void;
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

function NumField({ label, suffix, value, step, tooltip, onChange }: {
  label: string; suffix: string; value: number; step?: string; tooltip?: string;
  onChange: (v: number) => void;
}) {
  const isPercent = suffix === "%";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">
        {label}
        {tooltip && <FieldTooltip text={tooltip} />}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step || "0.01"}
          value={isPercent ? value.toFixed(2) : value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pr-14"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none">{suffix}</span>
      </div>
    </div>
  );
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
    <div className="space-y-6">
      {/* Base de irradiância */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Sun className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Base de irradiância</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              Fonte dos dados
              <FieldTooltip text="Fonte dos dados de irradiação solar. INPE 2017 é mais recente e recomendado. INPE 2009 pode ser usado para comparação histórica." />
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
            {/* Status indicator */}
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
          <NumField label="Sobredimensionamento padrão" suffix="%" value={premises.sobredimensionamento_padrao} tooltip="Margem extra sobre a potência calculada para compensar perdas reais e garantir a geração esperada. Típico: 10-30%." onChange={(v) => set("sobredimensionamento_padrao", v)} />
        </div>
      </div>

      {/* Eficiência */}
      <div className="rounded-xl border-2 border-warning/30 bg-warning/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-warning" />
          <p className="text-xs font-semibold uppercase tracking-wider text-warning">Perda de eficiência anual</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="%" value={premises.perda_eficiencia_tradicional} tooltip="Degradação anual dos módulos com inversor string. Fabricantes garantem ~0.5-0.7%/ano." onChange={(v) => set("perda_eficiencia_tradicional", v)} />
          <NumField label="Microinversor" suffix="%" value={premises.perda_eficiencia_microinversor} tooltip="Degradação anual com microinversores. Pode ser menor pois cada módulo opera no seu ponto ótimo (MPPT individual)." onChange={(v) => set("perda_eficiencia_microinversor", v)} />
          <NumField label="Otimizador" suffix="%" value={premises.perda_eficiencia_otimizador} tooltip="Degradação anual com otimizadores DC. Similar ao microinversor por ter MPPT individual." onChange={(v) => set("perda_eficiencia_otimizador", v)} />
        </div>
      </div>

      {/* Troca inversor - Tempo */}
      <div className="rounded-xl border-2 border-info/30 bg-info/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-info" />
          <p className="text-xs font-semibold uppercase tracking-wider text-info">Troca de inversor — vida útil</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="Anos" step="1" value={premises.troca_inversor_anos_tradicional} tooltip="Vida útil estimada do inversor string antes da troca. Inversores de qualidade duram 10-15 anos." onChange={(v) => set("troca_inversor_anos_tradicional", v)} />
          <NumField label="Microinversor" suffix="Anos" step="1" value={premises.troca_inversor_anos_microinversor} tooltip="Microinversores geralmente têm garantia de 25 anos." onChange={(v) => set("troca_inversor_anos_microinversor", v)} />
          <NumField label="Otimizador" suffix="Anos" step="1" value={premises.troca_inversor_anos_otimizador} tooltip="Otimizadores DC têm garantia de 20-25 anos, mas o inversor central pode precisar de troca em ~10-15 anos." onChange={(v) => set("troca_inversor_anos_otimizador", v)} />
        </div>
      </div>

      {/* Troca inversor - Custo */}
      <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-destructive" />
          <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Custo da troca de inversor</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Tradicional (String)" suffix="%" value={premises.custo_troca_inversor_tradicional} tooltip="Custo estimado como percentual do valor total do sistema. Inclui equipamento + mão de obra." onChange={(v) => set("custo_troca_inversor_tradicional", v)} />
          <NumField label="Microinversor" suffix="%" value={premises.custo_troca_inversor_microinversor} onChange={(v) => set("custo_troca_inversor_microinversor", v)} />
          <NumField label="Otimizador" suffix="%" value={premises.custo_troca_inversor_otimizador} onChange={(v) => set("custo_troca_inversor_otimizador", v)} />
        </div>
      </div>

      {/* Outros parâmetros */}
      <div className="rounded-xl border-2 border-success/30 bg-success/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <p className="text-xs font-semibold uppercase tracking-wider text-success">Outros parâmetros</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NumField label="Margem para potência ideal" suffix="%" value={premises.margem_potencia_ideal} tooltip="Margem de tolerância para considerar a potência do sistema como 'ideal'." onChange={(v) => set("margem_potencia_ideal", v)} />
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">
              Considerar custo de disponibilidade?
              <FieldTooltip text="Se habilitado, subtrai o custo mínimo de disponibilidade do cálculo de economia. Afeta apenas clientes que migraram antes da Lei 14.300." />
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
            <p className="flex items-center gap-1 text-[11px] text-primary">
              <Info className="h-3 w-3" />
              Afeta somente na Regra Anterior
            </p>
          </div>
          <div />
        </div>
      </div>
    </div>
  );
}
