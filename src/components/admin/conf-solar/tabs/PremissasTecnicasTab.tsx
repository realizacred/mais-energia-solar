import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Settings2 } from "lucide-react";

interface PremissasRow {
  id: string;
  irradiacao_media_kwh_m2: number;
  performance_ratio: number;
  degradacao_anual_percent: number;
  vida_util_anos: number;
  fator_perdas_percent: number;
  horas_sol_pico: number;
  reajuste_tarifa_anual_percent: number;
  taxa_selic_anual: number;
  ipca_anual: number;
  custo_disponibilidade_mono: number;
  custo_disponibilidade_bi: number;
  custo_disponibilidade_tri: number;
  taxas_fixas_mensais: number;
}

const FIELDS: { key: keyof Omit<PremissasRow, "id">; label: string; suffix: string; step?: string }[] = [
  { key: "irradiacao_media_kwh_m2", label: "Irradiação média", suffix: "kWh/m²/dia", step: "0.01" },
  { key: "performance_ratio", label: "Performance Ratio (PR)", suffix: "", step: "0.01" },
  { key: "degradacao_anual_percent", label: "Degradação anual", suffix: "%/ano", step: "0.01" },
  { key: "vida_util_anos", label: "Vida útil do sistema", suffix: "anos", step: "1" },
  { key: "fator_perdas_percent", label: "Fator de perdas", suffix: "%", step: "0.1" },
  { key: "horas_sol_pico", label: "Horas sol pico (HSP)", suffix: "h/dia", step: "0.1" },
  { key: "reajuste_tarifa_anual_percent", label: "Reajuste tarifário", suffix: "%/ano", step: "0.1" },
  { key: "taxa_selic_anual", label: "Taxa Selic anual", suffix: "%", step: "0.01" },
  { key: "ipca_anual", label: "IPCA anual", suffix: "%", step: "0.1" },
  { key: "custo_disponibilidade_mono", label: "Custo disp. (Mono)", suffix: "kWh", step: "1" },
  { key: "custo_disponibilidade_bi", label: "Custo disp. (Bi)", suffix: "kWh", step: "1" },
  { key: "custo_disponibilidade_tri", label: "Custo disp. (Tri)", suffix: "kWh", step: "1" },
  { key: "taxas_fixas_mensais", label: "Taxas fixas mensais", suffix: "R$", step: "0.01" },
];

const SELECT_COLS = "id, irradiacao_media_kwh_m2, performance_ratio, degradacao_anual_percent, vida_util_anos, fator_perdas_percent, horas_sol_pico, reajuste_tarifa_anual_percent, taxa_selic_anual, ipca_anual, custo_disponibilidade_mono, custo_disponibilidade_bi, custo_disponibilidade_tri, taxas_fixas_mensais";

export function PremissasTecnicasTab() {
  const [data, setData] = useState<PremissasRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: row, error } = await supabase
      .from("premissas_tecnicas")
      .select(SELECT_COLS)
      .limit(1)
      .maybeSingle();
    if (error) toast({ title: "Erro ao carregar premissas", description: error.message, variant: "destructive" });
    setData(row as unknown as PremissasRow | null);
    setLoading(false);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabase.from("premissas_tecnicas").update(payload as any).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Premissas atualizadas" });
    } else {
      const { data: ins, error } = await supabase.from("premissas_tecnicas").insert(payload as any).select("id").single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { setData({ ...data, id: (ins as any).id }); toast({ title: "Premissas criadas" }); }
    }
    setSaving(false);
  }

  function handleChange(key: keyof Omit<PremissasRow, "id">, value: string) {
    const defaults: PremissasRow = {
      id: "", irradiacao_media_kwh_m2: 4.5, performance_ratio: 0.82,
      degradacao_anual_percent: 0.7, vida_util_anos: 25, fator_perdas_percent: 15,
      horas_sol_pico: 4.5, reajuste_tarifa_anual_percent: 6, taxa_selic_anual: 11.25,
      ipca_anual: 4.5, custo_disponibilidade_mono: 100, custo_disponibilidade_bi: 160,
      custo_disponibilidade_tri: 200, taxas_fixas_mensais: 0,
    };
    const current = data || defaults;
    setData({ ...current, [key]: parseFloat(value) || 0 });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" />
          Premissas Técnicas & Financeiras
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
              <div className="relative">
                <Input
                  type="number" step={f.step || "0.01"}
                  value={data?.[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  className="pr-16 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">{f.suffix}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Premissas
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
