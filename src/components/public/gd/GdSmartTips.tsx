/**
 * GdSmartTips — Data-driven optimization tips for GD distribution.
 * Uses real invoice/allocation data only (no simulation).
 * SRP: Pure presentation of detected situations.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { GdPercentageResult, UcSituation } from "@/services/energia/gdPercentageService";

interface GdSmartTipsProps {
  result: GdPercentageResult;
  groupName?: string;
}

interface Tip {
  icon: typeof TrendingUp;
  iconColor: string;
  text: string;
}

function generateTips(result: GdPercentageResult): Tip[] {
  const tips: Tip[] = [];
  const { results, generatorRetainedKwh, generationKwh, efficiencyPercent } = result;

  // 1. UCs receiving more than they consume
  const acimaUcs = results.filter(r => r.situation === "acima_do_ideal" && r.type === "beneficiaria");
  acimaUcs.forEach(uc => {
    tips.push({
      icon: TrendingDown,
      iconColor: "text-warning",
      text: `A unidade "${uc.ucLabel}" está recebendo mais energia do que consome. Reduzir o percentual evita desperdício de créditos.`,
    });
  });

  // 2. UCs receiving less than they could
  const abaixoUcs = results.filter(r => r.situation === "abaixo_do_ideal" && r.type === "beneficiaria");
  abaixoUcs.forEach(uc => {
    tips.push({
      icon: TrendingUp,
      iconColor: "text-info",
      text: `A unidade "${uc.ucLabel}" poderia receber mais energia. Aumentar o percentual melhora o aproveitamento.`,
    });
  });

  // 3. Energy surplus retained at generator
  if (generatorRetainedKwh > generationKwh * 0.15 && generatorRetainedKwh > 50) {
    tips.push({
      icon: AlertTriangle,
      iconColor: "text-warning",
      text: `Parte da energia gerada (${generatorRetainedKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh) está ficando na geradora. Redistribuir pode aumentar a economia do grupo.`,
    });
  }

  // 4. Low efficiency
  if (efficiencyPercent < 70) {
    tips.push({
      icon: AlertTriangle,
      iconColor: "text-destructive",
      text: `A eficiência da distribuição está em ${efficiencyPercent.toFixed(0)}%. Ajustar os percentuais de forma proporcional ao consumo pode melhorar significativamente.`,
    });
  }

  // 5. Good efficiency
  if (efficiencyPercent >= 90 && tips.length === 0) {
    tips.push({
      icon: CheckCircle2,
      iconColor: "text-success",
      text: `A distribuição de energia está bem equilibrada, com ${efficiencyPercent.toFixed(0)}% de eficiência. Sem ajustes necessários no momento.`,
    });
  }

  return tips;
}

export function GdSmartTips({ result, groupName }: GdSmartTipsProps) {
  const tips = generateTips(result);

  if (tips.length === 0) return null;

  const hasIssues = tips.some(t => t.iconColor !== "text-success");

  return (
    <Card className={`border-l-[3px] ${hasIssues ? "border-l-warning bg-warning/[0.02]" : "border-l-success bg-success/[0.02]"}`}>
      <CardHeader className="pb-2 px-4 sm:px-5">
        <CardTitle className="text-sm flex items-center gap-2 text-foreground">
          <div className={`w-7 h-7 rounded-lg ${hasIssues ? "bg-warning/10" : "bg-success/10"} flex items-center justify-center shrink-0`}>
            <Lightbulb className={`w-4 h-4 ${hasIssues ? "text-warning" : "text-success"}`} />
          </div>
          {hasIssues ? "Sugestões de otimização" : "Distribuição otimizada"}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-5 pb-4 space-y-2">
        {hasIssues && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {groupName
              ? `Identificamos oportunidades de melhoria na distribuição de energia do grupo ${groupName}.`
              : "Identificamos oportunidades de melhoria na distribuição de energia deste grupo."}
          </p>
        )}

        <div className="space-y-1.5">
          {tips.map((tip, i) => {
            const Icon = tip.icon;
            return (
              <div
                key={i}
                className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/30 border border-border/50"
              >
                <Icon className={`w-4 h-4 ${tip.iconColor} mt-0.5 shrink-0`} />
                <p className="text-xs text-foreground leading-relaxed">{tip.text}</p>
              </div>
            );
          })}
        </div>

        {hasIssues && (
          <p className="text-[10px] text-muted-foreground italic">
            * Sugestões baseadas nos dados reais de consumo e distribuição. Consulte seu gestor de energia para aplicar ajustes.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
