import { useState, useEffect, useMemo, useCallback } from "react";
import { Settings2, Zap, Sun, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import {
  type UCData, type Concessionaria,
  UF_LIST, GRUPO_OPTIONS, SUBGRUPO_BT, SUBGRUPO_MT,
} from "./types";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
import { getRoofLabel, type RoofAreaFactor } from "@/hooks/useTenantPremises";

interface Props {
  ucs: UCData[];
  onUcsChange: (ucs: UCData[]) => void;
  grupo: string;
  onGrupoChange: (g: string) => void;
  potenciaKwp: number;
}

export function StepTechnicalConfig({ ucs, onUcsChange, grupo, onGrupoChange, potenciaKwp }: Props) {
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);

  const uc = ucs[0];
  const { tiposTelhado, roofFactors } = useTiposTelhado();
  const ucEstado = uc?.estado || "";
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(ucEstado);
  const isMT = uc?.tipo_dimensionamento === "MT";
  const subgrupos = isMT ? SUBGRUPO_MT : SUBGRUPO_BT;

  useEffect(() => {
    if (!ucEstado) { setConcessionarias([]); return; }
    setLoadingConc(true);
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b")
      .eq("ativo", true)
      .eq("estado", ucEstado)
      .order("nome")
      .then(({ data }) => {
        setConcessionarias((data || []) as Concessionaria[]);
        setLoadingConc(false);
      });
  }, [ucEstado]);

  // Derived metrics
  const estimatedGeneration = useMemo(() => {
    if (potenciaKwp <= 0) return 0;
    const perf = (uc?.taxa_desempenho || 80) / 100;
    return Math.round(potenciaKwp * 130 * perf);
  }, [potenciaKwp, uc?.taxa_desempenho]);

  const coveragePercent = useMemo(() => {
    if (!uc || uc.consumo_mensal <= 0 || estimatedGeneration <= 0) return 0;
    return Math.min(100, Math.round((estimatedGeneration / uc.consumo_mensal) * 100));
  }, [uc?.consumo_mensal, estimatedGeneration]);

  const requiredModules = useMemo(() => {
    if (potenciaKwp <= 0) return 0;
    return Math.ceil((potenciaKwp * 1000) / 550);
  }, [potenciaKwp]);

  if (!uc) return null;

  const updateUC = (field: keyof UCData, value: any) => {
    const updated = [...ucs];
    if (field === "estado" && value !== updated[0].estado) {
      updated[0] = { ...updated[0], [field]: value, cidade: "", distribuidora: "", distribuidora_id: "" };
    } else {
      updated[0] = { ...updated[0], [field]: value };
    }
    onUcsChange(updated);
  };

  const handleConcChange = (concId: string) => {
    const conc = concessionarias.find(c => c.id === concId);
    if (!conc) return;
    const updated = [...ucs];
    updated[0] = {
      ...updated[0],
      distribuidora: conc.sigla || conc.nome,
      distribuidora_id: conc.id,
      tarifa_distribuidora: conc.tarifa_energia || 0,
    };
    onUcsChange(updated);
  };


  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Configuração Técnica
        </h3>
      </div>

      {/* Derived Metrics Strip */}
      {potenciaKwp > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Geração Estimada</p>
            <p className="text-base font-bold font-mono text-primary">{estimatedGeneration.toLocaleString("pt-BR")} <span className="text-[10px] font-normal">kWh/mês</span></p>
          </div>
          <div className="p-2.5 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Cobertura</p>
            <p className={`text-base font-bold font-mono ${coveragePercent >= 100 ? "text-success" : coveragePercent >= 80 ? "text-primary" : "text-warning"}`}>
              {coveragePercent}%
            </p>
          </div>
          <div className="p-2.5 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Módulos</p>
            <p className="text-base font-bold font-mono">{requiredModules} <span className="text-[10px] font-normal text-muted-foreground">un (550W)</span></p>
          </div>
        </div>
      )}

      {/* Dense Grid */}
      <div className="rounded-md border border-border/50 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Localização e Rede</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Estado</Label>
            <Select value={uc.estado} onValueChange={v => updateUC("estado", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">{cidadesLoading ? "Carregando..." : "Cidade"}</Label>
            {cidades.length > 0 ? (
              <Select value={uc.cidade} onValueChange={v => updateUC("cidade", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Input value={uc.cidade} onChange={e => updateUC("cidade", e.target.value)} className="h-8 text-xs" />
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Distribuidora</Label>
            {loadingConc ? <Skeleton className="h-8 w-full" /> : (
              <Select value={uc.distribuidora_id} onValueChange={handleConcChange}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={concessionarias.length ? "Selecione" : "UF primeiro"} /></SelectTrigger>
                <SelectContent>{concessionarias.map(c => <SelectItem key={c.id} value={c.id}>{c.sigla ? `${c.sigla} - ` : ""}{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Tarifa (R$/kWh)</Label>
            <Input type="number" step={0.0001} value={uc.tarifa_distribuidora || ""} onChange={e => updateUC("tarifa_distribuidora", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Grupo</Label>
            <Select value={grupo} onValueChange={onGrupoChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{GRUPO_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Subgrupo</Label>
            <Select value={uc.subgrupo} onValueChange={v => updateUC("subgrupo", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{subgrupos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Fase</Label>
            <Select value={uc.fase} onValueChange={v => updateUC("fase", v as any)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monofasico">Monofásico</SelectItem>
                <SelectItem value="bifasico">Bifásico</SelectItem>
                <SelectItem value="trifasico">Trifásico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Tensão</Label>
            <Input value={uc.tensao_rede} onChange={e => updateUC("tensao_rede", e.target.value)} placeholder="127/220V" className="h-8 text-xs" />
          </div>
        </div>
      </div>

      {/* Installation */}
      <div className="rounded-md border border-border/50 p-3 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Instalação</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Tipo de Telhado</Label>
            <Select value={uc.tipo_telhado} onValueChange={v => {
              // Find the matching roof factor and auto-fill defaults
              const match = roofFactors.find(rf => getRoofLabel(rf) === v);
              const updates: Partial<UCData> = { tipo_telhado: v };
              if (match) {
                if (match.inclinacao_padrao != null) updates.inclinacao = match.inclinacao_padrao;
                if (match.desvio_azimutal_padrao != null) updates.desvio_azimutal = match.desvio_azimutal_padrao;
              }
              const updated = [...ucs];
              updated[0] = { ...updated[0], ...updates };
              onUcsChange(updated);
            }}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{tiposTelhado.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Inclinação (°)</Label>
            <Input type="number" value={uc.inclinacao || ""} onChange={e => updateUC("inclinacao", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Desvio Azimutal (°)</Label>
            <Input type="number" value={uc.desvio_azimutal || ""} onChange={e => updateUC("desvio_azimutal", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Performance (%)</Label>
            <Input type="number" value={uc.taxa_desempenho || ""} onChange={e => updateUC("taxa_desempenho", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Distância (km)</Label>
            <Input type="number" value={uc.distancia || ""} onChange={e => updateUC("distancia", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">Custo Disponibilidade (kWh)</Label>
            <Input type="number" value={uc.custo_disponibilidade_kwh || ""} onChange={e => updateUC("custo_disponibilidade_kwh", Number(e.target.value))} className="h-8 text-xs font-mono" />
          </div>
        </div>
      </div>
    </div>
  );
}
