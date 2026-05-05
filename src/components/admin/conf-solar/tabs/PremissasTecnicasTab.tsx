import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Save, Loader2, Settings2, Info, Lock } from "lucide-react";
import { useTenantPremises, type TenantPremises } from "@/hooks/useTenantPremises";

/**
 * Premissas Técnicas Tab — SSOT real: `tenant_premises`.
 *
 * Esta aba antes editava a tabela legada `premissas_tecnicas`, que NÃO é mais
 * usada pelo motor de cálculo solar (useSolarPremises lê direto de
 * tenant_premises). A correção cirúrgica:
 *  - leitura/escrita via hook useTenantPremises (sem supabase no componente);
 *  - tenant_id resolvido pela RLS / sessão (hook nativo);
 *  - campos sem equivalente em tenant_premises ficam desabilitados + badge
 *    "Legado" e NÃO são persistidos silenciosamente em premissas_tecnicas;
 *  - após salvar, invalida ["tenant-premises"] e ["solar-premises"].
 */

type PremiseKey = keyof TenantPremises;

interface FieldDef {
  key: PremiseKey;
  label: string;
  suffix: string;
  step?: string;
  help?: string;
}

// Campos que possuem equivalente direto em tenant_premises ─────────────────
const FIELDS: FieldDef[] = [
  { key: "inflacao_energetica", label: "Reajuste tarifário / inflação energética", suffix: "%/ano", step: "0.1" },
  { key: "vpl_taxa_desconto", label: "Taxa de desconto (VPL)", suffix: "%", step: "0.01" },
  { key: "vida_util_sistema", label: "Vida útil do sistema", suffix: "anos", step: "1" },
  { key: "geracao_mensal_por_kwp", label: "Geração média por kWp", suffix: "kWh/kWp·mês", step: "1" },
  { key: "custo_por_kwp", label: "Custo médio por kWp", suffix: "R$/kWp", step: "1" },
  { key: "percentual_economia", label: "Percentual de economia alvo", suffix: "%", step: "1" },
  { key: "kg_co2_por_kwh", label: "Emissão evitada (CO₂)", suffix: "kg/kWh", step: "0.001" },
  { key: "sobredimensionamento_padrao", label: "Sobredimensionamento padrão", suffix: "%", step: "0.1" },
  { key: "margem_potencia_ideal", label: "Margem de potência ideal", suffix: "%", step: "0.1" },
  { key: "perda_eficiencia_tradicional", label: "Perda eficiência (tradicional)", suffix: "%/ano", step: "0.01" },
  { key: "perda_eficiencia_microinversor", label: "Perda eficiência (microinversor)", suffix: "%/ano", step: "0.01" },
  { key: "perda_eficiencia_otimizador", label: "Perda eficiência (otimizador)", suffix: "%/ano", step: "0.01" },
  { key: "taxa_desempenho_tradicional", label: "Performance Ratio (tradicional)", suffix: "%", step: "0.1" },
  { key: "taxa_desempenho_microinversor", label: "Performance Ratio (microinversor)", suffix: "%", step: "0.1" },
  { key: "taxa_desempenho_otimizador", label: "Performance Ratio (otimizador)", suffix: "%", step: "0.1" },
  { key: "shading_loss_percent", label: "Perda por sombreamento", suffix: "%", step: "0.1" },
  { key: "soiling_loss_percent", label: "Perda por sujidade", suffix: "%", step: "0.1" },
  { key: "other_losses_percent", label: "Outras perdas", suffix: "%", step: "0.1" },
];

// Campos legados sem equivalente — somente leitura, NÃO salvam ─────────────
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
    // Invalidar caches consumidos por outras telas (wizard, calculadora, etc.)
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tenant-premises"] }),
      queryClient.invalidateQueries({ queryKey: ["solar-premises"] }),
      queryClient.invalidateQueries({ queryKey: ["pricing-config"] }),
    ]);
    // Recarrega o estado local com o que foi efetivamente persistido
    await reload();
  }

  if (loading) {
    return (
      <Card className="border-l-4 border-l-primary border-border/60">
        <CardContent className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Carregando premissas...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Alert className="border-l-4 border-l-primary">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Estas premissas são lidas pelo motor solar (<code>useSolarPremises</code>) e pelo
          gerador de propostas. Alterações são propagadas imediatamente após salvar.
        </AlertDescription>
      </Alert>

      <Card className="border-l-4 border-l-primary border-border/60">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-primary" />
            Premissas Técnicas & Financeiras
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {FIELDS.map((f) => {
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
                      className="pr-20 text-sm"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-medium">
                      {f.suffix}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end mt-6 gap-2">
            {isDirty && (
              <Badge variant="outline" className="text-[10px]">Alterações não salvas</Badge>
            )}
            <Button onClick={handleSave} disabled={saving || !isDirty} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Premissas
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Campos legados sem equivalente em tenant_premises */}
      <Card className="border-l-4 border-l-muted border-border/60 bg-muted/20">
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
