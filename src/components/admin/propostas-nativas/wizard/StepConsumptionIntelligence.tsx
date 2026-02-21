import { useState, useMemo, useCallback, useEffect } from "react";
import { Zap, Settings2, Pencil, Plus, BarChart3, AlertCircle, Package, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type UCData, type PreDimensionamentoData, type TopologiaConfig, MESES,
  SOMBREAMENTO_OPTIONS, DESVIO_AZIMUTAL_OPTIONS, INCLINACAO_OPTIONS,
  TOPOLOGIA_LABELS, DEFAULT_TOPOLOGIA_CONFIGS,
  createEmptyUC,
} from "./types";
import { UCCard } from "./uc/UCCard";
import { UCConfigModal, RateioCreditsModal, MesAMesDialog } from "./uc/UCModals";
import { useTiposTelhado } from "@/hooks/useTiposTelhado";
import { getRoofLabel, type RoofAreaFactor } from "@/hooks/useTenantPremises";

interface Props {
  ucs: UCData[];
  onUcsChange: (ucs: UCData[]) => void;
  potenciaKwp: number;
  onPotenciaChange: (p: number) => void;
  preDimensionamento: PreDimensionamentoData;
  onPreDimensionamentoChange: (pd: PreDimensionamentoData) => void;
}

type ActiveTab = "ucs" | "pre";
type PreSubTab = "premissas" | "equipamentos";

export function StepConsumptionIntelligence({
  ucs, onUcsChange, potenciaKwp, onPotenciaChange,
  preDimensionamento: pd, onPreDimensionamentoChange: setPd,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ucs");
  const [preSubTab, setPreSubTab] = useState<PreSubTab>("premissas");
  const [configModal, setConfigModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [rateioOpen, setRateioOpen] = useState(false);
  const [mesAMes, setMesAMes] = useState<{ open: boolean; ucIndex: number; field: "consumo" | "hp" | "hfp" }>({ open: false, ucIndex: 0, field: "consumo" });
  const [preDimModal, setPreDimModal] = useState(false);
  const { roofFactors } = useTiposTelhado();

  // Sync inclinação/desvio azimutal from first UC's tipo_telhado into preDimensionamento
  const uc1TipoTelhado = ucs[0]?.tipo_telhado;
  useEffect(() => {
    if (!uc1TipoTelhado || roofFactors.length === 0) return;
    const match = roofFactors.find(rf => getRoofLabel(rf) === uc1TipoTelhado);
    if (match) {
      const updates: Partial<PreDimensionamentoData> = {};
      if (match.inclinacao_padrao != null && pd.inclinacao !== match.inclinacao_padrao) {
        updates.inclinacao = match.inclinacao_padrao;
      }
      if (match.desvio_azimutal_padrao != null && pd.desvio_azimutal !== match.desvio_azimutal_padrao) {
        updates.desvio_azimutal = match.desvio_azimutal_padrao;
      }
      if (Object.keys(updates).length > 0) {
        setPd({ ...pd, ...updates });
      }
    }
  }, [uc1TipoTelhado, roofFactors]);

  // ─── Derived metrics
  const consumoTotal = useMemo(() => {
    return ucs.reduce((s, u) => {
      if (u.grupo_tarifario === "A") return s + (u.consumo_mensal_p || 0) + (u.consumo_mensal_fp || 0);
      return s + (u.consumo_mensal || 0);
    }, 0);
  }, [ucs]);

  // Per-topology potência ideal
  const getTopoConfig = (topo: string): TopologiaConfig => {
    return pd.topologia_configs?.[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo] || DEFAULT_TOPOLOGIA_CONFIGS.tradicional;
  };

  const potenciaIdealByTopo = useMemo(() => {
    const result: Record<string, number> = {};
    for (const topo of ["tradicional", "microinversor", "otimizador"]) {
      const cfg = getTopoConfig(topo);
      result[topo] = cfg.fator_geracao > 0 ? Math.round((consumoTotal / cfg.fator_geracao) * 100) / 100 : 0;
    }
    return result;
  }, [consumoTotal, pd.topologia_configs]);

  // Legacy compat: use tradicional as primary
  const primaryFatorGeracao = getTopoConfig("tradicional").fator_geracao;
  const potenciaIdeal = potenciaIdealByTopo.tradicional;

  // Monthly generation estimate
  const geracaoMensal = useMemo(() => {
    return Math.round(potenciaKwp * primaryFatorGeracao * 100) / 100;
  }, [potenciaKwp, primaryFatorGeracao]);

  const applyPotIdeal = useCallback(() => {
    if (potenciaIdeal > 0) onPotenciaChange(potenciaIdeal);
  }, [potenciaIdeal, onPotenciaChange]);

  // ─── UC handlers
  const updateUC = (index: number, uc: UCData) => {
    const updated = [...ucs];
    updated[index] = uc;
    onUcsChange(updated);
  };

  const removeUC = (index: number) => {
    if (ucs.length <= 1) return;
    onUcsChange(ucs.filter((_, i) => i !== index));
  };

  const addUC = () => {
    const newUC = createEmptyUC(ucs.length + 1);
    newUC.regra = ucs[0].regra;
    newUC.grupo_tarifario = ucs[0].grupo_tarifario;
    newUC.tipo_dimensionamento = ucs[0].tipo_dimensionamento;
    newUC.is_geradora = false;
    onUcsChange([...ucs, newUC]);
  };

  const handleAutoRateio = () => {
    const equal = Math.round(100 / ucs.length);
    const updated = ucs.map((u, i) => ({
      ...u,
      rateio_creditos: i === 0 ? 100 - equal * (ucs.length - 1) : equal,
    }));
    onUcsChange(updated);
  };

  // ─── MesAMes handlers
  const mesAMesValues = useMemo(() => {
    const uc = ucs[mesAMes.ucIndex];
    if (!uc) return {};
    if (mesAMes.field === "hp") return uc.consumo_meses_p || {};
    if (mesAMes.field === "hfp") return uc.consumo_meses_fp || {};
    return uc.consumo_meses || {};
  }, [ucs, mesAMes]);

  const handleMesAMesSave = (values: Record<string, number>) => {
    const uc = { ...ucs[mesAMes.ucIndex] };
    if (mesAMes.field === "hp") {
      uc.consumo_meses_p = values;
      const vals = Object.values(values).filter(v => v > 0);
      uc.consumo_mensal_p = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : uc.consumo_mensal_p;
    } else if (mesAMes.field === "hfp") {
      uc.consumo_meses_fp = values;
      const vals = Object.values(values).filter(v => v > 0);
      uc.consumo_mensal_fp = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : uc.consumo_mensal_fp;
    } else {
      uc.consumo_meses = values;
      const vals = Object.values(values).filter(v => v > 0);
      uc.consumo_mensal = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : uc.consumo_mensal;
    }
    updateUC(mesAMes.ucIndex, uc);
  };

  const mesAMesTitle = mesAMes.field === "hp" ? "Consumo Ponta (HP)" : mesAMes.field === "hfp" ? "Consumo Fora Ponta (HFP)" : "Consumo";

  // ─── Pre-dimensionamento helpers
  const pdUpdate = <K extends keyof PreDimensionamentoData>(field: K, value: PreDimensionamentoData[K]) => {
    setPd({ ...pd, [field]: value });
  };

  const updateTopoConfig = (topo: string, field: keyof TopologiaConfig, value: any) => {
    const configs = { ...pd.topologia_configs };
    configs[topo] = { ...(configs[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo]), [field]: value };
    const updated: PreDimensionamentoData = { ...pd, topologia_configs: configs };
    // Sync legacy fields from tradicional
    if (topo === "tradicional") {
      updated.desempenho = configs.tradicional.desempenho;
      updated.fator_geracao = configs.tradicional.fator_geracao;
      updated.fator_geracao_meses = configs.tradicional.fator_geracao_meses;
    }
    setPd(updated);
  };

  const toggleTopologia = (t: string) => {
    const current = pd.topologias;
    if (current.includes(t)) {
      if (current.length > 1) pdUpdate("topologias", current.filter(x => x !== t));
    } else {
      pdUpdate("topologias", [...current, t]);
    }
  };

  const toggleTipoKit = (tk: string) => {
    const current = pd.tipos_kit || [];
    if (current.includes(tk)) {
      if (current.length > 1) setPd({ ...pd, tipos_kit: current.filter(x => x !== tk) });
    } else {
      setPd({ ...pd, tipos_kit: [...current, tk] });
    }
  };

  const showDoD = pd.sistema === "hibrido" || pd.sistema === "off_grid";
  const allTopos = ["tradicional", "microinversor", "otimizador"];

  // ─── Pre-dimensionamento content
  const preDimContent = (
    <div className="space-y-5">
      {/* Sistema / Tipo Kit / Topologia */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-[11px] flex items-center gap-1">Sistema <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Tipo do sistema solar</p></TooltipContent></Tooltip></TooltipProvider></Label>
          <RadioGroup value={pd.sistema} onValueChange={v => pdUpdate("sistema", v as any)} className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><RadioGroupItem value="on_grid" id="sys-on" /><Label htmlFor="sys-on" className="text-xs cursor-pointer">On grid</Label></div>
            <div className="flex items-center gap-1.5"><RadioGroupItem value="hibrido" id="sys-hib" /><Label htmlFor="sys-hib" className="text-xs cursor-pointer">Híbrido</Label></div>
            <div className="flex items-center gap-1.5"><RadioGroupItem value="off_grid" id="sys-off" /><Label htmlFor="sys-off" className="text-xs cursor-pointer">Off grid</Label></div>
          </RadioGroup>
        </div>

        <div className="flex items-center gap-4">
          <Label className="text-[11px]">Tipo de kit <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Checkbox id="kit-custom" checked={(pd.tipos_kit || []).includes("customizado")} onCheckedChange={() => toggleTipoKit("customizado")} />
              <Label htmlFor="kit-custom" className="text-xs cursor-pointer">Customizado</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="kit-fechado" checked={(pd.tipos_kit || []).includes("fechado")} onCheckedChange={() => toggleTipoKit("fechado")} />
              <Label htmlFor="kit-fechado" className="text-xs cursor-pointer">Fechado</Label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Label className="text-[11px]">Topologia <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-3">
            {allTopos.map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <Checkbox id={`topo-${t}`} checked={pd.topologias.includes(t)} onCheckedChange={() => toggleTopologia(t)} />
                <Label htmlFor={`topo-${t}`} className="text-xs cursor-pointer">{TOPOLOGIA_LABELS[t]}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tabs: Premissas | Equipamentos */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          <button
            onClick={() => setPreSubTab("premissas")}
            className={`text-sm font-semibold pb-2 px-1 border-b-2 transition-colors ${preSubTab === "premissas" ? "border-secondary text-secondary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Premissas
          </button>
          <button
            onClick={() => setPreSubTab("equipamentos")}
            className={`text-sm pb-2 px-1 border-b-2 transition-colors ${preSubTab === "equipamentos" ? "border-secondary text-secondary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            Equipamentos
          </button>
        </div>
      </div>

      {preSubTab === "premissas" ? (
        <PremissasContent
          pd={pd}
          pdUpdate={pdUpdate}
          updateTopoConfig={updateTopoConfig}
          getTopoConfig={getTopoConfig}
          potenciaIdealByTopo={potenciaIdealByTopo}
          consumoTotal={consumoTotal}
          showDoD={showDoD}
        />
      ) : (
        <EquipamentosPreFilter pd={pd} consumoTotal={consumoTotal} potenciaIdealByTopo={potenciaIdealByTopo} />
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ─── Header metrics bar */}
      <div className="flex items-center justify-end gap-6 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Consumo Mensal Total</span>
          <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh</span>
        </div>
        <button onClick={() => setPreDimModal(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground group">
          <Pencil className="h-3.5 w-3.5" />
          <span>Potência Ideal</span>
          <span className="font-bold text-foreground">{potenciaIdeal.toFixed(2)} kWp</span>
          <Pencil className="h-2.5 w-2.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button onClick={() => setPreDimModal(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground group">
          <Zap className="h-3.5 w-3.5" />
          <span>Fator de Geração</span>
          <span className="font-bold text-foreground">{primaryFatorGeracao.toFixed(2)} kWh/kWp</span>
          <Pencil className="h-2.5 w-2.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* ─── Tabs + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "ucs" ? "outline" : "ghost"}
            size="sm"
            className={`gap-1.5 ${activeTab === "ucs" ? "border-2 border-secondary text-secondary font-semibold" : ""}`}
            onClick={() => setActiveTab("ucs")}
          >
            <Zap className="h-3.5 w-3.5" /> Unidades Consumidoras
          </Button>
          <Button
            variant={activeTab === "pre" ? "outline" : "ghost"}
            size="sm"
            className={`gap-1.5 ${activeTab === "pre" ? "border-2 border-secondary text-secondary font-semibold" : ""}`}
            onClick={() => setActiveTab("pre")}
          >
            <Settings2 className="h-3.5 w-3.5" /> Pré-Dimensionamento
          </Button>
        </div>

        {ucs.length > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-[11px] bg-primary hover:bg-primary/90" onClick={handleAutoRateio}>
              Rateio automático
            </Button>
            <button onClick={() => setRateioOpen(true)} className="text-[11px] text-secondary hover:underline flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Gerenciar rateio de créditos
            </button>
          </div>
        )}
      </div>

      {/* ─── Tab content */}
      {activeTab === "ucs" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 pb-2">
          {ucs.map((uc, i) => (
            <UCCard
              key={uc.id}
              uc={uc}
              index={i}
              onChange={u => updateUC(i, u)}
              onRemove={() => removeUC(i)}
              onOpenConfig={() => setConfigModal({ open: true, index: i })}
              onOpenMesAMes={field => setMesAMes({ open: true, ucIndex: i, field })}
              isFirst={i === 0}
              totalUcs={ucs.length}
            />
          ))}

          <button
            onClick={addUC}
            className="rounded-lg border-2 border-dashed border-primary/30 bg-primary/5 min-h-[120px] flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-primary/10 transition-colors"
          >
            <Plus className="h-4 w-4 text-primary" />
            <span className="text-xs text-primary font-medium">+ Nova Unidade</span>
          </button>
        </div>
      ) : (
        preDimContent
      )}

      {/* ─── Modals */}
      <UCConfigModal
        open={configModal.open}
        onOpenChange={o => setConfigModal({ ...configModal, open: o })}
        uc={ucs[configModal.index] || null}
        index={configModal.index}
        onSave={uc => updateUC(configModal.index, uc)}
      />

      <RateioCreditsModal
        open={rateioOpen}
        onOpenChange={setRateioOpen}
        ucs={ucs}
        geracaoMensal={geracaoMensal}
        onSave={onUcsChange}
      />

      <MesAMesDialog
        open={mesAMes.open}
        onOpenChange={o => setMesAMes({ ...mesAMes, open: o })}
        title={mesAMesTitle}
        values={mesAMesValues}
        onSave={handleMesAMesSave}
      />

      {/* Pre-dimensionamento modal (from header click) */}
      <Dialog open={preDimModal} onOpenChange={setPreDimModal}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-dimensionamento</DialogTitle>
          </DialogHeader>
          {preDimContent}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <Button variant="ghost" onClick={() => setPreDimModal(false)}>Voltar</Button>
            <Button onClick={() => { applyPotIdeal(); setPreDimModal(false); }} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Premissas Content (3-column layout by topology) ─── */

function PremissasContent({
  pd, pdUpdate, updateTopoConfig, getTopoConfig, potenciaIdealByTopo, consumoTotal, showDoD,
}: {
  pd: PreDimensionamentoData;
  pdUpdate: <K extends keyof PreDimensionamentoData>(field: K, value: PreDimensionamentoData[K]) => void;
  updateTopoConfig: (topo: string, field: keyof TopologiaConfig, value: any) => void;
  getTopoConfig: (topo: string) => TopologiaConfig;
  potenciaIdealByTopo: Record<string, number>;
  consumoTotal: number;
  showDoD: boolean;
}) {
  const allTopos = ["tradicional", "microinversor", "otimizador"];

  return (
    <div className="space-y-4">
      {/* Sombreamento / Desvio / Inclinação / DoD — shared across topologies */}
      <div className={`grid gap-3 ${showDoD ? "grid-cols-4" : "grid-cols-3"}`}>
        <div className="space-y-1.5">
          <Label className="text-[11px] flex items-center gap-1">
            Sombreamento <span className="text-destructive">*</span>
            <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Nível de sombreamento no local</p></TooltipContent></Tooltip></TooltipProvider>
          </Label>
          <Select value={pd.sombreamento} onValueChange={v => pdUpdate("sombreamento", v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SOMBREAMENTO_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Desvio Azimutal <span className="text-destructive">*</span></Label>
          <Select value={String(pd.desvio_azimutal)} onValueChange={v => pdUpdate("desvio_azimutal", Number(v))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{DESVIO_AZIMUTAL_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d}°</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Inclinação <span className="text-destructive">*</span></Label>
          <Select value={String(pd.inclinacao)} onValueChange={v => pdUpdate("inclinacao", Number(v))}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{INCLINACAO_OPTIONS.map(i => <SelectItem key={i} value={String(i)}>{i}°</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {showDoD && (
          <div className="space-y-1.5">
            <Label className="text-[11px] flex items-center gap-1">
              DoD <span className="text-destructive">*</span>
              <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Depth of Discharge — profundidade de descarga da bateria</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <div className="relative">
              <Input type="number" step="0.01" value={pd.dod || ""} onChange={e => pdUpdate("dod", Number(e.target.value))} className="h-9 text-xs pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        )}
      </div>

      {/* ─── 3-column topology grid ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {allTopos.map(topo => {
          const cfg = getTopoConfig(topo);
          const potIdeal = potenciaIdealByTopo[topo] || 0;
          const isActive = pd.topologias.includes(topo);

          return (
            <div key={topo} className={`rounded-lg border border-border bg-card p-3 space-y-3 ${!isActive ? "opacity-40 pointer-events-none" : ""}`}>
              {/* Topology header + badge */}
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-bold">{TOPOLOGIA_LABELS[topo]}</p>
                <Badge variant="outline" className="text-[10px] font-mono border-secondary text-secondary whitespace-nowrap">
                  Pot. ideal: {potIdeal.toFixed(2)} kWp
                </Badge>
              </div>

              {/* Desempenho */}
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1">
                  Desempenho <span className="text-destructive">*</span>
                  <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Performance Ratio do sistema</p></TooltipContent></Tooltip></TooltipProvider>
                </Label>
                <div className="relative">
                  <Input
                    type="number" step="0.01"
                    value={cfg.desempenho ?? ""}
                    onChange={e => updateTopoConfig(topo, "desempenho", Number(e.target.value))}
                    className="h-9 text-xs pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
              </div>

              {/* Fator de Geração */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-[11px]">Fator de Geração <span className="text-destructive">*</span></Label>
                  <button className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">
                    mês a mês <Pencil className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="relative">
                  <Input
                    type="number" step="0.01"
                    value={cfg.fator_geracao ?? ""}
                    onChange={e => updateTopoConfig(topo, "fator_geracao", Number(e.target.value))}
                    className="h-9 text-xs pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh/kWp</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Sistema Solar — shared */}
      <p className="text-sm font-bold pt-1">Sistema Solar</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-[11px]">Sobredimensionamento</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={pd.sobredimensionamento ?? ""} onChange={e => pdUpdate("sobredimensionamento", Number(e.target.value))} className="h-9 text-xs pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-[11px]">Margem para Pot. Ideal</Label>
          <div className="relative">
            <Input type="number" step="0.01" value={pd.margem_pot_ideal ?? ""} onChange={e => pdUpdate("margem_pot_ideal", Number(e.target.value))} className="h-9 text-xs pr-8" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-1">
        <Label className="text-xs">Considerar kits que necessitam de transformador</Label>
        <Switch checked={pd.considerar_transformador} onCheckedChange={v => pdUpdate("considerar_transformador", v)} />
      </div>
    </div>
  );
}

/* ─── Equipamentos Pre-Filter Skeleton ─── */

function EquipamentosPreFilter({ pd, consumoTotal, potenciaIdealByTopo }: {
  pd: PreDimensionamentoData;
  consumoTotal: number;
  potenciaIdealByTopo: Record<string, number>;
}) {
  const activeTopos = pd.topologias;
  const primaryPotIdeal = potenciaIdealByTopo[activeTopos[0] || "tradicional"] || 0;
  const potMin = Math.round(primaryPotIdeal * (1 - (pd.margem_pot_ideal || 0) / 100) * 100) / 100;
  const potMax = Math.round(primaryPotIdeal * (1 + (pd.sobredimensionamento || 0) / 100) * 100) / 100;

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-secondary" />
          <p className="text-sm font-semibold">Pré-filtro de Equipamentos</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Com base no consumo de <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh/mês</span> e
          topologias selecionadas ({activeTopos.map(t => TOPOLOGIA_LABELS[t]).join(", ")}),
          o sistema filtrará equipamentos compatíveis na faixa de <span className="font-bold text-foreground">{potMin.toFixed(2)}</span> a <span className="font-bold text-foreground">{potMax.toFixed(2)} kWp</span>.
        </p>
      </div>

      {/* Criteria grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border p-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Consumo Rede</p>
          <p className="text-lg font-bold">{consumoTotal.toLocaleString("pt-BR")} <span className="text-xs font-normal text-muted-foreground">kWh/mês</span></p>
        </div>
        <div className="rounded-lg border border-border p-3 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Faixa Potência</p>
          <p className="text-lg font-bold">{potMin.toFixed(1)} – {potMax.toFixed(1)} <span className="text-xs font-normal text-muted-foreground">kWp</span></p>
        </div>
      </div>

      {/* Per-topology filter preview */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Filtros por Topologia</p>
        {activeTopos.map(topo => {
          const cfg = pd.topologia_configs?.[topo] || DEFAULT_TOPOLOGIA_CONFIGS[topo];
          const potIdeal = potenciaIdealByTopo[topo] || 0;
          return (
            <div key={topo} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card">
              <div className="flex items-center gap-3">
                <Badge variant="outline" className="text-[10px]">{TOPOLOGIA_LABELS[topo]}</Badge>
                <span className="text-xs text-muted-foreground">Pot. ideal: <span className="font-mono font-bold text-foreground">{potIdeal.toFixed(2)} kWp</span></span>
                <span className="text-xs text-muted-foreground">Desempenho: <span className="font-mono font-bold text-foreground">{cfg.desempenho}%</span></span>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                {topo === "tradicional" ? "String Inverter" : topo === "microinversor" ? "Micro Inverter" : "Optimizer"}
              </Badge>
            </div>
          );
        })}
      </div>

      {/* Integration placeholder */}
      <div className="rounded-lg border-2 border-dashed border-primary/20 bg-primary/5 p-6 text-center space-y-2">
        <Package className="h-8 w-8 mx-auto text-primary/40" />
        <p className="text-sm font-medium text-primary/60">Integração BelEnergia</p>
        <p className="text-xs text-muted-foreground">
          Quando conectado, o sistema consultará automaticamente a API e pré-selecionará
          os melhores kits compatíveis com os critérios acima.
        </p>
        <Badge variant="outline" className="text-[10px]">Em breve</Badge>
      </div>
    </div>
  );
}
