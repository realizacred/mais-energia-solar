import { useState, useEffect } from "react";
import { Plus, Trash2, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import {
  type UCData, type Concessionaria, createEmptyUC,
  UF_LIST, TIPO_TELHADO_OPTIONS, GRUPO_OPTIONS, SUBGRUPO_BT, SUBGRUPO_MT, MESES,
} from "./types";

interface Props {
  ucs: UCData[];
  onUcsChange: (ucs: UCData[]) => void;
  grupo: string;
  onGrupoChange: (g: string) => void;
  potenciaKwp: number;
  onPotenciaChange: (p: number) => void;
}

export function StepUCsEnergia({ ucs, onUcsChange, grupo, onGrupoChange, potenciaKwp, onPotenciaChange }: Props) {
  const [activeUC, setActiveUC] = useState("0");
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    consumo: true, tarifas: false, demanda: false, tecnico: false, compensacao: false,
  });

  const currentUC = ucs[Number(activeUC)] || ucs[0];
  const currentEstado = currentUC?.estado;

  // Fetch concessionárias when estado changes
  useEffect(() => {
    if (!currentEstado) { setConcessionarias([]); return; }
    setLoadingConc(true);
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b")
      .eq("ativo", true)
      .eq("estado", currentEstado)
      .order("nome")
      .then(({ data }) => {
        setConcessionarias((data || []) as Concessionaria[]);
        setLoadingConc(false);
      });
  }, [currentEstado]);

  const addUC = () => {
    const newUC = createEmptyUC(ucs.length + 1);
    // Copy estado from first UC if available
    if (ucs.length > 0 && ucs[0].estado) {
      newUC.estado = ucs[0].estado;
      newUC.cidade = ucs[0].cidade;
    }
    onUcsChange([...ucs, newUC]);
    setActiveUC(String(ucs.length));
  };

  const removeUC = (index: number) => {
    if (ucs.length <= 1) return;
    const updated = ucs.filter((_, i) => i !== index).map((uc, i) => ({ ...uc, uc_index: i + 1 }));
    onUcsChange(updated);
    setActiveUC("0");
  };

  const updateUC = (index: number, field: keyof UCData, value: any) => {
    const updated = [...ucs];
    updated[index] = { ...updated[index], [field]: value };
    onUcsChange(updated);
  };

  const updateConsumoMes = (index: number, mes: string, value: number) => {
    const updated = [...ucs];
    updated[index] = {
      ...updated[index],
      consumo_meses: { ...updated[index].consumo_meses, [mes]: value },
    };
    onUcsChange(updated);
  };

  const handleConcChange = (index: number, concId: string) => {
    const conc = concessionarias.find(c => c.id === concId);
    if (!conc) return;
    const updated = [...ucs];
    updated[index] = {
      ...updated[index],
      distribuidora: conc.sigla || conc.nome,
      distribuidora_id: conc.id,
      tarifa_distribuidora: conc.tarifa_energia || 0,
    };
    onUcsChange(updated);
  };

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const ucIdx = Number(activeUC);
  const uc = ucs[ucIdx];
  if (!uc) return null;

  const isMT = uc.tipo_dimensionamento === "MT";
  const subgrupos = isMT ? SUBGRUPO_MT : SUBGRUPO_BT;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Unidades Consumidoras
        </h3>
        <Button variant="outline" size="sm" className="gap-1 h-8 text-xs" onClick={addUC}>
          <Plus className="h-3 w-3" /> Adicionar UC
        </Button>
      </div>

      {/* Global fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Grupo Tarifário</Label>
          <Select value={grupo} onValueChange={onGrupoChange}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {GRUPO_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Potência do Sistema (kWp) *</Label>
          <Input type="number" min={0} step={0.1} value={potenciaKwp || ""} onChange={e => onPotenciaChange(Number(e.target.value))} placeholder="Ex: 6.6" className="h-9" />
        </div>
      </div>

      {/* UC Tabs */}
      <Tabs value={activeUC} onValueChange={setActiveUC}>
        <div className="flex items-center gap-2">
          <TabsList className="h-8">
            {ucs.map((u, i) => (
              <TabsTrigger key={u.id} value={String(i)} className="text-xs px-3 h-7">
                {u.nome || `UC ${i + 1}`}
              </TabsTrigger>
            ))}
          </TabsList>
          {ucs.length > 1 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => removeUC(ucIdx)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>

        {ucs.map((u, i) => (
          <TabsContent key={u.id} value={String(i)} className="mt-3 space-y-3">
            {/* Base fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome da UC</Label>
                <Input value={u.nome} onChange={e => updateUC(i, "nome", e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={u.tipo_dimensionamento} onValueChange={v => updateUC(i, "tipo_dimensionamento", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BT">BT - Baixa Tensão</SelectItem>
                    <SelectItem value="MT">MT - Média Tensão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Estado</Label>
                <Select value={u.estado} onValueChange={v => updateUC(i, "estado", v)}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Distribuidora</Label>
                {loadingConc ? <Skeleton className="h-9 w-full" /> : (
                  <Select value={u.distribuidora_id} onValueChange={v => handleConcChange(i, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={concessionarias.length ? "Selecione" : "Selecione UF primeiro"} /></SelectTrigger>
                    <SelectContent>{concessionarias.map(c => <SelectItem key={c.id} value={c.id}>{c.sigla ? `${c.sigla} - ` : ""}{c.nome}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Subgrupo</Label>
                <Select value={u.subgrupo} onValueChange={v => updateUC(i, "subgrupo", v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{subgrupos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Fase</Label>
                <Select value={u.fase} onValueChange={v => updateUC(i, "fase", v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monofasico">Monofásico</SelectItem>
                    <SelectItem value="bifasico">Bifásico</SelectItem>
                    <SelectItem value="trifasico">Trifásico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tensão da Rede</Label>
                <Input value={u.tensao_rede} onChange={e => updateUC(i, "tensao_rede", e.target.value)} placeholder="127/220V" className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cidade</Label>
                <Input value={u.cidade} onChange={e => updateUC(i, "cidade", e.target.value)} className="h-9" />
              </div>
            </div>

            {/* ── Consumo Section ── */}
            <Collapsible open={expandedSections.consumo} onOpenChange={() => toggleSection("consumo")}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {expandedSections.consumo ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Consumo {isMT ? "(Ponta / Fora Ponta)" : "(BT)"}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-1">
                {!isMT ? (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Consumo Médio Mensal (kWh) *</Label>
                      <Input type="number" min={0} value={u.consumo_mensal || ""} onChange={e => updateUC(i, "consumo_mensal", Number(e.target.value))} placeholder="Ex: 500" className="h-9" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Consumo por mês (opcional — detalhar)</Label>
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {MESES.map(m => (
                          <div key={m} className="space-y-0.5">
                            <Label className="text-[10px] text-muted-foreground uppercase">{m}</Label>
                            <Input type="number" min={0} value={u.consumo_meses[m] || ""} onChange={e => updateConsumoMes(i, m, Number(e.target.value))} className="h-8 text-xs" />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Consumo Ponta (kWh) *</Label>
                      <Input type="number" min={0} value={u.consumo_mensal_p || ""} onChange={e => updateUC(i, "consumo_mensal_p", Number(e.target.value))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Consumo Fora Ponta (kWh) *</Label>
                      <Input type="number" min={0} value={u.consumo_mensal_fp || ""} onChange={e => updateUC(i, "consumo_mensal_fp", Number(e.target.value))} className="h-9" />
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>

            {/* ── Tarifas Section ── */}
            <Collapsible open={expandedSections.tarifas} onOpenChange={() => toggleSection("tarifas")}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {expandedSections.tarifas ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Tarifas
                {u.tarifa_distribuidora > 0 && <Badge variant="outline" className="text-[10px] ml-2">R$ {u.tarifa_distribuidora.toFixed(4)}</Badge>}
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tarifa Distribuidora (R$/kWh)</Label>
                    <Input type="number" step={0.0001} value={u.tarifa_distribuidora || ""} onChange={e => updateUC(i, "tarifa_distribuidora", Number(e.target.value))} className="h-9" />
                  </div>
                  {isMT && (
                    <>
                      <div className="space-y-1.5">
                        <Label className="text-xs">TE Ponta</Label>
                        <Input type="number" step={0.0001} value={u.tarifa_te_p || ""} onChange={e => updateUC(i, "tarifa_te_p", Number(e.target.value))} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">TUSD Ponta</Label>
                        <Input type="number" step={0.0001} value={u.tarifa_tusd_p || ""} onChange={e => updateUC(i, "tarifa_tusd_p", Number(e.target.value))} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">TE Fora Ponta</Label>
                        <Input type="number" step={0.0001} value={u.tarifa_te_fp || ""} onChange={e => updateUC(i, "tarifa_te_fp", Number(e.target.value))} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">TUSD Fora Ponta</Label>
                        <Input type="number" step={0.0001} value={u.tarifa_tusd_fp || ""} onChange={e => updateUC(i, "tarifa_tusd_fp", Number(e.target.value))} className="h-9" />
                      </div>
                    </>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── Demanda (MT only) ── */}
            {isMT && (
              <Collapsible open={expandedSections.demanda} onOpenChange={() => toggleSection("demanda")}>
                <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                  {expandedSections.demanda ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                  Demanda
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Preço Demanda (R$/kW)</Label>
                      <Input type="number" step={0.01} value={u.demanda_preco || ""} onChange={e => updateUC(i, "demanda_preco", Number(e.target.value))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Demanda Contratada (kW)</Label>
                      <Input type="number" value={u.demanda_contratada || ""} onChange={e => updateUC(i, "demanda_contratada", Number(e.target.value))} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Demanda Adicional (kW)</Label>
                      <Input type="number" value={u.demanda_adicional || ""} onChange={e => updateUC(i, "demanda_adicional", Number(e.target.value))} className="h-9" />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ── Técnico Section ── */}
            <Collapsible open={expandedSections.tecnico} onOpenChange={() => toggleSection("tecnico")}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {expandedSections.tecnico ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Dados Técnicos / Telhado
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tipo de Telhado</Label>
                    <Select value={u.tipo_telhado} onValueChange={v => updateUC(i, "tipo_telhado", v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{TIPO_TELHADO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Inclinação (°)</Label>
                    <Input type="number" value={u.inclinacao || ""} onChange={e => updateUC(i, "inclinacao", Number(e.target.value))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Desvio Azimutal (°)</Label>
                    <Input type="number" value={u.desvio_azimutal || ""} onChange={e => updateUC(i, "desvio_azimutal", Number(e.target.value))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Taxa Desempenho (%)</Label>
                    <Input type="number" value={u.taxa_desempenho || ""} onChange={e => updateUC(i, "taxa_desempenho", Number(e.target.value))} className="h-9" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Distância (km)</Label>
                    <Input type="number" value={u.distancia || ""} onChange={e => updateUC(i, "distancia", Number(e.target.value))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Custo Disponibilidade (kWh)</Label>
                    <Input type="number" value={u.custo_disponibilidade_kwh || ""} onChange={e => updateUC(i, "custo_disponibilidade_kwh", Number(e.target.value))} className="h-9" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* ── Compensação Section ── */}
            <Collapsible open={expandedSections.compensacao} onOpenChange={() => toggleSection("compensacao")}>
              <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
                {expandedSections.compensacao ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                Compensação e Rateio
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-1">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Regra Compensação</Label>
                    <Select value={String(u.regra_compensacao)} onValueChange={v => updateUC(i, "regra_compensacao", Number(v))}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">GD-I</SelectItem>
                        <SelectItem value="1">GD-II</SelectItem>
                        <SelectItem value="2">GD-III</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Rateio Créditos (%)</Label>
                    <Input type="number" value={u.rateio_creditos || ""} onChange={e => updateUC(i, "rateio_creditos", Number(e.target.value))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Imposto Energia (%)</Label>
                    <Input type="number" value={u.imposto_energia || ""} onChange={e => updateUC(i, "imposto_energia", Number(e.target.value))} className="h-9" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Fator Simultaneidade (%)</Label>
                    <Input type="number" value={u.fator_simultaneidade || ""} onChange={e => updateUC(i, "fator_simultaneidade", Number(e.target.value))} className="h-9" />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
