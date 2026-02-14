import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign } from "lucide-react";

interface PricingRow {
  id: string;
  markup_equipamentos_percent: number;
  markup_servicos_percent: number;
  margem_minima_percent: number;
  comissao_padrao_percent: number;
  comissao_gerente_percent: number;
  preco_kwp_minimo: number | null;
  preco_kwp_maximo: number | null;
  preco_kwp_sugerido: number | null;
  desconto_maximo_percent: number;
  requer_aprovacao_desconto: boolean;
}

const SELECT_COLS = "id, markup_equipamentos_percent, markup_servicos_percent, margem_minima_percent, comissao_padrao_percent, comissao_gerente_percent, preco_kwp_minimo, preco_kwp_maximo, preco_kwp_sugerido, desconto_maximo_percent, requer_aprovacao_desconto";

export function PrecificacaoTab() {
  const [data, setData] = useState<PricingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data: row, error } = await supabase
      .from("pricing_config")
      .select(SELECT_COLS)
      .limit(1)
      .maybeSingle();
    if (error) toast({ title: "Erro ao carregar precificação", description: error.message, variant: "destructive" });
    setData(row as unknown as PricingRow | null);
    setLoading(false);
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabase.from("pricing_config").update(payload as any).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Precificação atualizada" });
    } else {
      const { data: ins, error } = await supabase.from("pricing_config").insert(payload as any).select("id").single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { setData({ ...data, id: (ins as any).id }); toast({ title: "Precificação criada" }); }
    }
    setSaving(false);
  }

  function handleChange(key: keyof Omit<PricingRow, "id">, value: string | number | boolean) {
    const defaults: PricingRow = {
      id: "", markup_equipamentos_percent: 30, markup_servicos_percent: 20,
      margem_minima_percent: 15, comissao_padrao_percent: 5, comissao_gerente_percent: 2,
      preco_kwp_minimo: null, preco_kwp_maximo: null, preco_kwp_sugerido: null,
      desconto_maximo_percent: 10, requer_aprovacao_desconto: true,
    };
    const current = data || defaults;
    setData({ ...current, [key]: value });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const NUMERIC_FIELDS: { key: keyof Omit<PricingRow, "id" | "requer_aprovacao_desconto">; label: string; suffix: string }[] = [
    { key: "markup_equipamentos_percent", label: "Markup equipamentos", suffix: "%" },
    { key: "markup_servicos_percent", label: "Markup serviços", suffix: "%" },
    { key: "margem_minima_percent", label: "Margem mínima", suffix: "%" },
    { key: "comissao_padrao_percent", label: "Comissão padrão", suffix: "%" },
    { key: "comissao_gerente_percent", label: "Comissão gerente", suffix: "%" },
    { key: "desconto_maximo_percent", label: "Desconto máximo", suffix: "%" },
    { key: "preco_kwp_minimo", label: "Preço kWp mínimo", suffix: "R$/kWp" },
    { key: "preco_kwp_maximo", label: "Preço kWp máximo", suffix: "R$/kWp" },
    { key: "preco_kwp_sugerido", label: "Preço kWp sugerido", suffix: "R$/kWp" },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          Regras de Precificação
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {NUMERIC_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
              <div className="relative">
                <Input
                  type="number" step="0.1"
                  value={data?.[f.key] ?? ""}
                  onChange={(e) => handleChange(f.key, parseFloat(e.target.value) || 0)}
                  className="pr-14 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{f.suffix}</span>
              </div>
            </div>
          ))}
          <div className="space-y-1.5 flex items-end gap-3 pb-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={data?.requer_aprovacao_desconto ?? true}
                onCheckedChange={(v) => handleChange("requer_aprovacao_desconto", v)}
              />
              <Label className="text-xs text-muted-foreground">Requer aprovação p/ desconto</Label>
            </div>
          </div>
        </div>
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Precificação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
