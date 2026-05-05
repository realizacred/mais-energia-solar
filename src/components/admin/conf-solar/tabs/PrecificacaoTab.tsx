import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign, Percent, ShieldCheck, TrendingUp } from "lucide-react";
import { usePricingConfig, useRefreshPricingConfig } from "@/hooks/useConfSolar";
import { LoadingState } from "@/components/ui-kit";

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

type NumKey = keyof Omit<PricingRow, "id" | "requer_aprovacao_desconto">;

const MARKUPS: { key: NumKey; label: string; suffix: string; help?: string }[] = [
  { key: "markup_equipamentos_percent", label: "Markup equipamentos", suffix: "%", help: "Acréscimo aplicado sobre o custo de equipamentos." },
  { key: "markup_servicos_percent", label: "Markup serviços", suffix: "%", help: "Acréscimo aplicado sobre o custo de mão de obra." },
  { key: "margem_minima_percent", label: "Margem mínima", suffix: "%", help: "Margem-piso aceitável após descontos." },
];

const COMISSOES: { key: NumKey; label: string; suffix: string; help?: string }[] = [
  { key: "comissao_padrao_percent", label: "Comissão padrão", suffix: "%", help: "Comissão padrão do consultor." },
  { key: "comissao_gerente_percent", label: "Comissão gerente", suffix: "%", help: "Comissão override do gerente." },
];

const LIMITES: { key: NumKey; label: string; suffix: string; help?: string }[] = [
  { key: "desconto_maximo_percent", label: "Desconto máximo", suffix: "%", help: "Limite máximo de desconto sem aprovação." },
  { key: "preco_kwp_minimo", label: "Preço kWp mínimo", suffix: "R$/kWp" },
  { key: "preco_kwp_sugerido", label: "Preço kWp sugerido", suffix: "R$/kWp" },
  { key: "preco_kwp_maximo", label: "Preço kWp máximo", suffix: "R$/kWp" },
];

export function PrecificacaoTab() {
  const { data: serverData, isLoading: loading } = usePricingConfig();
  const refreshConfig = useRefreshPricingConfig();
  const [data, setData] = useState<PricingRow | null>(null);
  const [initial, setInitial] = useState<PricingRow | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (serverData && !data) {
      setData(serverData as unknown as PricingRow);
      setInitial(serverData as unknown as PricingRow);
    }
  }, [serverData]);

  const isDirty = !!data && !!initial && JSON.stringify(data) !== JSON.stringify(initial);

  async function handleSave() {
    if (!data) return;
    setSaving(true);
    const { id, ...payload } = data;
    if (id) {
      const { error } = await supabase.from("pricing_config").update(payload as any).eq("id", id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else { toast({ title: "Precificação atualizada" }); setInitial(data); refreshConfig(); }
    } else {
      const { data: ins, error } = await supabase.from("pricing_config").insert(payload as any).select("id").single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        const next = { ...data, id: (ins as any).id };
        setData(next); setInitial(next);
        toast({ title: "Precificação criada" }); refreshConfig();
      }
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

  if (loading) return <LoadingState context="config" />;

  const renderGroup = (fields: typeof MARKUPS) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {fields.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
          <div className="relative">
            <Input
              type="number" step="0.1"
              value={data?.[f.key] ?? ""}
              onChange={(e) => handleChange(f.key, parseFloat(e.target.value) || 0)}
              className="pr-16 text-sm"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{f.suffix}</span>
          </div>
          {f.help && <p className="text-[10px] text-muted-foreground leading-relaxed">{f.help}</p>}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header interno */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <DollarSign className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Regras de precificação</h2>
          <p className="text-sm text-muted-foreground">
            Markups, comissões e limites comerciais aplicados nas propostas.
          </p>
        </div>
      </div>

      {/* Markups */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Markups
          </CardTitle>
          <CardDescription className="text-xs">Margens aplicadas sobre custos de equipamentos e serviços.</CardDescription>
        </CardHeader>
        <CardContent>{renderGroup(MARKUPS)}</CardContent>
      </Card>

      {/* Comissões */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Percent className="h-4 w-4 text-primary" />
            Comissões
          </CardTitle>
          <CardDescription className="text-xs">Percentuais padrão de remuneração comercial.</CardDescription>
        </CardHeader>
        <CardContent>{renderGroup(COMISSOES)}</CardContent>
      </Card>

      {/* Limites comerciais */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Limites comerciais
          </CardTitle>
          <CardDescription className="text-xs">Faixas de preço por kWp e regras de aprovação de desconto.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderGroup(LIMITES)}
          <div className="flex items-center gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2.5">
            <Switch
              checked={data?.requer_aprovacao_desconto ?? true}
              onCheckedChange={(v) => handleChange("requer_aprovacao_desconto", v)}
            />
            <div>
              <Label className="text-xs font-medium">Exigir aprovação para descontos</Label>
              <p className="text-[10px] text-muted-foreground">Descontos acima do limite exigirão validação do gestor.</p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            {isDirty && !saving && (
              <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
                Alterações não salvas
              </Badge>
            )}
            <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2 min-w-[160px]">
              {saving ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
              ) : (
                <><Save className="h-4 w-4" /> Salvar precificação</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
