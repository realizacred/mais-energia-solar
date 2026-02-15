import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui-kit/StatusBadge";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, DollarSign, Lock, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingMethod {
  id: string;
  method_type: "margin_on_sale" | "margin_on_cost";
  default_margin_percent: number;
  default_tax_percent: number;
  kit_margin_override_percent: number | null;
  kit_tax_override_percent: number | null;
}

interface Props {
  versionId: string;
  isReadOnly: boolean;
}

export function PricingMethodTab({ versionId, isReadOnly }: Props) {
  const [data, setData] = useState<PricingMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadMethod = useCallback(async () => {
    setLoading(true);
    const { data: row, error } = await supabase
      .from("pricing_methods")
      .select("id, method_type, default_margin_percent, default_tax_percent, kit_margin_override_percent, kit_tax_override_percent")
      .eq("version_id", versionId)
      .maybeSingle();

    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setData(row as unknown as PricingMethod | null);
    setLoading(false);
  }, [versionId]);

  useEffect(() => { loadMethod(); }, [loadMethod]);

  function initializeData(methodType: "margin_on_sale" | "margin_on_cost") {
    setData({
      id: "",
      method_type: methodType,
      default_margin_percent: 25,
      default_tax_percent: 0,
      kit_margin_override_percent: null,
      kit_tax_override_percent: null,
    });
  }

  async function handleSave() {
    if (!data) return;
    setSaving(true);

    const payload = {
      version_id: versionId,
      method_type: data.method_type,
      default_margin_percent: data.default_margin_percent,
      default_tax_percent: data.default_tax_percent,
      kit_margin_override_percent: data.kit_margin_override_percent,
      kit_tax_override_percent: data.kit_tax_override_percent,
    };

    if (data.id) {
      const { error } = await supabase.from("pricing_methods").update(payload as any).eq("id", data.id);
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else toast({ title: "Método atualizado" });
    } else {
      const { data: ins, error } = await supabase.from("pricing_methods").insert(payload as any).select("id").single();
      if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
      else {
        setData((prev) => prev ? { ...prev, id: (ins as any).id } : null);
        toast({ title: "Método configurado" });
      }
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!data) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <DollarSign className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Selecione o método de precificação para esta versão.</p>
            <div className="flex justify-center gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 px-6 flex-col gap-2 min-w-[180px]"
                onClick={() => initializeData("margin_on_cost")}
                disabled={isReadOnly}
              >
                <span className="text-sm font-semibold">Margem sobre Custo</span>
                <span className="text-xs text-muted-foreground">Preço = Custo × (1 + Margem)</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 px-6 flex-col gap-2 min-w-[180px]"
                onClick={() => initializeData("margin_on_sale")}
                disabled={isReadOnly}
              >
                <span className="text-sm font-semibold">Margem sobre Venda</span>
                <span className="text-xs text-muted-foreground">Preço = Custo / (1 - Margem)</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Método de Precificação</h3>
        </div>
        {isReadOnly && (
          <StatusBadge variant="muted" dot>
            <Lock className="h-3 w-3" /> Somente leitura
          </StatusBadge>
        )}
      </div>

      {/* Method type selector */}
      <Card className="border-border/60">
        <CardContent className="pt-4">
          <div className="flex gap-3 mb-6">
            {(["margin_on_cost", "margin_on_sale"] as const).map((type) => {
              const isSelected = data.method_type === type;
              return (
                <button
                  key={type}
                  disabled={isReadOnly}
                  onClick={() => setData((prev) => prev ? { ...prev, method_type: type } : null)}
                  className={cn(
                    "flex-1 rounded-xl border-2 p-4 text-left transition-all",
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80",
                    isReadOnly && "cursor-not-allowed opacity-60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowRightLeft className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                      {type === "margin_on_cost" ? "Margem sobre Custo" : "Margem sobre Venda"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {type === "margin_on_cost"
                      ? "Preço = Custo × (1 + Margem%)"
                      : "Preço = Custo / (1 - Margem%)"}
                  </p>
                </button>
              );
            })}
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Margem padrão</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={data.default_margin_percent}
                  onChange={(e) => setData((prev) => prev ? { ...prev, default_margin_percent: parseFloat(e.target.value) || 0 } : null)}
                  disabled={isReadOnly}
                  className="pr-8 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Impostos padrão</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={data.default_tax_percent}
                  onChange={(e) => setData((prev) => prev ? { ...prev, default_tax_percent: parseFloat(e.target.value) || 0 } : null)}
                  disabled={isReadOnly}
                  className="pr-8 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Kit: margem override</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={data.kit_margin_override_percent ?? ""}
                  onChange={(e) => setData((prev) => prev ? { ...prev, kit_margin_override_percent: e.target.value ? parseFloat(e.target.value) : null } : null)}
                  disabled={isReadOnly}
                  placeholder="—"
                  className="pr-8 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">Kit: impostos override</Label>
              <div className="relative">
                <Input
                  type="number"
                  step="0.1"
                  value={data.kit_tax_override_percent ?? ""}
                  onChange={(e) => setData((prev) => prev ? { ...prev, kit_tax_override_percent: e.target.value ? parseFloat(e.target.value) : null } : null)}
                  disabled={isReadOnly}
                  placeholder="—"
                  className="pr-8 text-sm"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
            </div>
          </div>

          {!isReadOnly && (
            <div className="flex justify-end mt-6">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar Método
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Formula explanation */}
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="pt-4 pb-4">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Este módulo define apenas as regras. O cálculo real será executado pelo Pricing Engine (backend).
            A fórmula{" "}
            {data.method_type === "margin_on_cost"
              ? <code className="bg-muted px-1 rounded text-[10px]">Preço = Custo × (1 + {data.default_margin_percent}%)</code>
              : <code className="bg-muted px-1 rounded text-[10px]">Preço = Custo / (1 - {data.default_margin_percent}%)</code>
            }{" "}
            será aplicada automaticamente ao gerar propostas vinculadas a esta versão da política.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
