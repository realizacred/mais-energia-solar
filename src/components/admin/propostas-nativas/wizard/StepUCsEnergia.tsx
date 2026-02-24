import { useState, useEffect, useMemo } from "react";
import { Plus, Settings, Zap, Edit2, MoreVertical, Info, Trash2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import {
  type UCData, type Concessionaria, type RegraCompensacao, type GrupoTarifario,
  createEmptyUC, SUBGRUPO_BT, SUBGRUPO_MT, MESES, FASE_TENSAO_OPTIONS,
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
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loadingConc, setLoadingConc] = useState(false);
  const [configModalUC, setConfigModalUC] = useState<number | null>(null);
  const [rateioModalOpen, setRateioModalOpen] = useState(false);
  const [rateioManual, setRateioManual] = useState(false);
  const [mesAMesUC, setMesAMesUC] = useState<{ ucIndex: number; tipo: "consumo" | "hp" | "hfp" } | null>(null);
  const [activeTab, setActiveTab] = useState<"ucs" | "predim">("ucs");

  const firstUCEstado = ucs[0]?.estado;

  useEffect(() => {
    if (!firstUCEstado) { setConcessionarias([]); return; }
    setLoadingConc(true);
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b")
      .eq("ativo", true)
      .eq("estado", firstUCEstado)
      .order("nome")
      .then(({ data }) => {
        setConcessionarias((data || []) as Concessionaria[]);
        setLoadingConc(false);
      });
  }, [firstUCEstado]);

  // ── Computed metrics ──
  const consumoTotal = useMemo(() => {
    return ucs.reduce((sum, uc) => {
      if (uc.grupo_tarifario === "A") {
        return sum + (uc.consumo_mensal_p || 0) + (uc.consumo_mensal_fp || 0);
      }
      return sum + (uc.consumo_mensal || 0);
    }, 0);
  }, [ucs]);

  // ── Handlers ──
  const addUC = () => {
    const newUC = createEmptyUC(ucs.length + 1);
    newUC.is_geradora = false;
    newUC.nome = `Unidade ${ucs.length + 1}`;
    if (ucs.length > 0) {
      newUC.estado = ucs[0].estado;
      newUC.regra = ucs[0].regra;
      newUC.grupo_tarifario = ucs[0].grupo_tarifario;
    }
    onUcsChange([...ucs, newUC]);
  };

  const removeUC = (index: number) => {
    if (ucs.length <= 1) return;
    const updated = ucs.filter((_, i) => i !== index).map((uc, i) => ({
      ...uc, uc_index: i + 1,
      is_geradora: i === 0,
      nome: i === 0 ? "Unidade (Geradora)" : uc.nome,
    }));
    onUcsChange(updated);
  };

  const updateUC = (index: number, field: keyof UCData, value: any) => {
    const updated = [...ucs];
    updated[index] = { ...updated[index], [field]: value };
    // Sync tipo_dimensionamento with grupo_tarifario
    if (field === "grupo_tarifario") {
      updated[index].tipo_dimensionamento = value === "A" ? "MT" : "BT";
      if (value === "B") {
        updated[index].subgrupo = "B1";
      } else {
        updated[index].subgrupo = "A4";
      }
    }
    onUcsChange(updated);
  };

  const updateConsumoMes = (ucIndex: number, tipo: "consumo" | "hp" | "hfp", mes: string, value: number) => {
    const updated = [...ucs];
    if (tipo === "consumo") {
      updated[ucIndex] = { ...updated[ucIndex], consumo_meses: { ...updated[ucIndex].consumo_meses, [mes]: value } };
    } else if (tipo === "hp") {
      updated[ucIndex] = { ...updated[ucIndex], consumo_meses_p: { ...updated[ucIndex].consumo_meses_p, [mes]: value } };
    } else {
      updated[ucIndex] = { ...updated[ucIndex], consumo_meses_fp: { ...updated[ucIndex].consumo_meses_fp, [mes]: value } };
    }
    onUcsChange(updated);
  };

  const totalRateio = useMemo(() => ucs.reduce((s, uc) => s + (uc.rateio_creditos || 0), 0), [ucs]);

  return (
    <div className="space-y-4">
      {/* ── Header Metrics Bar ── */}
      <div className="flex items-center justify-end gap-6 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">Consumo Mensal Total</span>
          <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-primary" />
          <span className="font-medium text-foreground">Potência Ideal</span>
          <span className="font-mono">T: {potenciaKwp?.toFixed(2) || "0,00"}</span>
          <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {}}>
            <Edit2 className="h-3 w-3 text-primary" />
          </Button>
        </div>
      </div>

      {/* ── Sub-tabs ── */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "ucs" ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => setActiveTab("ucs")}
        >
          <Zap className="h-3.5 w-3.5" /> Unidades Consumidoras
        </Button>
        <Button
          variant={activeTab === "predim" ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-9"
          onClick={() => setActiveTab("predim")}
        >
          <Settings className="h-3.5 w-3.5" /> Pré-Dimensionamento
        </Button>
      </div>

      {activeTab === "ucs" && (
        <div className="space-y-3">
          <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
            {/* ── UC Cards ── */}
            {ucs.map((uc, i) => (
              <div key={uc.id} className="shrink-0">
                <UCCard
                  uc={uc}
                  index={i}
                  concessionarias={concessionarias}
                  loadingConc={loadingConc}
                  onUpdate={(field, value) => updateUC(i, field, value)}
                  onRemove={() => removeUC(i)}
                  onOpenConfig={() => setConfigModalUC(i)}
                  onOpenMesAMes={(tipo) => setMesAMesUC({ ucIndex: i, tipo })}
                  canRemove={ucs.length > 1}
                  totalUCs={ucs.length}
                  onOpenRateio={() => setRateioModalOpen(true)}
                />
              </div>
            ))}

            {/* ── Add UC Area ── */}
            <button
              onClick={addUC}
              className="shrink-0 w-[220px] min-h-[400px] flex flex-col items-center justify-center gap-2 border-2 border-dashed border-primary/30 rounded-xl text-primary/60 hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer"
            >
              <Plus className="h-6 w-6" />
              <span className="text-sm font-medium">+ Nova Unidade</span>
            </button>
          </div>

          {/* ── Configurações adicionais ── */}
          <button
            onClick={() => setConfigModalUC(0)}
            className="flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <Settings className="h-3.5 w-3.5" />
            Configurações adicionais
          </button>
        </div>
      )}

      {activeTab === "predim" && (
        <div className="p-6 text-center text-muted-foreground text-sm">
          Pré-Dimensionamento será configurado nas etapas seguintes do wizard.
        </div>
      )}

      {/* ── Config Modal ── */}
      {configModalUC !== null && (
        <UCConfigModal
          uc={ucs[configModalUC]}
          onUpdate={(field, value) => updateUC(configModalUC, field, value)}
          onClose={() => setConfigModalUC(null)}
        />
      )}

      {/* ── Rateio Modal ── */}
      <RateioModal
        open={rateioModalOpen}
        onOpenChange={setRateioModalOpen}
        ucs={ucs}
        rateioManual={rateioManual}
        onRateioManualChange={setRateioManual}
        onUpdateRateio={(i, val) => updateUC(i, "rateio_creditos", val)}
        totalRateio={totalRateio}
      />

      {/* ── Mês a Mês Modal ── */}
      {mesAMesUC && (
        <MesAMesModal
          uc={ucs[mesAMesUC.ucIndex]}
          tipo={mesAMesUC.tipo}
          onUpdate={(mes, val) => updateConsumoMes(mesAMesUC.ucIndex, mesAMesUC.tipo, mes, val)}
          onClose={() => setMesAMesUC(null)}
        />
      )}
    </div>
  );
}

// ─── UC Card ───────────────────────────────────────────────
interface UCCardProps {
  uc: UCData;
  index: number;
  concessionarias: Concessionaria[];
  loadingConc: boolean;
  onUpdate: (field: keyof UCData, value: any) => void;
  onRemove: () => void;
  onOpenConfig: () => void;
  onOpenMesAMes: (tipo: "consumo" | "hp" | "hfp") => void;
  canRemove: boolean;
  totalUCs: number;
  onOpenRateio: () => void;
}

function UCCard({ uc, index, concessionarias, loadingConc, onUpdate, onRemove, onOpenConfig, onOpenMesAMes, canRemove, totalUCs, onOpenRateio }: UCCardProps) {
  const isGrupoA = uc.grupo_tarifario === "A";
  const isGD3 = uc.regra === "GD3";
  const subgrupos = isGrupoA ? SUBGRUPO_MT : SUBGRUPO_BT;
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(uc.nome);
  return (
    <div className="border rounded-xl bg-card p-4 min-w-[320px] w-full space-y-4 relative">
      {/* Header */}
      <div className="flex items-center justify-between">
        {editingName ? (
          <Input
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onBlur={() => {
              if (tempName.trim()) onUpdate("nome", tempName.trim());
              setEditingName(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (tempName.trim()) onUpdate("nome", tempName.trim());
                setEditingName(false);
              }
              if (e.key === "Escape") { setTempName(uc.nome); setEditingName(false); }
            }}
            className="h-7 text-sm font-bold w-[200px] px-2"
            autoFocus
          />
        ) : (
          <h4 className="text-sm font-bold text-foreground">
            {index + 1}. {uc.nome}
          </h4>
        )}
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary">
                  <Info className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Informações da UC</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { setTempName(uc.nome); setEditingName(true); }}>
                <Pencil className="h-3.5 w-3.5 mr-2" /> Editar nome
              </DropdownMenuItem>
              {canRemove && (
                <DropdownMenuItem onClick={onRemove} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" /> Remover UC
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="flex gap-4">
        {/* Left column */}
        <div className="space-y-3 flex-1">
          {/* Regra */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Regra *</Label>
            <RadioGroup
              value={uc.regra}
              onValueChange={(v) => onUpdate("regra", v as RegraCompensacao)}
              className="flex gap-3"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="GD2" id={`regra-gd2-${uc.id}`} />
                <Label htmlFor={`regra-gd2-${uc.id}`} className="text-xs cursor-pointer">GD II</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="GD3" id={`regra-gd3-${uc.id}`} />
                <Label htmlFor={`regra-gd3-${uc.id}`} className="text-xs cursor-pointer">GD III</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Grupo Tarifário */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Grupo Tarifário *</Label>
            <RadioGroup
              value={uc.grupo_tarifario}
              onValueChange={(v) => onUpdate("grupo_tarifario", v as GrupoTarifario)}
              className="flex gap-3"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="A" id={`grupo-a-${uc.id}`} />
                <Label htmlFor={`grupo-a-${uc.id}`} className="text-xs cursor-pointer">A</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="B" id={`grupo-b-${uc.id}`} />
                <Label htmlFor={`grupo-b-${uc.id}`} className="text-xs cursor-pointer">B</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Subgrupo */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Subgrupo *</Label>
            <Select value={uc.subgrupo} onValueChange={v => onUpdate("subgrupo", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Selecione uma opção" />
              </SelectTrigger>
              <SelectContent>
                {subgrupos.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Consumo */}
          {isGrupoA ? (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Consumo Ponta (HP) e Fora Ponta (HFP)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">HP *</Label>
                    <button onClick={() => onOpenMesAMes("hp")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      mês a mês <Edit2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Input type="number" min={0} value={uc.consumo_mensal_p || ""} onChange={e => onUpdate("consumo_mensal_p", Number(e.target.value))} className="h-8 text-xs pr-10" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] text-muted-foreground">HFP *</Label>
                    <button onClick={() => onOpenMesAMes("hfp")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                      mês a mês <Edit2 className="h-2.5 w-2.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Input type="number" min={0} value={uc.consumo_mensal_fp || ""} onChange={e => onUpdate("consumo_mensal_fp", Number(e.target.value))} className="h-8 text-xs pr-10" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Consumo *</Label>
                <button onClick={() => onOpenMesAMes("consumo")} className="text-[10px] text-primary hover:underline flex items-center gap-0.5">
                  mês a mês <Edit2 className="h-2.5 w-2.5" />
                </button>
              </div>
              <div className="relative">
                <Input type="number" min={0} value={uc.consumo_mensal || ""} onChange={e => onUpdate("consumo_mensal", Number(e.target.value))} className="h-8 text-xs pr-10" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
              </div>
            </div>
          )}

          {/* Fase e Tensão */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Fase e Tensão da Rede *</Label>
            <Select value={uc.fase_tensao} onValueChange={v => onUpdate("fase_tensao", v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FASE_TENSAO_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Tarifa (Grupo B only) */}
          {!isGrupoA && (
            <div className="flex items-center gap-4 text-xs">
              <span className="text-primary">
                Tarifa: R${(uc.tarifa_distribuidora || 0).toFixed(5)}
                <button className="ml-1 inline-flex" onClick={onOpenConfig}><Edit2 className="h-2.5 w-2.5 text-primary" /></button>
              </span>
              <span className="text-primary">
                FioB: R${(uc.tarifa_fio_b || 0).toFixed(5)}
                <button className="ml-1 inline-flex" onClick={onOpenConfig}><Edit2 className="h-2.5 w-2.5 text-primary" /></button>
              </span>
            </div>
          )}
        </div>

        {/* Right column (Grupo A only) */}
        {isGrupoA && (
          <div className="space-y-3 flex-1">
            {/* Demanda Consumo */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Demanda Consumo *</Label>
              <div className="relative">
                <Input type="number" min={0} value={uc.demanda_consumo_kw || ""} onChange={e => onUpdate("demanda_consumo_kw", Number(e.target.value))} className="h-8 text-xs pr-8" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kW</span>
              </div>
            </div>

            {/* Demanda Geração */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Demanda de Geração *</Label>
              <div className="relative">
                <Input type="number" min={0} value={uc.demanda_geracao_kw || ""} onChange={e => onUpdate("demanda_geracao_kw", Number(e.target.value))} className="h-8 text-xs pr-8" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kW</span>
              </div>
            </div>

            {/* Tarifa Ponta / Fora Ponta */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tarifa Ponta</Label>
                <div className="space-y-0.5 text-xs">
                  <TarifaEditRow label="TE" value={uc.tarifa_te_p} onEdit={onOpenConfig} />
                  <TarifaEditRow label="TUSD" value={uc.tarifa_tusd_p} onEdit={onOpenConfig} />
                  {isGD3 ? (
                    <TarifaEditRow label="Tarifação" value={uc.tarifa_tarifacao_p} onEdit={onOpenConfig} />
                  ) : (
                    <TarifaEditRow label="FioB" value={uc.tarifa_fio_b_p} onEdit={onOpenConfig} />
                  )}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tarifa Fora Ponta</Label>
                <div className="space-y-0.5 text-xs">
                  <TarifaEditRow label="TE" value={uc.tarifa_te_fp} onEdit={onOpenConfig} />
                  <TarifaEditRow label="TUSD" value={uc.tarifa_tusd_fp} onEdit={onOpenConfig} />
                  {isGD3 ? (
                    <TarifaEditRow label="Tarifação" value={uc.tarifa_tarifacao_fp} onEdit={onOpenConfig} />
                  ) : (
                    <TarifaEditRow label="FioB" value={uc.tarifa_fio_b_fp} onEdit={onOpenConfig} />
                  )}
                </div>
              </div>
            </div>

            {/* Demanda R$ */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Demanda</Label>
              <div className="flex gap-4 text-xs">
                <span className="text-primary">
                  Consumo: R${(uc.demanda_consumo_rs || 0).toFixed(2)}
                  <button className="ml-1 inline-flex" onClick={onOpenConfig}><Edit2 className="h-2.5 w-2.5 text-primary" /></button>
                </span>
                <span className="text-primary">
                  Geração: R${(uc.demanda_geracao_rs || 0).toFixed(2)}
                  <button className="ml-1 inline-flex" onClick={onOpenConfig}><Edit2 className="h-2.5 w-2.5 text-primary" /></button>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Separator className="opacity-40" />
      <div className="flex items-center justify-between">
        <button onClick={onOpenConfig} className="text-xs text-primary hover:underline flex items-center gap-1.5">
          <Settings className="h-3.5 w-3.5" /> Configurações adicionais
        </button>
        {totalUCs > 1 && uc.is_geradora && (
          <button onClick={onOpenRateio} className="text-xs text-primary hover:underline flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Gerenciar rateio de créditos
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Tarifa Edit Row ──────────────────────────────────────
function TarifaEditRow({ label, value, onEdit }: { label: string; value: number; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-1 text-primary">
      <span className="text-muted-foreground">{label}:</span>
      <span>R${(value || 0).toFixed(5)}</span>
      <button className="inline-flex" onClick={onEdit}><Edit2 className="h-2.5 w-2.5" /></button>
    </div>
  );
}

// ─── Config Modal ─────────────────────────────────────────
function UCConfigModal({ uc, onUpdate, onClose }: {
  uc: UCData;
  onUpdate: (field: keyof UCData, value: any) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Configurações adicionais — {uc.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Imposto Energia Compensada</Label>
            <div className="relative">
              <Input type="number" step={0.01} value={uc.imposto_energia || ""} onChange={e => onUpdate("imposto_energia", Number(e.target.value))} className="h-9 pr-6" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Custo de Disponibilidade *</Label>
            <div className="relative">
              <Input type="number" value={uc.custo_disponibilidade_kwh || ""} onChange={e => onUpdate("custo_disponibilidade_kwh", Number(e.target.value))} className="h-9 pr-10" />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">kWh</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Encargos Atual</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input type="number" step={0.01} value={uc.outros_encargos_atual || ""} onChange={e => onUpdate("outros_encargos_atual", Number(e.target.value))} className="h-9 pl-8" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Encargos Novo</Label>
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input type="number" step={0.01} value={uc.outros_encargos_novo || ""} onChange={e => onUpdate("outros_encargos_novo", Number(e.target.value))} className="h-9 pl-8" />
              </div>
            </div>
          </div>

          {/* Tarifas editáveis para Grupo A */}
          {uc.grupo_tarifario === "A" && (
            <>
              <Separator />
              <Label className="text-xs font-semibold">Tarifas detalhadas</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground font-semibold">Ponta</Label>
                  <InputField label="TE" value={uc.tarifa_te_p} onChange={v => onUpdate("tarifa_te_p", v)} prefix="R$" />
                  <InputField label="TUSD" value={uc.tarifa_tusd_p} onChange={v => onUpdate("tarifa_tusd_p", v)} prefix="R$" />
                  {uc.regra === "GD3" ? (
                    <InputField label="Tarifação" value={uc.tarifa_tarifacao_p} onChange={v => onUpdate("tarifa_tarifacao_p", v)} prefix="R$" />
                  ) : (
                    <InputField label="FioB" value={uc.tarifa_fio_b_p} onChange={v => onUpdate("tarifa_fio_b_p", v)} prefix="R$" />
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] text-muted-foreground font-semibold">Fora Ponta</Label>
                  <InputField label="TE" value={uc.tarifa_te_fp} onChange={v => onUpdate("tarifa_te_fp", v)} prefix="R$" />
                  <InputField label="TUSD" value={uc.tarifa_tusd_fp} onChange={v => onUpdate("tarifa_tusd_fp", v)} prefix="R$" />
                  {uc.regra === "GD3" ? (
                    <InputField label="Tarifação" value={uc.tarifa_tarifacao_fp} onChange={v => onUpdate("tarifa_tarifacao_fp", v)} prefix="R$" />
                  ) : (
                    <InputField label="FioB" value={uc.tarifa_fio_b_fp} onChange={v => onUpdate("tarifa_fio_b_fp", v)} prefix="R$" />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Demanda Consumo (R$)" value={uc.demanda_consumo_rs} onChange={v => onUpdate("demanda_consumo_rs", v)} prefix="R$" />
                <InputField label="Demanda Geração (R$)" value={uc.demanda_geracao_rs} onChange={v => onUpdate("demanda_geracao_rs", v)} prefix="R$" />
              </div>
            </>
          )}

          {/* Tarifas para Grupo B */}
          {uc.grupo_tarifario === "B" && (
            <>
              <Separator />
              <div className="grid grid-cols-2 gap-3">
                <InputField label="Tarifa (R$/kWh)" value={uc.tarifa_distribuidora} onChange={v => onUpdate("tarifa_distribuidora", v)} prefix="R$" step={0.00001} />
                <InputField label="Fio B (R$/kWh)" value={uc.tarifa_fio_b} onChange={v => onUpdate("tarifa_fio_b", v)} prefix="R$" step={0.00001} />
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Fechar</Button>
          <Button size="sm" onClick={onClose}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Input Field Helper ────────────────────────────────────
function InputField({ label, value, onChange, prefix, step }: {
  label: string; value: number; onChange: (v: number) => void; prefix?: string; step?: number;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{prefix}</span>}
        <Input
          type="number"
          step={step || 0.01}
          value={value || ""}
          onChange={e => onChange(Number(e.target.value))}
          className={`h-7 text-xs ${prefix ? "pl-7" : ""}`}
        />
      </div>
    </div>
  );
}

// ─── Rateio Modal ──────────────────────────────────────────
function RateioModal({ open, onOpenChange, ucs, rateioManual, onRateioManualChange, onUpdateRateio, totalRateio }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  ucs: UCData[];
  rateioManual: boolean;
  onRateioManualChange: (v: boolean) => void;
  onUpdateRateio: (index: number, value: number) => void;
  totalRateio: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm flex items-center justify-between">
            Gerenciador de rateio de créditos
            <Badge variant={totalRateio === 100 ? "default" : "destructive"} className="text-xs">
              Rateio Total: {totalRateio}%
            </Badge>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Switch checked={rateioManual} onCheckedChange={onRateioManualChange} />
            <Label className="text-xs">Habilitar rateio manual dos créditos</Label>
          </div>
          {rateioManual ? (
            <div className="space-y-3">
              {ucs.map((uc, i) => (
                <div key={uc.id} className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/30">
                  <span className="text-xs font-medium">{i + 1}. {uc.nome} {uc.is_geradora ? "(Geradora)" : ""}</span>
                  <div className="relative w-20">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={uc.rateio_creditos || ""}
                      onChange={e => onUpdateRateio(i, Number(e.target.value))}
                      className="h-7 text-xs pr-5"
                    />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">
              <Badge variant="outline" className="text-xs">Rateio automático</Badge>
              <br /><br />
              Os créditos serão distribuídos automaticamente entre as UCs.
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Voltar</Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Mês a Mês Modal ──────────────────────────────────────
function MesAMesModal({ uc, tipo, onUpdate, onClose }: {
  uc: UCData;
  tipo: "consumo" | "hp" | "hfp";
  onUpdate: (mes: string, value: number) => void;
  onClose: () => void;
}) {
  const label = tipo === "consumo" ? "Consumo" : tipo === "hp" ? "Consumo Ponta (HP)" : "Consumo Fora Ponta (HFP)";
  const meses = tipo === "consumo" ? uc.consumo_meses : tipo === "hp" ? uc.consumo_meses_p : uc.consumo_meses_fp;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-sm">{label} — mês a mês — {uc.nome}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {MESES.map(m => (
            <div key={m} className="space-y-0.5">
              <Label className="text-[10px] uppercase text-muted-foreground">{m}</Label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  value={meses[m] || ""}
                  onChange={e => onUpdate(m, Number(e.target.value))}
                  className="h-8 text-xs pr-10"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button size="sm" onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
