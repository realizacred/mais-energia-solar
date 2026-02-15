import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Save, Loader2 } from "lucide-react";
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

  const updateFactor = (idx: number, key: keyof RoofAreaFactor, value: any) => {
    setLocal((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <p className="text-sm text-muted-foreground">
          Apenas os tipos de telhados com os valores informados irão aparecer como opções no dimensionamento.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {local.map((f, idx) => (
            <div key={f.tipo_telhado} className="flex items-center gap-3 rounded-lg border border-border/50 p-3">
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
            </div>
          ))}
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={() => onSave(local)} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
