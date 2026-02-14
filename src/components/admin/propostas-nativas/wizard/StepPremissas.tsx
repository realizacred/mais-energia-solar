import { Settings2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type PremissasData } from "./types";

interface Props {
  premissas: PremissasData;
  onPremissasChange: (p: PremissasData) => void;
}

export function StepPremissas({ premissas, onPremissasChange }: Props) {
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
      <h3 className="text-base font-bold flex items-center gap-2">
        <Settings2 className="h-4 w-4 text-primary" /> Premissas de Cálculo
      </h3>

      <p className="text-sm text-muted-foreground">
        Configure as premissas técnicas e financeiras para o dimensionamento e cálculo de retorno.
        Os valores padrão podem ser ajustados nas configurações do tenant.
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

      {/* Summary info */}
      <div className="rounded-xl bg-muted/30 border border-border/30 p-4 text-xs text-muted-foreground space-y-1">
        <p>• <strong>Inflação energética</strong>: reajuste anual estimado da tarifa de energia.</p>
        <p>• <strong>Perda de eficiência</strong>: degradação anual dos módulos fotovoltaicos (~0.5%).</p>
        <p>• <strong>Sobredimensionamento</strong>: margem extra sobre a potência calculada.</p>
        <p>• <strong>VPL</strong>: taxa de desconto para cálculo do Valor Presente Líquido.</p>
      </div>
    </div>
  );
}
