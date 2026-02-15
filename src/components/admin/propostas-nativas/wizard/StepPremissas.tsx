import { useState, useEffect } from "react";
import { Settings2, RotateCcw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { type PremissasData } from "./types";

interface Props {
  premissas: PremissasData;
  onPremissasChange: (p: PremissasData) => void;
}

export function StepPremissas({ premissas, onPremissasChange }: Props) {
  const [loadingDefaults, setLoadingDefaults] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [source, setSource] = useState<"manual" | "tenant">("manual");

  useEffect(() => {
    if (hasLoaded) return;
    loadTenantDefaults();
  }, []);

  const loadTenantDefaults = async () => {
    setLoadingDefaults(true);
    try {
      // Try canonical tenant_premises first
      const { data: tp } = await supabase
        .from("tenant_premises")
        .select("inflacao_energetica, vpl_taxa_desconto, imposto_energia, perda_eficiencia_tradicional, sobredimensionamento_padrao, troca_inversor_anos_tradicional, custo_troca_inversor_tradicional")
        .limit(1)
        .maybeSingle();

      if (tp) {
        const d = tp as any;
        onPremissasChange({
          ...premissas,
          inflacao_energetica: d.inflacao_energetica ?? premissas.inflacao_energetica,
          vpl_taxa_desconto: d.vpl_taxa_desconto ?? premissas.vpl_taxa_desconto,
          imposto: d.imposto_energia ?? premissas.imposto,
          perda_eficiencia_anual: d.perda_eficiencia_tradicional ?? premissas.perda_eficiencia_anual,
          sobredimensionamento: d.sobredimensionamento_padrao ?? premissas.sobredimensionamento,
          troca_inversor_anos: d.troca_inversor_anos_tradicional ?? premissas.troca_inversor_anos,
          troca_inversor_custo: d.custo_troca_inversor_tradicional ?? premissas.troca_inversor_custo,
        });
        setSource("tenant");
      } else {
        // Fallback to legacy premissas_tecnicas
        const { data } = await supabase
          .from("premissas_tecnicas")
          .select("reajuste_tarifa_anual_percent, ipca_anual, degradacao_anual_percent, taxa_selic_anual")
          .limit(1)
          .maybeSingle();

        if (data) {
          const d = data as any;
          onPremissasChange({
            ...premissas,
            inflacao_energetica: d.reajuste_tarifa_anual_percent ?? premissas.inflacao_energetica,
            inflacao_ipca: d.ipca_anual ?? premissas.inflacao_ipca,
            perda_eficiencia_anual: d.degradacao_anual_percent ?? premissas.perda_eficiencia_anual,
            vpl_taxa_desconto: d.taxa_selic_anual ?? premissas.vpl_taxa_desconto,
          });
          setSource("tenant");
        }
      }
    } catch (e) {
      console.warn("Falha ao carregar premissas do tenant:", e);
    } finally {
      setLoadingDefaults(false);
      setHasLoaded(true);
    }
  };

  const update = (field: keyof PremissasData, value: number) => {
    setSource("manual");
    onPremissasChange({ ...premissas, [field]: value });
  };

  const SECTIONS = [
    {
      title: "Financeiras",
      fields: [
        { key: "imposto" as const, label: "Imposto sobre energia", unit: "%", step: 0.1 },
        { key: "inflacao_energetica" as const, label: "Inflação Energética", unit: "%/ano", step: 0.1 },
        { key: "inflacao_ipca" as const, label: "IPCA", unit: "%/ano", step: 0.1 },
        { key: "vpl_taxa_desconto" as const, label: "Taxa de Desconto (VPL)", unit: "%", step: 0.1 },
      ],
    },
    {
      title: "Técnicas",
      fields: [
        { key: "perda_eficiencia_anual" as const, label: "Degradação anual", unit: "%/ano", step: 0.01 },
        { key: "sobredimensionamento" as const, label: "Sobredimensionamento", unit: "%", step: 1 },
        { key: "troca_inversor_anos" as const, label: "Troca de Inversor", unit: "anos", step: 1 },
        { key: "troca_inversor_custo" as const, label: "Custo Troca Inversor", unit: "% sist.", step: 1 },
      ],
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-base font-bold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-primary" /> Premissas de Cálculo
        </h3>
        <div className="flex items-center gap-2">
          {source === "tenant" && (
            <Badge variant="outline" className="text-[10px] text-success border-success/30">
              Padrões do tenant carregados
            </Badge>
          )}
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
      </div>

      {SECTIONS.map((section) => (
        <div key={section.title} className="rounded-xl border border-border/50 p-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{section.title}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {section.fields.map(f => (
              <div key={f.key} className="space-y-1.5">
                <Label className="text-xs">{f.label}</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step={f.step || 1}
                    value={premissas[f.key] || ""}
                    onChange={e => update(f.key, Number(e.target.value))}
                    className="h-9 pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none font-medium">
                    {f.unit}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="rounded-xl bg-muted/30 border border-border/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>• <strong>Inflação energética</strong>: reajuste anual estimado da tarifa de energia.</p>
        <p>• <strong>Degradação</strong>: perda anual dos módulos fotovoltaicos (~0.5-0.7%).</p>
        <p>• <strong>Sobredimensionamento</strong>: margem extra sobre a potência calculada.</p>
        <p>• <strong>VPL</strong>: taxa de desconto para cálculo do Valor Presente Líquido.</p>
      </div>
    </div>
  );
}
