import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Save, Loader2, Plus, Trash2, LayoutGrid, Pencil, Check, ChevronDown, ChevronUp } from "lucide-react";
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
  };

  const remove = (idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
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
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Dados Técnicos do Telhado</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Configure área útil, inclinação, desvio azimutal, topologias e tipos de sistema permitidos por tipo de telhado.
        </p>

        <div className="space-y-2">
          {local.map((f, idx) => {
            const isExpanded = expandedIdx === idx;
            return (
              <div key={f.tipo_telhado} className="rounded-lg border border-border/50 bg-background overflow-hidden">
                {/* Header row */}
                <div className="flex items-center gap-3 p-3">
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(v) => updateFactor(idx, "enabled", v)}
                  />
                  {editingIdx === idx ? (
                    <div className="flex items-center gap-1 min-w-[100px]">
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && confirmEdit()}
                        className="h-7 text-sm"
                        autoFocus
                      />
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={confirmEdit}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 min-w-[100px]">
                      <Label className="text-sm font-medium">{getRoofLabel(f)}</Label>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEditing(idx)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}

                  {/* Quick summary badges */}
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                    <Badge variant="outline" className="text-[10px] shrink-0">{f.fator_area}x área</Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">{f.inclinacao_padrao ?? 0}°</Badge>
                    <Badge variant="outline" className="text-[10px] shrink-0">{(f.topologias_permitidas || []).length} topol.</Badge>
                  </div>

                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive shrink-0" onClick={() => remove(idx)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 border-t border-border/30 space-y-4">
                    {/* Row 1: Área + Inclinação + Desvio */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Fator de Área Útil</Label>
                        <div className="relative mt-1">
                          <Input
                            type="number"
                            step="0.01"
                            value={f.fator_area}
                            onChange={(e) => updateFactor(idx, "fator_area", Number(e.target.value))}
                            className="pr-28"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">m²/m² módulos</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Inclinação Padrão</Label>
                        <select
                          value={f.inclinacao_padrao ?? 0}
                          onChange={(e) => updateFactor(idx, "inclinacao_padrao", Number(e.target.value))}
                          className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {INCLINACOES.map((v) => (
                            <option key={v} value={v}>{v}°</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Desvio Azimutal Padrão</Label>
                        <Input
                          type="number"
                          step="1"
                          value={f.desvio_azimutal_padrao ?? 0}
                          onChange={(e) => updateFactor(idx, "desvio_azimutal_padrao", Number(e.target.value))}
                          className="mt-1"
                        />
                      </div>
                    </div>

                    {/* Row 2: Topologias */}
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-2 block">Topologias Permitidas</Label>
                      <div className="flex flex-wrap gap-2">
                        {TOPOLOGIA_OPTIONS.map((opt) => {
                          const active = (f.topologias_permitidas || []).includes(opt.value);
                          return (
                            <Badge
                              key={opt.value}
                              variant={active ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer select-none transition-colors text-xs",
                                active && "bg-primary text-primary-foreground hover:bg-primary/90",
                                !active && "hover:bg-muted"
                              )}
                              onClick={() => toggleArrayItem(idx, "topologias_permitidas", opt.value)}
                            >
                              {opt.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>

                    {/* Row 3: Tipos de Sistema */}
                    <div>
                      <Label className="text-[11px] text-muted-foreground mb-2 block">Tipos de Sistema Permitidos</Label>
                      <div className="flex flex-wrap gap-2">
                        {TIPO_SISTEMA_OPTIONS.map((opt) => {
                          const active = (f.tipos_sistema_permitidos || []).includes(opt.value);
                          return (
                            <Badge
                              key={opt.value}
                              variant={active ? "default" : "outline"}
                              className={cn(
                                "cursor-pointer select-none transition-colors text-xs",
                                active && "bg-secondary text-secondary-foreground hover:bg-secondary/90",
                                !active && "hover:bg-muted"
                              )}
                              onClick={() => toggleArrayItem(idx, "tipos_sistema_permitidos", opt.value)}
                            >
                              {opt.label}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add new */}
        <div className="flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-background p-3">
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
          Salvar
        </Button>
      </div>
    </div>
  );
}
