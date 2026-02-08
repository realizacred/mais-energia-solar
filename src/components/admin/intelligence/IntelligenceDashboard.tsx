import { useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, RefreshCw, Loader2 } from "lucide-react";
import { useLeads } from "@/hooks/useLeads";
import { useLeadScoring } from "@/hooks/useLeadScoring";
import { LeadsToAttack } from "./LeadsToAttack";
import { RevenueForecast } from "./RevenueForecast";
import { ScoringConfigPanel } from "./ScoringConfigPanel";
import { ScoreDistributionChart } from "./ScoreDistributionChart";

export function IntelligenceDashboard() {
  const { leads, statuses, loading: leadsLoading } = useLeads({ pageSize: 500 });
  const {
    config,
    configLoading,
    scores,
    scoresLoading,
    isScoring,
    scoreLeads,
    updateConfig,
    calcularPrevisao,
  } = useLeadScoring();

  const handleRecalcular = useCallback(() => {
    if (leads.length > 0) {
      scoreLeads(leads, statuses.map(s => ({ id: s.id, nome: s.nome })));
    }
  }, [leads, statuses, scoreLeads]);

  const forecast = useMemo(() => {
    if (!config || scores.length === 0) return null;
    return calcularPrevisao(scores, config);
  }, [config, scores, calcularPrevisao]);

  const lastScored = useMemo(() => {
    if (scores.length === 0) return null;
    const latest = scores.reduce((max, s) =>
      new Date(s.calculado_em) > new Date(max.calculado_em) ? s : max
    );
    return new Date(latest.calculado_em);
  }, [scores]);

  const isLoading = leadsLoading || configLoading || scoresLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Brain className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Inteligência Comercial</h2>
            <p className="text-xs text-muted-foreground">
              {scores.length > 0 ? (
                <>
                  {scores.length} leads analisados
                  {lastScored && (
                    <> · Atualizado {lastScored.toLocaleDateString("pt-BR")} às {lastScored.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>
                  )}
                </>
              ) : (
                "Execute o scoring para começar a análise"
              )}
            </p>
          </div>
        </div>

        <Button
          onClick={handleRecalcular}
          disabled={isScoring || isLoading || leads.length === 0}
          className="gap-2"
          size="sm"
        >
          {isScoring ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {isScoring ? "Calculando..." : "Recalcular Scores"}
          {!isScoring && leads.length > 0 && (
            <Badge variant="secondary" className="ml-1 text-[10px]">
              {leads.length}
            </Badge>
          )}
        </Button>
      </div>

      {/* Leads para atacar */}
      <LeadsToAttack leads={leads} scores={scores} />

      {/* Previsão de faturamento */}
      <RevenueForecast forecast={forecast} ticketMedio={config?.ticket_medio || 25000} />

      {/* Gráficos de distribuição */}
      <ScoreDistributionChart scores={scores} />

      {/* Config */}
      <ScoringConfigPanel
        config={config}
        onSave={updateConfig}
        isLoading={configLoading}
      />
    </div>
  );
}
