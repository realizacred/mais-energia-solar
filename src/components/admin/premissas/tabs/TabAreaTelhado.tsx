import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Save, Loader2, Plus, Trash2, LayoutGrid, ChevronDown, Pencil } from "lucide-react";
import type { RoofAreaFactor } from "@/hooks/useTenantPremises";
import { getRoofLabel, TOPOLOGIA_OPTIONS, TIPO_SISTEMA_OPTIONS } from "@/hooks/useTenantPremises";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface Props {
  roofFactors: RoofAreaFactor[];
  onSave: (factors: RoofAreaFactor[]) => void;
  saving: boolean;
}

const INCLINACOES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45];

export function TabAreaTelhado({ roofFactors, onSave, saving }: Props) {
  const [local, setLocal] = useState<RoofAreaFactor[]>(() => [...roofFactors]);
  const [newName, setNewName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updateFactor = (idx: number, key: keyof RoofAreaFactor, value: any) => {
    setLocal((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const toggleArrayItem = (idx: number, key: "topologias_permitidas" | "tipos_sistema_permitidos", item: string) => {
    setLocal((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const current = f[key] || [];
        const next = current.includes(item) ? current.filter((v) => v !== item) : [...current, item];
        return { ...f, [key]: next };
      })
    );
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!slug || local.some((f) => f.tipo_telhado === slug)) return;
    const newIdx = local.length;
    setLocal((prev) => [
      ...prev,
      {
        tipo_telhado: slug,
        label: name,
        fator_area: 1.20,
        inclinacao_padrao: 10,
        desvio_azimutal_padrao: 0,
        topologias_permitidas: ["tradicional", "microinversor", "otimizador"],
        tipos_sistema_permitidos: ["on_grid", "hibrido"],
        enabled: true,
      },
    ]);
    setNewName("");
    setExpandedIdx(newIdx);
  };

  const remove = (idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
    if (editingIdx === idx) setEditingIdx(null);
  };

  const startEditing = (idx: number) => {
    setEditingIdx(idx);
    setEditLabel(getRoofLabel(local[idx]));
  };

  const confirmEdit = () => {
    if (editingIdx !== null && editLabel.trim()) {
      updateFactor(editingIdx, "label", editLabel.trim());
    }
    setEditingIdx(null);
    setEditLabel("");
  };

  const activeCount = local.filter(f => f.enabled).length;

  return (
    <div className="space-y-5">
      {/* Header card */}
      <Card>
        <div className="px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-secondary/10">
              <LayoutGrid className="h-4 w-4 text-secondary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Tipos de Telhado</p>
              <p className="text-[11px] text-muted-foreground">
                {local.length} tipos configurados · {activeCount} ativos
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Grid of roof type cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {local.map((f, idx) => (
          <RoofCard
            key={f.tipo_telhado}
            factor={f}
            idx={idx}
            isExpanded={expandedIdx === idx}
            isEditing={editingIdx === idx}
            editLabel={editLabel}
            onEditLabel={setEditLabel}
            onStartEdit={() => startEditing(idx)}
            onConfirmEdit={confirmEdit}
            onCancelEdit={() => { setEditingIdx(null); setEditLabel(""); }}
            onToggleExpand={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            onUpdate={updateFactor}
            onToggleArray={toggleArrayItem}
            onRemove={() => remove(idx)}
          />
        ))}

        {/* Add new card */}
        <Card className="border-dashed border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors">
          <CardContent className="p-4 flex flex-col items-center justify-center gap-3 min-h-[120px]">
            <div className="flex items-center gap-2 w-full">
              <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Nome do novo tipo"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNew()}
                className="flex-1 h-8 text-xs border-border/50 bg-background"
              />
            </div>
            <Button variant="outline" size="sm" onClick={addNew} disabled={!newName.trim()} className="h-8 text-xs w-full">
              Adicionar
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => onSave(local)} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Todos
        </Button>
      </div>
    </div>
  );
}

/* ─── Roof Card Component ─── */

interface RoofCardProps {
  factor: RoofAreaFactor;
  idx: number;
  isExpanded: boolean;
  isEditing: boolean;
  editLabel: string;
  onEditLabel: (v: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onToggleExpand: () => void;
  onUpdate: (idx: number, key: keyof RoofAreaFactor, value: any) => void;
  onToggleArray: (idx: number, key: "topologias_permitidas" | "tipos_sistema_permitidos", item: string) => void;
  onRemove: () => void;
}

function RoofCard({
  factor: f, idx, isExpanded, isEditing, editLabel,
  onEditLabel, onStartEdit, onConfirmEdit, onCancelEdit,
  onToggleExpand, onUpdate, onToggleArray, onRemove,
}: RoofCardProps) {
  const topCount = (f.topologias_permitidas || []).length;
  const sysCount = (f.tipos_sistema_permitidos || []).length;

  return (
    <Card className={cn(
      "transition-all",
      !f.enabled && "opacity-50 border-dashed",
    )}>
      <Collapsible open={isExpanded} onOpenChange={() => onToggleExpand()}>
        {/* Card header */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/30 transition-colors rounded-t-lg"
          >
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={f.enabled}
                onCheckedChange={(v) => onUpdate(idx, "enabled", v)}
                className="scale-85"
              />
            </div>

            <span className="text-sm font-medium text-foreground truncate flex-1">
              {getRoofLabel(f)}
            </span>

            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground/60 transition-transform duration-200 shrink-0",
              isExpanded && "rotate-180"
            )} />
          </button>
        </CollapsibleTrigger>

        {/* Summary chips when collapsed */}
        {!isExpanded && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              Área {f.fator_area}x
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {f.inclinacao_padrao ?? 0}°
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {topCount} topol.
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
              {sysCount} sist.
            </span>
          </div>
        )}

        {/* Expanded content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1 space-y-4 border-t border-border/30">
            {/* Name editing */}
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <Input
                    value={editLabel}
                    onChange={(e) => onEditLabel(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") onConfirmEdit(); if (e.key === "Escape") onCancelEdit(); }}
                    className="h-8 text-sm font-medium max-w-[200px]"
                    autoFocus
                  />
                  <Button variant="default" size="sm" className="h-7 text-xs" onClick={onConfirmEdit}>OK</Button>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onCancelEdit}>Cancelar</Button>
                </>
              ) : (
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5 text-muted-foreground" onClick={onStartEdit}>
                  <Pencil className="h-3 w-3" />
                  Renomear
                </Button>
              )}
            </div>

            {/* Numeric fields */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">Fator Área</Label>
                <div className="relative mt-0.5">
                  <Input
                    type="number"
                    step="0.01"
                    value={f.fator_area}
                    onChange={(e) => onUpdate(idx, "fator_area", Number(e.target.value))}
                    className="h-8 text-xs pr-6"
                  />
                  <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground pointer-events-none">x</span>
                </div>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Inclinação</Label>
                <select
                  value={f.inclinacao_padrao ?? 0}
                  onChange={(e) => onUpdate(idx, "inclinacao_padrao", Number(e.target.value))}
                  className="mt-0.5 flex h-8 w-full rounded-md border border-input bg-background px-2 text-xs ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {INCLINACOES.map((v) => (
                    <option key={v} value={v}>{v}°</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Desvio Azim.</Label>
                <Input
                  type="number"
                  step="1"
                  value={f.desvio_azimutal_padrao ?? 0}
                  onChange={(e) => onUpdate(idx, "desvio_azimutal_padrao", Number(e.target.value))}
                  className="mt-0.5 h-8 text-xs"
                />
              </div>
            </div>

            {/* Topologias */}
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1.5 block">Topologias</Label>
              <div className="flex flex-wrap gap-1.5">
                {TOPOLOGIA_OPTIONS.map((opt) => {
                  const active = (f.topologias_permitidas || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggleArray(idx, "topologias_permitidas", opt.value)}
                      className={cn(
                        "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors select-none",
                        active
                          ? "border-foreground/20 bg-foreground/5 text-foreground"
                          : "border-border/40 text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-border/60"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tipos de Sistema */}
            <div>
              <Label className="text-[10px] text-muted-foreground mb-1.5 block">Tipos de Sistema</Label>
              <div className="flex flex-wrap gap-1.5">
                {TIPO_SISTEMA_OPTIONS.map((opt) => {
                  const active = (f.tipos_sistema_permitidos || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => onToggleArray(idx, "tipos_sistema_permitidos", opt.value)}
                      className={cn(
                        "text-[11px] font-medium px-2.5 py-1 rounded-md border transition-colors select-none",
                        active
                          ? "border-foreground/20 bg-foreground/5 text-foreground"
                          : "border-border/40 text-muted-foreground/40 hover:text-muted-foreground/60 hover:border-border/60"
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Remove */}
            <div className="flex justify-end pt-1">
              <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive gap-1" onClick={onRemove}>
                <Trash2 className="h-3 w-3" />
                Remover
              </Button>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
