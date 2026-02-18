import { useState } from "react";
import { Info } from "lucide-react";
import { AlertCircle, MoreVertical, Pencil, Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { type UCData, type RegraCompensacao, type GrupoTarifario, FASE_TENSAO_OPTIONS, SUBGRUPO_BT, SUBGRUPO_MT } from "../types";

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
    <div className={`space-y-2 ${className}`}>
      {title && (
        <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">{title}</p>
      )}
      {children}
    </div>
  );
}

/* ── Main UCCard component ── */
export function UCCard({ uc, index, onChange, onRemove, onOpenConfig, onOpenMesAMes, isFirst, totalUcs }: UCCardProps) {
  const isGrupoA = uc.grupo_tarifario === "A";
  const isGD3 = uc.regra === "GD3";

  const update = <K extends keyof UCData>(field: K, value: UCData[K]) => {
    const updated = { ...uc, [field]: value };
    if (field === "grupo_tarifario") {
      updated.subgrupo = "";
      updated.tipo_dimensionamento = value === "A" ? "MT" : "BT";
    }
    onChange(updated);
  };

  return (
    <div className="rounded-xl border border-border bg-card min-w-[280px] max-w-[420px] flex-shrink-0 flex flex-col">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="text-sm font-bold text-foreground">
          {index + 1}. {isFirst ? "(Geradora)" : "Unidade"}
        </p>
        <div className="flex items-center gap-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button className="text-secondary hover:text-secondary/80 p-0.5"><AlertCircle className="h-4 w-4" /></button>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">Informações da UC</p></TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {totalUcs > 1 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground p-0.5"><MoreVertical className="h-4 w-4" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={onRemove} className="text-destructive">Remover UC</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 px-4 pb-3 space-y-0">
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
                  ? SUBGRUPO_MT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)
                  : SUBGRUPO_BT.map(s => <SelectItem key={s} value={s}>{SUBGRUPO_BT_LABELS[s] || s}</SelectItem>)
                }
              </SelectContent>
            </Select>
          </div>
        </Section>

        <div className="border-t border-border/40 my-3" />

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

        <div className="border-t border-border/40 my-3" />

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

            <div className="border-t border-border/40 my-3" />

            {/* Tarifas Ponta / Fora Ponta */}
            <Section>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-foreground">Tarifa Ponta</p>
                  <div className="space-y-0.5 pl-1 border-l-2 border-secondary/30">
                    <EditableValue label="TE" value={uc.tarifa_te_p} onChange={v => update("tarifa_te_p", v)} />
                    <br />
                    <EditableValue label="TUSD" value={uc.tarifa_tusd_p} onChange={v => update("tarifa_tusd_p", v)} />
                    <br />
                    <EditableValue
                      label={isGD3 ? "Tarifação" : "FioB"}
                      value={isGD3 ? (uc.tarifa_tarifacao_p || 0) : uc.tarifa_fio_b_p}
                      onChange={v => isGD3 ? update("tarifa_tarifacao_p", v) : update("tarifa_fio_b_p", v)}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-foreground">Tarifa Fora Ponta</p>
                  <div className="space-y-0.5 pl-1 border-l-2 border-primary/30">
                    <EditableValue label="TE" value={uc.tarifa_te_fp} onChange={v => update("tarifa_te_fp", v)} />
                    <br />
                    <EditableValue label="TUSD" value={uc.tarifa_tusd_fp} onChange={v => update("tarifa_tusd_fp", v)} />
                    <br />
                    <EditableValue
                      label={isGD3 ? "Tarifação" : "FioB"}
                      value={isGD3 ? (uc.tarifa_tarifacao_fp || 0) : uc.tarifa_fio_b_fp}
                      onChange={v => isGD3 ? update("tarifa_tarifacao_fp", v) : update("tarifa_fio_b_fp", v)}
                    />
                  </div>
                </div>
              </div>
            </Section>

            <div className="border-t border-border/40 my-3" />

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
          /* Tarifas Grupo B */
          <Section title="Tarifas">
            <div className="flex items-center gap-4 flex-wrap">
              <EditableValue label="Tarifa" value={uc.tarifa_distribuidora} onChange={v => update("tarifa_distribuidora", v)} />
              <EditableValue
                label={isGD3 ? "Tarifação" : "FioB"}
                value={isGD3 ? (uc.tarifa_tarifacao_fp || 0) : uc.tarifa_fio_b}
                onChange={v => isGD3 ? update("tarifa_tarifacao_fp", v) : update("tarifa_fio_b", v)}
              />
            </div>
          </Section>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="border-t border-border/50 px-4 py-2.5 mt-auto">
        <button onClick={onOpenConfig} className="text-xs text-secondary hover:underline flex items-center gap-1.5">
          <Settings2 className="h-3.5 w-3.5" /> Configurações adicionais
        </button>
      </div>
    </div>
  );
}
