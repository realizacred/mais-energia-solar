import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Loader2, Settings2, Info, Lock, TrendingUp, Sun, Activity } from "lucide-react";
import { useTenantPremises, type TenantPremises } from "@/hooks/useTenantPremises";
import { LoadingState } from "@/components/ui-kit";

/**
 * Premissas Técnicas Tab — SSOT real: `tenant_premises`.
 * Visual padronizado: header interno, blocos (Econômicas / Técnicas / Perdas),
 * border-l-4 border-l-primary, LoadingState, botão de salvar com 3 estados.
 * NÃO altera lógica, hooks, schema ou cálculos.
 */

type PremiseKey = keyof TenantPremises;

interface FieldDef {
  key: PremiseKey;
  label: string;
  suffix: string;
  step?: string;
  help?: string;
}

const ECONOMICAS: FieldDef[] = [
  { key: "inflacao_energetica", label: "Reajuste tarifário / inflação energética", suffix: "%/ano", step: "0.1" },
  { key: "vpl_taxa_desconto", label: "Taxa de desconto (VPL)", suffix: "%", step: "0.01" },
  { key: "vida_util_sistema", label: "Vida útil do sistema", suffix: "anos", step: "1" },
  { key: "percentual_economia", label: "Percentual de economia alvo", suffix: "%", step: "1" },
  { key: "custo_por_kwp", label: "Custo médio por kWp", suffix: "R$/kWp", step: "1" },
];

const TECNICAS: FieldDef[] = [
  { key: "geracao_mensal_por_kwp", label: "Geração média por kWp", suffix: "kWh/kWp·mês", step: "1" },
  { key: "kg_co2_por_kwh", label: "Emissão evitada (CO₂)", suffix: "kg/kWh", step: "0.001" },
  { key: "sobredimensionamento_padrao", label: "Sobredimensionamento padrão", suffix: "%", step: "0.1" },
  { key: "margem_potencia_ideal", label: "Margem de potência ideal", suffix: "%", step: "0.1" },
  { key: "taxa_desempenho_tradicional", label: "Performance Ratio (tradicional)", suffix: "%", step: "0.1" },
  { key: "taxa_desempenho_microinversor", label: "Performance Ratio (microinversor)", suffix: "%", step: "0.1" },
  { key: "taxa_desempenho_otimizador", label: "Performance Ratio (otimizador)", suffix: "%", step: "0.1" },
];

const PERDAS: FieldDef[] = [
  { key: "perda_eficiencia_tradicional", label: "Perda eficiência (tradicional)", suffix: "%/ano", step: "0.01" },
  { key: "perda_eficiencia_microinversor", label: "Perda eficiência (microinversor)", suffix: "%/ano", step: "0.01" },
  { key: "perda_eficiencia_otimizador", label: "Perda eficiência (otimizador)", suffix: "%/ano", step: "0.01" },
  { key: "shading_loss_percent", label: "Perda por sombreamento", suffix: "%", step: "0.1" },
  { key: "soiling_loss_percent", label: "Perda por sujidade", suffix: "%", step: "0.1" },
  { key: "other_losses_percent", label: "Outras perdas", suffix: "%", step: "0.1" },
];

const LEGACY_ONLY = [
  { label: "Irradiação média", suffix: "kWh/m²/dia", note: "Definido por base de irradiância do tenant (Aba Valores Padrões)." },
  { label: "Horas Sol Pico (HSP)", suffix: "h/dia", note: "Calculado dinamicamente a partir da localização da UC." },
  { label: "Degradação anual", suffix: "%/ano", note: "Aplicada via curva de geração no motor solar." },
  { label: "Taxa Selic / IPCA", suffix: "%", note: "Use a Taxa de desconto (VPL) acima como parâmetro financeiro canônico." },
  { label: "Custo de disponibilidade (Mono/Bi/Tri)", suffix: "kWh", note: "Aplicado pelo motor com base no fase_tensao_rede da UC." },
  { label: "Taxas fixas mensais", suffix: "R$", note: "Use Outros encargos na Aba Valores Padrões." },
];

export function PremissasTecnicasTab() {
  const queryClient = useQueryClient();
  const { premises, setPremises, loading, saving, isDirty, save, reload } = useTenantPremises();

  function handleChange(key: PremiseKey, value: string) {
    const num = parseFloat(value);
    setPremises((prev) => ({ ...prev, [key]: Number.isFinite(num) ? num : 0 } as TenantPremises));
  }

  async function handleSave() {
    await save();
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant-premises"] }),
      queryClient.invalidateQueries({ queryKey: ["solar-premises"] }),
      queryClient.invalidateQueries({ queryKey: ["pricing-config"] }),
    ]);
    await reload();
  }

  if (loading) return <LoadingState context="config" />;

  const renderFields = (fields: FieldDef[]) => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {fields.map((f) => {
        const raw = premises[f.key];
        const value = typeof raw === "number" ? raw : "";
        return (
          <div key={String(f.key)} className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">{f.label}</Label>
            <div className="relative">
              <Input
                type="number"
                step={f.step || "0.01"}
                value={value}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="pr-24 text-sm"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                {f.suffix}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  const SaveButton = (
    <div className="flex items-center justify-end gap-3 pt-2">
      {isDirty && !saving && (
        <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
          Alterações não salvas
        </Badge>
      )}
      <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2 min-w-[140px]">
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
        ) : (
          <><Save className="h-4 w-4" /> Salvar premissas</>
        )}
      </Button>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header interno */}
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Settings2 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Premissas técnicas e financeiras</h2>
          <p className="text-sm text-muted-foreground">
            Parâmetros canônicos consumidos pelo motor solar e pelo gerador de propostas.
          </p>
        </div>
      </div>

      <Alert className="border-l-4 border-l-primary">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          As alterações são propagadas imediatamente após salvar (wizard, calculadora e propostas).
        </AlertDescription>
      </Alert>

      {/* Econômicas */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Econômicas
          </CardTitle>
          <CardDescription className="text-xs">
            Parâmetros financeiros usados em payback, VPL e projeções de economia.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderFields(ECONOMICAS)}</CardContent>
      </Card>

      {/* Técnicas */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            Técnicas
          </CardTitle>
          <CardDescription className="text-xs">
            Geração esperada, performance ratio e parâmetros de dimensionamento.
          </CardDescription>
        </CardHeader>
        <CardContent>{renderFields(TECNICAS)}</CardContent>
      </Card>

      {/* Perdas */}
      <Card className="border-border/60 border-l-4 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Perdas
          </CardTitle>
          <CardDescription className="text-xs">
            Degradação por tecnologia, sombreamento, sujidade e demais perdas do sistema.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {renderFields(PERDAS)}
          {SaveButton}
        </CardContent>
      </Card>

      {/* Legados */}
      <Card className="border-border/60 border-l-4 border-l-muted bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-semibold flex items-center gap-2 text-muted-foreground">
            <Lock className="h-3.5 w-3.5" />
            Campos legados (não editáveis aqui)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LEGACY_ONLY.map((f) => (
              <div key={f.label} className="rounded-md border border-border/60 bg-background/60 p-3">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{f.label}</span>
                  <Badge variant="outline" className="text-[9px]">Legado</Badge>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{f.note}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
