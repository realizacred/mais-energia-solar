import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2, Plus, Trash2, LayoutGrid } from "lucide-react";
import type { RoofAreaFactor } from "@/hooks/useTenantPremises";

const ROOF_LABELS: Record<string, string> = {
  carport: "Carport",
  ceramico: "Cerâmico",
  fibrocimento: "Fibrocimento",
  laje: "Laje",
  shingle: "Shingle",
  metalico: "Metálico",
  zipado: "Zipado",
  solo: "Solo",
};

interface Props {
  roofFactors: RoofAreaFactor[];
  onSave: (factors: RoofAreaFactor[]) => void;
  saving: boolean;
}

export function TabAreaTelhado({ roofFactors, onSave, saving }: Props) {
  const [local, setLocal] = useState<RoofAreaFactor[]>(() => [...roofFactors]);
  const [newName, setNewName] = useState("");

  const updateFactor = (idx: number, key: keyof RoofAreaFactor, value: any) => {
    setLocal((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const addNew = () => {
    const slug = newName.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    if (!slug || local.some((f) => f.tipo_telhado === slug)) return;
    setLocal((prev) => [...prev, { tipo_telhado: slug, fator_area: 1.20, enabled: true }]);
    setNewName("");
  };

  const remove = (idx: number) => {
    setLocal((prev) => prev.filter((_, i) => i !== idx));
  };

  const isBuiltIn = (tipo: string) => tipo in ROOF_LABELS;

  return (
    <div className="space-y-6">
      {/* Tipos de telhado */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4 text-primary" />
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Tipos de telhado</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Apenas os tipos habilitados aparecerão como opções no dimensionamento.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {local.map((f, idx) => (
            <div key={f.tipo_telhado} className="flex items-center gap-3 rounded-lg border border-border/50 bg-background p-3">
              <Switch
                checked={f.enabled}
                onCheckedChange={(v) => updateFactor(idx, "enabled", v)}
              />
              <Label className="text-sm font-medium min-w-[100px]">
                {ROOF_LABELS[f.tipo_telhado] || f.tipo_telhado}
              </Label>
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
              {!isBuiltIn(f.tipo_telhado) && (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => remove(idx)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
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
