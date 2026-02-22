import { useState, useEffect, useRef } from "react";
import { Info } from "lucide-react";
import { AlertCircle, MoreVertical, Pencil, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { type UCData, type RegraCompensacao, type GrupoTarifario, FASE_TENSAO_OPTIONS, SUBGRUPO_BT, SUBGRUPO_MT, SUBGRUPO_MT_LABELS } from "../types";
import { resolveGrupoFromSubgrupo } from "@/lib/validateGrupoConsistency";
import { useFetchTarifaSubgrupo, parseSubgrupoModalidade, fetchAvailableSubgrupos } from "@/hooks/useConcessionariaTarifaSubgrupo";
import { getFioBCobranca } from "@/lib/calcGrupoB";

const SUBGRUPO_BT_LABELS: Record<string, string> = {
  B1: "B1 - Convencional - Residencial",
  B2: "B2 - Rural",
  B3: "B3 - Demais Classes",
};

const FASE_SIMPLE = [
  { value: "monofasico", label: "Monofásico" },
  { value: "bifasico", label: "Bifásico" },
  { value: "trifasico", label: "Trifásico" },
];

interface UCCardProps {
  uc: UCData;
  index: number;
  onChange: (uc: UCData) => void;
  onRemove: () => void;
  onOpenConfig: () => void;
  onOpenMesAMes: (field: "consumo" | "hp" | "hfp") => void;
  isFirst: boolean;
  totalUcs: number;
}

/* ── Editable inline value ── */
function EditableValue({ label, value, decimals = 5, onChange }: {
  label: string; value: number; decimals?: number; onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState("");

  if (editing) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="text-[10px] text-muted-foreground">{label}:</span>
        <Input
          type="number"
          step="any"
          value={temp}
          onChange={e => setTemp(e.target.value)}
          onBlur={() => { onChange(Number(temp)); setEditing(false); }}
          onKeyDown={e => { if (e.key === "Enter") { onChange(Number(temp)); setEditing(false); } }}
          className="h-6 w-24 text-[10px] px-1"
          autoFocus
        />
      </span>
    );
  }

  const formatted = `R$${value.toFixed(decimals).replace(".", ",")}`;
  return (
    <button
      onClick={() => { setTemp(String(value)); setEditing(true); }}
      className="text-[10px] text-secondary hover:underline inline-flex items-center gap-0.5"
    >
      {label}: {formatted} <Pencil className="h-2.5 w-2.5" />
    </button>
  );
}

/* ── Section wrapper for visual grouping ── */
function Section({ title, children, className = "" }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {title && (
        <p className="text-[10px] font-semibold text-foreground uppercase tracking-wide">{title}</p>
      )}
      {children}
    </div>
  );
}

/* ── Main UCCard component ── */
export function UCCard({ uc, index, onChange, onRemove, onOpenConfig, onOpenMesAMes, isFirst, totalUcs }: UCCardProps) {
  const isGrupoA = uc.grupo_tarifario === "A";
  const isGD3 = uc.regra === "GD3";
  const resolvedGrupo = resolveGrupoFromSubgrupo(uc.subgrupo) || uc.grupo_tarifario;
  const { fetchTarifa } = useFetchTarifaSubgrupo();
  const [dynamicSubgruposMT, setDynamicSubgruposMT] = useState<Array<{ value: string; label: string }> | null>(null);
  const [tarifaDialogOpen, setTarifaDialogOpen] = useState(false);
  const prevSubgrupoRef = useRef(uc.subgrupo);
  const prevDistRef = useRef(uc.distribuidora_id);

  // Fetch dynamic subgrupos when distribuidora changes
  useEffect(() => {
    if (!uc.distribuidora_id) {
      setDynamicSubgruposMT(null);
      return;
    }
    fetchAvailableSubgrupos(uc.distribuidora_id, isGrupoA ? "A" : "B").then(results => {
      setDynamicSubgruposMT(results.length > 0 ? results : null);
    });
  }, [uc.distribuidora_id, isGrupoA]);

  // Auto-fetch tarifas when subgrupo or distribuidora changes
  useEffect(() => {
    const subgrupoChanged = prevSubgrupoRef.current !== uc.subgrupo;
    const distChanged = prevDistRef.current !== uc.distribuidora_id;
    prevSubgrupoRef.current = uc.subgrupo;
    prevDistRef.current = uc.distribuidora_id;

    if (!subgrupoChanged && !distChanged) return;
    if (!uc.distribuidora_id || !uc.subgrupo) return;

    fetchTarifa(uc.distribuidora_id, uc.subgrupo).then(tarifa => {
      if (!tarifa) return;
      const { subgrupo: baseSub } = parseSubgrupoModalidade(uc.subgrupo);
      const isBT = baseSub.startsWith("B");

      // Aplica Lei 14.300 ao Fio B: banco armazena 100%, aqui aplica % do ano vigente
      const applyFioB = (val: number) => {
        const pct = getFioBCobranca() ?? 0.90;
        return Math.round(val * pct * 100000) / 100000;
      };

      const updated = { ...uc };
      if (isBT) {
        updated.tarifa_distribuidora = tarifa.tarifa_energia || uc.tarifa_distribuidora;
        updated.tarifa_fio_b = tarifa.tarifa_fio_b ? applyFioB(tarifa.tarifa_fio_b) : uc.tarifa_fio_b;
        updated.tarifa_tarifacao_fp = tarifa.tarifacao_bt || uc.tarifa_tarifacao_fp;
      } else {
        updated.tarifa_te_p = tarifa.te_ponta || uc.tarifa_te_p;
        updated.tarifa_tusd_p = tarifa.tusd_ponta || uc.tarifa_tusd_p;
        updated.tarifa_fio_b_p = tarifa.fio_b_ponta ? applyFioB(tarifa.fio_b_ponta) : uc.tarifa_fio_b_p;
        updated.tarifa_te_fp = tarifa.te_fora_ponta || uc.tarifa_te_fp;
        updated.tarifa_tusd_fp = tarifa.tusd_fora_ponta || uc.tarifa_tusd_fp;
        updated.tarifa_fio_b_fp = tarifa.fio_b_fora_ponta ? applyFioB(tarifa.fio_b_fora_ponta) : uc.tarifa_fio_b_fp;
        updated.tarifa_tarifacao_p = tarifa.tarifacao_ponta || uc.tarifa_tarifacao_p;
        updated.tarifa_tarifacao_fp = tarifa.tarifacao_fora_ponta || uc.tarifa_tarifacao_fp;
        updated.demanda_consumo_rs = tarifa.demanda_consumo_rs || uc.demanda_consumo_rs;
        updated.demanda_geracao_rs = tarifa.demanda_geracao_rs || uc.demanda_geracao_rs;
      }
      onChange(updated);
    });
  }, [uc.subgrupo, uc.distribuidora_id]);

  // Determine which MT subgrupos to show
  const mtOptions = dynamicSubgruposMT && dynamicSubgruposMT.length > 0
    ? dynamicSubgruposMT
    : SUBGRUPO_MT.map(s => ({ value: s, label: SUBGRUPO_MT_LABELS[s] || s }));

  const update = <K extends keyof UCData>(field: K, value: UCData[K]) => {
    const updated = { ...uc, [field]: value };
    if (field === "grupo_tarifario") {
      updated.subgrupo = "";
      updated.tipo_dimensionamento = value === "A" ? "MT" : "BT";
    }
    onChange(updated);
  };

  return (
    <div className="rounded-lg border border-border bg-card w-[320px] min-w-[280px] flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className="text-xs font-bold text-foreground whitespace-nowrap">
            {index + 1}. {isFirst ? "(Geradora)" : "Unidade"}
          </p>
          <Badge
            variant="outline"
            className={`text-[8px] px-1 py-0 font-bold ${
              resolvedGrupo === "A"
                ? "border-blue-400/50 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400"
                : resolvedGrupo === "B"
                ? "border-green-400/50 bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                : "border-destructive/50 bg-destructive/5 text-destructive"
            }`}
          >
            {resolvedGrupo ? `Grupo ${resolvedGrupo}` : "?"}
          </Badge>
          {uc.subgrupo && (
            <Badge variant="secondary" className="text-[8px] px-1 py-0">
              {uc.subgrupo}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-secondary hover:text-secondary/80 p-0.5"><AlertCircle className="h-3.5 w-3.5" /></button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Informações da UC</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {totalUcs > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-0.5"><MoreVertical className="h-3.5 w-3.5" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={onRemove} className="text-destructive">Remover UC</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-3 pb-2.5 space-y-0">
        {/* ── SEÇÃO 1: Classificação ── */}
        <Section>
          {/* Regra */}
          <div className="space-y-1">
            <Label className="text-[11px] flex items-center gap-1">
              Regra <span className="text-destructive">*</span>
              <TooltipProvider><Tooltip>
                <TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger>
                <TooltipContent><p className="text-xs">GD II (Lei 14.300) ou GD III</p></TooltipContent>
              </Tooltip></TooltipProvider>
            </Label>
            <RadioGroup value={uc.regra} onValueChange={v => update("regra", v as RegraCompensacao)} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="GD2" id={`gd2-${uc.id}`} />
                <Label htmlFor={`gd2-${uc.id}`} className="text-xs cursor-pointer">GD II</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="GD3" id={`gd3-${uc.id}`} />
                <Label htmlFor={`gd3-${uc.id}`} className="text-xs cursor-pointer">GD III</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Grupo Tarifário */}
          <div className="space-y-1">
            <Label className="text-[11px]">Grupo Tarifário <span className="text-destructive">*</span></Label>
            <RadioGroup value={uc.grupo_tarifario} onValueChange={v => update("grupo_tarifario", v as GrupoTarifario)} className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="A" id={`ga-${uc.id}`} />
                <Label htmlFor={`ga-${uc.id}`} className="text-xs cursor-pointer">A</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="B" id={`gb-${uc.id}`} />
                <Label htmlFor={`gb-${uc.id}`} className="text-xs cursor-pointer">B</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Subgrupo */}
          <div className="space-y-1">
            <Label className="text-[11px]">Subgrupo <span className="text-destructive">*</span></Label>
            <Select value={uc.subgrupo} onValueChange={v => update("subgrupo", v)}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione uma opção" /></SelectTrigger>
              <SelectContent>
                {isGrupoA
                  ? mtOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)
                  : SUBGRUPO_BT.map(s => <SelectItem key={s} value={s}>{SUBGRUPO_BT_LABELS[s] || s}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>
        </Section>

        <div className="border-t border-border/40 my-1.5" />

        {/* ── SEÇÃO 2: Consumo ── */}
        <Section>
          {isGrupoA ? (
            <>
              <Label className="text-[11px] text-muted-foreground">Consumo Ponta (HP) e Fora Ponta (HFP)</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">HP <span className="text-destructive">*</span></span>
                    <button onClick={() => onOpenMesAMes("hp")} className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">mês a mês <Pencil className="h-2.5 w-2.5" /></button>
                  </div>
                  <div className="relative">
                    <Input type="number" min={0} value={uc.consumo_mensal_p || ""} onChange={e => update("consumo_mensal_p", Number(e.target.value))} className="h-8 text-xs pr-10" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">HFP <span className="text-destructive">*</span></span>
                    <button onClick={() => onOpenMesAMes("hfp")} className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">mês a mês <Pencil className="h-2.5 w-2.5" /></button>
                  </div>
                  <div className="relative">
                    <Input type="number" min={0} value={uc.consumo_mensal_fp || ""} onChange={e => update("consumo_mensal_fp", Number(e.target.value))} className="h-8 text-xs pr-10" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-[11px]">Consumo <span className="text-destructive">*</span></Label>
                <button onClick={() => onOpenMesAMes("consumo")} className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">mês a mês <Pencil className="h-2.5 w-2.5" /></button>
              </div>
              <div className="relative">
                <Input type="number" min={0} value={uc.consumo_mensal || ""} onChange={e => update("consumo_mensal", Number(e.target.value))} className="h-8 text-xs pr-10" />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh</span>
              </div>
            </>
          )}

          {/* Fase */}
          <div className="space-y-1 pt-1">
            <Label className="text-[11px]">{isFirst ? "Fase e Tensão da Rede" : "Fase"} <span className="text-destructive">*</span></Label>
            {isFirst ? (
              <Select value={uc.fase_tensao} onValueChange={v => update("fase_tensao", v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FASE_TENSAO_OPTIONS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            ) : (
              <Select value={uc.fase} onValueChange={v => update("fase", v as any)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{FASE_SIMPLE.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
        </Section>

        <div className="border-t border-border/40 my-1.5" />

        {/* ── SEÇÃO 3: Tarifas ── */}
        {/* Indicador de dados auto-carregados */}
        {(uc.tarifa_distribuidora > 0 || uc.tarifa_te_p > 0) && (
          <div className="flex items-center gap-1.5 mb-2 px-1 py-1 rounded bg-accent/30 border border-accent/50">
            <Info className="h-3 w-3 text-accent-foreground shrink-0" />
            <p className="text-[10px] text-accent-foreground leading-tight">
              Tarifas pré-carregadas das <strong>Premissas do Tenant</strong>
              {uc.distribuidora ? ` (${uc.distribuidora})` : ""}. Clique nos valores para editar.
            </p>
          </div>
        )}

        {isGrupoA ? (
          <>
            {/* Demanda */}
            <Section title="Demanda">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px]">Consumo <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Input type="number" min={0} value={uc.demanda_consumo_kw || ""} onChange={e => update("demanda_consumo_kw", Number(e.target.value))} className="h-8 text-xs pr-8" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kW</span>
                  </div>
                </div>
                {isFirst && (
                  <div className="space-y-1">
                    <Label className="text-[11px]">Geração <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input type="number" min={0} value={uc.demanda_geracao_kw || ""} onChange={e => update("demanda_geracao_kw", Number(e.target.value))} className="h-8 text-xs pr-8" />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kW</span>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <div className="border-t border-border/40 my-1.5" />

            {/* Tarifas Ponta / Fora Ponta — click opens dialog */}
            <Section>
              <button
                onClick={() => setTarifaDialogOpen(true)}
                className="w-full text-left"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">Tarifa Ponta <Pencil className="h-2.5 w-2.5 text-secondary" /></p>
                    <div className="space-y-0.5 pl-1 border-l-2 border-secondary/30 text-[10px] text-secondary">
                      <span>TE: R${(uc.tarifa_te_p || 0).toFixed(5).replace(".", ",")}</span><br />
                      <span>TUSD: R${(uc.tarifa_tusd_p || 0).toFixed(5).replace(".", ",")}</span><br />
                      <span>{isGD3 ? "Tarifação" : "FioB"}: R${(isGD3 ? (uc.tarifa_tarifacao_p || 0) : (uc.tarifa_fio_b_p || 0)).toFixed(5).replace(".", ",")}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">Tarifa Fora Ponta <Pencil className="h-2.5 w-2.5 text-secondary" /></p>
                    <div className="space-y-0.5 pl-1 border-l-2 border-primary/30 text-[10px] text-secondary">
                      <span>TE: R${(uc.tarifa_te_fp || 0).toFixed(5).replace(".", ",")}</span><br />
                      <span>TUSD: R${(uc.tarifa_tusd_fp || 0).toFixed(5).replace(".", ",")}</span><br />
                      <span>{isGD3 ? "Tarifação" : "FioB"}: R${(isGD3 ? (uc.tarifa_tarifacao_fp || 0) : (uc.tarifa_fio_b_fp || 0)).toFixed(5).replace(".", ",")}</span>
                    </div>
                  </div>
                </div>
              </button>
            </Section>

            <div className="border-t border-border/40 my-1.5" />

            {/* Demanda R$ */}
            <Section title="Demanda (R$)">
              <div className="flex items-center gap-4">
                <EditableValue label="Consumo" value={uc.demanda_consumo_rs} decimals={2} onChange={v => update("demanda_consumo_rs", v)} />
                {isFirst && (
                  <EditableValue label="Geração" value={uc.demanda_geracao_rs} decimals={2} onChange={v => update("demanda_geracao_rs", v)} />
                )}
              </div>
            </Section>
          </>
        ) : (
          /* Tarifas Grupo B — click opens dialog */
          <Section title="Tarifas">
            <div className="flex items-center gap-4 flex-wrap">
              <button
                onClick={() => setTarifaDialogOpen(true)}
                className="text-[10px] text-secondary hover:underline inline-flex items-center gap-0.5"
              >
                Tarifa: R${uc.tarifa_distribuidora.toFixed(5).replace(".", ",")} <Pencil className="h-2.5 w-2.5" />
              </button>
              <button
                onClick={() => setTarifaDialogOpen(true)}
                className="text-[10px] text-secondary hover:underline inline-flex items-center gap-0.5"
              >
                {isGD3 ? "Tarifação" : "FioB"}: R${(isGD3 ? (uc.tarifa_tarifacao_fp || 0) : uc.tarifa_fio_b).toFixed(5).replace(".", ",")} <Pencil className="h-2.5 w-2.5" />
              </button>
            </div>
          </Section>
        )}
      </div>

      {/* ── Tarifa Edit Dialog ── */}
      <TarifaEditDialog
        open={tarifaDialogOpen}
        onOpenChange={setTarifaDialogOpen}
        uc={uc}
        index={index}
        isGD3={isGD3}
        isGrupoA={isGrupoA}
        onChange={onChange}
      />

      {/* ── Footer ── */}
      <div className="border-t border-border/50 px-3 py-1.5 mt-auto">
        <button onClick={onOpenConfig} className="text-[10px] text-secondary hover:underline flex items-center gap-1">
          <Settings2 className="h-3 w-3" /> Configurações adicionais
        </button>
      </div>
    </div>
  );
}

/* ── Tarifa Edit Dialog ── */
function TarifaEditDialog({ open, onOpenChange, uc, index, isGD3, isGrupoA, onChange }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  uc: UCData;
  index: number;
  isGD3: boolean;
  isGrupoA: boolean;
  onChange: (uc: UCData) => void;
}) {
  const [tarifa, setTarifa] = useState(0);
  const [fioB, setFioB] = useState(0);
  // Grupo A fields
  const [teP, setTeP] = useState(0);
  const [tusdP, setTusdP] = useState(0);
  const [fioBP, setFioBP] = useState(0);
  const [teFP, setTeFP] = useState(0);
  const [tusdFP, setTusdFP] = useState(0);
  const [fioBFP, setFioBFP] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (isGrupoA) {
      setTeP(uc.tarifa_te_p || 0);
      setTusdP(uc.tarifa_tusd_p || 0);
      setFioBP(isGD3 ? (uc.tarifa_tarifacao_p || 0) : (uc.tarifa_fio_b_p || 0));
      setTeFP(uc.tarifa_te_fp || 0);
      setTusdFP(uc.tarifa_tusd_fp || 0);
      setFioBFP(isGD3 ? (uc.tarifa_tarifacao_fp || 0) : (uc.tarifa_fio_b_fp || 0));
    } else {
      setTarifa(uc.tarifa_distribuidora || 0);
      setFioB(isGD3 ? (uc.tarifa_tarifacao_fp || 0) : (uc.tarifa_fio_b || 0));
    }
  }, [open, uc, isGrupoA, isGD3]);

  const handleSave = () => {
    const updated = { ...uc };
    if (isGrupoA) {
      updated.tarifa_te_p = teP;
      updated.tarifa_tusd_p = tusdP;
      if (isGD3) updated.tarifa_tarifacao_p = fioBP;
      else updated.tarifa_fio_b_p = fioBP;
      updated.tarifa_te_fp = teFP;
      updated.tarifa_tusd_fp = tusdFP;
      if (isGD3) updated.tarifa_tarifacao_fp = fioBFP;
      else updated.tarifa_fio_b_fp = fioBFP;
    } else {
      updated.tarifa_distribuidora = tarifa;
      if (isGD3) updated.tarifa_tarifacao_fp = fioB;
      else updated.tarifa_fio_b = fioB;
    }
    onChange(updated);
    onOpenChange(false);
  };

  const ucLabel = index === 0 ? `${index + 1}. Unidade (Geradora)` : `${index + 1}. Unidade`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{ucLabel}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {isGrupoA ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold">Ponta</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">TE <span className="text-destructive">*</span></Label>
                    <Input type="number" step="any" value={teP || ""} onChange={e => setTeP(Number(e.target.value))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">TUSD <span className="text-destructive">*</span></Label>
                    <Input type="number" step="any" value={tusdP || ""} onChange={e => setTusdP(Number(e.target.value))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isGD3 ? "Tarifação" : "FioB"} <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input type="number" step="any" value={fioBP || ""} onChange={e => setFioBP(Number(e.target.value))} className="h-9 text-sm pr-16" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$/kWh</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold">Fora Ponta</p>
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-xs">TE <span className="text-destructive">*</span></Label>
                    <Input type="number" step="any" value={teFP || ""} onChange={e => setTeFP(Number(e.target.value))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">TUSD <span className="text-destructive">*</span></Label>
                    <Input type="number" step="any" value={tusdFP || ""} onChange={e => setTusdFP(Number(e.target.value))} className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">{isGD3 ? "Tarifação" : "FioB"} <span className="text-destructive">*</span></Label>
                    <div className="relative">
                      <Input type="number" step="any" value={fioBFP || ""} onChange={e => setFioBFP(Number(e.target.value))} className="h-9 text-sm pr-16" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$/kWh</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-xs">Tarifa <span className="text-destructive">*</span></Label>
                <Input
                  type="number"
                  step="any"
                  value={tarifa || ""}
                  onChange={e => setTarifa(Number(e.target.value))}
                  className="h-10 text-sm"
                  placeholder="R$ 0,00000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">TUSD {isGD3 ? "Tarifação" : "Fio B"} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="any"
                    value={fioB || ""}
                    onChange={e => setFioB(Number(e.target.value))}
                    className="h-10 text-sm pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$/kWh</span>
                </div>
                {!isGD3 && (
                  <p className="text-[10px] text-secondary">100% TUSD Fio B</p>
                )}
              </div>
            </>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 pt-2 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
          <Button onClick={handleSave} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
