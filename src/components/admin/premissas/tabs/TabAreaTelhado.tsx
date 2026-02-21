import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Plus, Trash2, LayoutGrid } from "lucide-react";
import type { RoofAreaFactor } from "@/hooks/useTenantPremises";
import { getRoofLabel, TOPOLOGIA_OPTIONS, TIPO_SISTEMA_OPTIONS } from "@/hooks/useTenantPremises";
import { cn } from "@/lib/utils";

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
    setEditingIdx(local.length); // auto-edit new item
    setEditLabel(name);
  };

  const remove = (idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
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

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-5 space-y-4" style={{ boxShadow: "var(--shadow-sm)" }}>
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-secondary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-foreground">Dados Técnicos do Telhado</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure área útil, inclinação, desvio azimutal, topologias e tipos de sistema permitidos por tipo de telhado.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {local.map((f, idx) => (
            <RoofCard
              key={f.tipo_telhado}
              factor={f}
              idx={idx}
              isEditing={editingIdx === idx}
              editLabel={editLabel}
              onEditLabel={setEditLabel}
              onStartEdit={() => startEditing(idx)}
              onConfirmEdit={confirmEdit}
              onCancelEdit={() => { setEditingIdx(null); setEditLabel(""); }}
              onUpdate={updateFactor}
              onToggleArray={toggleArrayItem}
              onRemove={() => remove(idx)}
            />
          ))}
        </div>

        {/* Add new */}
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-background p-3">
          <Plus className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome do novo tipo de telhado"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addNew()}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={addNew} disabled={!newName.trim()}>
            Adicionar
          </Button>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => onSave(local)} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Todos
        </Button>
      </div>
    </div>
  );
}

/* ─── Card por tipo de telhado ─── */

interface RoofCardProps {
  factor: RoofAreaFactor;
  idx: number;
  isEditing: boolean;
  editLabel: string;
  onEditLabel: (v: string) => void;
  onStartEdit: () => void;
  onConfirmEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (idx: number, key: keyof RoofAreaFactor, value: any) => void;
  onToggleArray: (idx: number, key: "topologias_permitidas" | "tipos_sistema_permitidos", item: string) => void;
  onRemove: () => void;
}

function RoofCard({
  factor: f, idx, isEditing, editLabel,
  onEditLabel, onStartEdit, onConfirmEdit, onCancelEdit,
  onUpdate, onToggleArray, onRemove,
}: RoofCardProps) {
  return (
    <div className={cn(
      "rounded-lg border bg-card p-4 space-y-3 transition-shadow",
      f.enabled ? "border-border shadow-sm" : "border-border/40 opacity-60"
    )}>
      {/* Header: nome + switch */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Switch
            checked={f.enabled}
            onCheckedChange={(v) => onUpdate(idx, "enabled", v)}
          />
          {isEditing ? (
            <Input
              value={editLabel}
              onChange={(e) => onEditLabel(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onConfirmEdit()}
              className="h-8 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <span className="text-sm font-semibold truncate">{getRoofLabel(f)}</span>
          )}
        </div>
      </div>

      {/* Campos numéricos */}
      <div className="grid grid-cols-3 gap-2">
        <div>
          <Label className="text-[10px] text-muted-foreground">Área Útil</Label>
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
        <Label className="text-[10px] text-muted-foreground mb-1 block">Topologias</Label>
        <div className="flex flex-wrap gap-1">
          {TOPOLOGIA_OPTIONS.map((opt) => {
            const active = (f.topologias_permitidas || []).includes(opt.value);
            return (
              <Badge
                key={opt.value}
                variant="outline"
                className={cn(
                  "cursor-pointer select-none transition-colors text-[10px] px-2 py-0.5 font-normal",
                  active && "bg-muted border-foreground/30 text-foreground",
                  !active && "border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => onToggleArray(idx, "topologias_permitidas", opt.value)}
              >
                {opt.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Tipos de Sistema */}
      <div>
        <Label className="text-[10px] text-muted-foreground mb-1 block">Sistemas</Label>
        <div className="flex flex-wrap gap-1">
          {TIPO_SISTEMA_OPTIONS.map((opt) => {
            const active = (f.tipos_sistema_permitidos || []).includes(opt.value);
            return (
              <Badge
                key={opt.value}
                variant="outline"
                className={cn(
                  "cursor-pointer select-none transition-colors text-[10px] px-2 py-0.5 font-normal",
                  active && "bg-muted border-foreground/30 text-foreground",
                  !active && "border-border/50 text-muted-foreground hover:bg-muted/50"
                )}
                onClick={() => onToggleArray(idx, "tipos_sistema_permitidos", opt.value)}
              >
                {opt.label}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Botões de ação com texto */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/30">
        {isEditing ? (
          <>
            <Button variant="default" size="sm" className="text-xs h-7" onClick={onConfirmEdit}>
              Salvar
            </Button>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onCancelEdit}>
              Cancelar
            </Button>
          </>
        ) : (
          <Button variant="outline" size="sm" className="text-xs h-7" onClick={onStartEdit}>
            Editar Nome
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={onRemove}>
          <Trash2 className="h-3 w-3 mr-1" />
          Remover
        </Button>
      </div>
    </div>
  );
}
