import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Plus, Trash2, LayoutGrid, Pencil, Check } from "lucide-react";
import type { RoofAreaFactor } from "@/hooks/useTenantPremises";
import { getRoofLabel } from "@/hooks/useTenantPremises";

interface Props {
  roofFactors: RoofAreaFactor[];
  onSave: (factors: RoofAreaFactor[]) => void;
  saving: boolean;
}

export function TabAreaTelhado({ roofFactors, onSave, saving }: Props) {
  const [local, setLocal] = useState<RoofAreaFactor[]>(() => [...roofFactors]);
  const [newName, setNewName] = useState("");
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const updateFactor = (idx: number, key: keyof RoofAreaFactor, value: any) => {
    setLocal((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!slug || local.some((f) => f.tipo_telhado === slug)) return;
    setLocal((prev) => [...prev, { tipo_telhado: slug, label: name, fator_area: 1.20, enabled: true }]);
    setNewName("");
  };

  const remove = (idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
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
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tipos de telhado</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Apenas os tipos habilitados aparecerão como opções no dimensionamento, cadastro de leads e propostas.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {local.map((f, idx) => (
            <div key={f.tipo_telhado} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3">
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
                  <Label className="text-sm font-medium">
                    {getRoofLabel(f)}
                  </Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => startEditing(idx)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
              <div className="relative flex-1">
                <Input
                  type="number"
                  step="0.01"
                  value={f.fator_area}
                  onChange={(e) => updateFactor(idx, "fator_area", Number(e.target.value))}
                  className="pr-32"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium pointer-events-none whitespace-nowrap">
                  m² / m² de módulos
                </span>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
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
