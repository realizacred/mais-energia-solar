import { useState, useEffect } from "react";
import { Settings2, RotateCcw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { type PremissasData } from "./types";

interface Props {
  premissas: PremissasData;
  onPremissasChange: (p: PremissasData) => void;
}

export function StepPremissas({ premissas, onPremissasChange }: Props) {
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  // Load tenant defaults on mount (once)
  useEffect(() => {
    if (hasLoaded) return;
    loadTenantDefaults();
  }, []);

  const loadTenantDefaults = async () => {
    setLoadingDefaults(true);
    try {
      const { data } = await supabase
        .from("premissas_default_tenant" as any)
        .select("inflacao_energetica, inflacao_ipca, taxa_desconto_vpl, perda_eficiencia_anual, sobredimensionamento, troca_inversor_ano, troca_inversor_custo_percentual, fator_simultaneidade, vida_util_sistema")
        .limit(1)
        .maybeSingle();

      if (data) {
        const d = data as any;
        onPremissasChange({
          ...premissas,
          inflacao_energetica: d.inflacao_energetica ?? premissas.inflacao_energetica,
          inflacao_ipca: d.inflacao_ipca ?? premissas.inflacao_ipca,
          perda_eficiencia_anual: d.perda_eficiencia_anual ?? premissas.perda_eficiencia_anual,
          sobredimensionamento: d.sobredimensionamento ?? premissas.sobredimensionamento,
          troca_inversor_anos: d.troca_inversor_ano ?? premissas.troca_inversor_anos,
          troca_inversor_custo: d.troca_inversor_custo_percentual ?? premissas.troca_inversor_custo,
          vpl_taxa_desconto: d.taxa_desconto_vpl ?? premissas.vpl_taxa_desconto,
        });
      }
    } catch (e) {
      console.warn("Falha ao carregar premissas default:", e);
    } finally {
      setLoadingDefaults(false);
      setHasLoaded(true);
    }
  };

  const update = (field: keyof PremissasData, value: number) => {
    onPremissasChange({ ...premissas, [field]: value });
  };

  const fields: { key: keyof PremissasData; label: string; unit: string; step?: number }[] = [
    { key: "imposto", label: "Imposto", unit: "%", step: 0.1 },
    { key: "inflacao_energetica", label: "Inflação Energética", unit: "%", step: 0.1 },
    { key: "inflacao_ipca", label: "Inflação IPCA", unit: "%", step: 0.1 },
    { key: "perda_eficiencia_anual", label: "Perda de Eficiência Anual", unit: "%", step: 0.01 },
    { key: "sobredimensionamento", label: "Sobredimensionamento", unit: "%", step: 1 },
    { key: "troca_inversor_anos", label: "Troca de Inversor", unit: "anos", step: 1 },
    { key: "troca_inversor_custo", label: "Custo Troca Inversor", unit: "%", step: 1 },
    { key: "vpl_taxa_desconto", label: "VPL - Taxa de Desconto", unit: "%", step: 0.1 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Premissas de Cálculo
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={loadTenantDefaults}
          disabled={loadingDefaults}
        >
          {loadingDefaults ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
          Restaurar padrões
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        Configure as premissas técnicas e financeiras para o dimensionamento e cálculo de retorno.
        Os valores padrão são carregados das configurações do tenant.
      </p>

      <div className="rounded-xl border border-border/50 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {fields.map(f => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs">{f.label}</Label>
              <div className="relative">
                <Input
                  type="number"
                  step={f.step || 1}
                  value={premissas[f.key] || ""}
                  onChange={e => update(f.key, Number(e.target.value))}
                  className="h-9 pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  {f.unit}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 border border-border/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>• <strong>Inflação energética</strong>: reajuste anual estimado da tarifa de energia.</p>
        <p>• <strong>Perda de eficiência</strong>: degradação anual dos módulos fotovoltaicos (~0.5%).</p>
        <p>• <strong>Sobredimensionamento</strong>: margem extra sobre a potência calculada.</p>
        <p>• <strong>VPL</strong>: taxa de desconto para cálculo do Valor Presente Líquido.</p>
      </div>
    </div>
  );
}
