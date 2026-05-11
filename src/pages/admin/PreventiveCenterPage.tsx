/**
 * Central Preventiva — Phase 1 (READ-ONLY)
 *
 * Consolida observabilidade preventiva multi-domínio (comercial, pós-venda,
 * engenharia, financeiro) reaproveitando infraestrutura existente:
 *  - vw_proposal_followup_inbox + proposal_followup_attempts
 *  - wa_followup_rules + pipeline_automations + wa_cadences
 *  - projetos + recebimentos
 *
 * RB-76: zero duplicação. Hooks separados, sem query inline.
 * Não cria edge functions, tabelas ou crons. Sem disparos nesta fase.
 */
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, RefreshCw, BarChart3, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { PreventiveExecutiveKpis } from "@/components/admin/preventiva/PreventiveExecutiveKpis";
import { PreventiveHeatmap } from "@/components/admin/preventiva/PreventiveHeatmap";
import { PreventiveScenarioCatalog } from "@/components/admin/preventiva/PreventiveScenarioCatalog";
import { PreventiveDashboardSkeleton } from "@/components/admin/preventiva/PreventiveDashboardSkeleton";
import { usePreventiveDashboard } from "@/hooks/usePreventiveDashboard";
import { usePreventiveHeatmap } from "@/hooks/usePreventiveHeatmap";
import { usePreventiveScenarios } from "@/hooks/usePreventiveScenarios";
import { toast } from "sonner";

export default function PreventiveCenterPage() {
  const qc = useQueryClient();
  const dashboard = usePreventiveDashboard();
  const heatmap = usePreventiveHeatmap();
  const scenarios = usePreventiveScenarios();

  const isLoading = dashboard.isLoading || heatmap.isLoading || scenarios.isLoading;
  const isError = dashboard.isError || heatmap.isError || scenarios.isError;

  const handleRefresh = () => {
    qc.invalidateQueries({ queryKey: ["preventive-dashboard"] });
    qc.invalidateQueries({ queryKey: ["preventive-heatmap"] });
    qc.invalidateQueries({ queryKey: ["preventive-scenarios"] });
    toast.success("Atualizando central preventiva…");
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <PageHeader
        icon={ShieldCheck}
        title="Central Preventiva"
        description="Monitoramento inteligente de clientes, propostas e operações."
        helpText="Phase 1 — observabilidade unificada. Disparos manuais e automações continuam nas suas telas atuais."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Atualizar
            </Button>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </Button>
            <Button variant="outline" size="sm" disabled className="gap-2">
              <Settings2 className="h-4 w-4" />
              Configurações
            </Button>
          </>
        }
      />

      {isError && (
        <EmptyState
          icon={ShieldCheck}
          title="Não foi possível carregar a Central Preventiva"
          description="Verifique sua conexão e clique em Atualizar."
        />
      )}

      {isLoading && !isError && <PreventiveDashboardSkeleton />}

      {!isLoading && !isError && (
        <>
          <PreventiveExecutiveKpis
            kpis={
              dashboard.data ?? {
                clientes_em_risco: 0,
                propostas_esfriando: 0,
                engenharia_parada: 0,
                cobrancas_preventivas: 0,
                clientes_sem_interacao: 0,
                acoes_automaticas_hoje: 0,
                aguardando_revisao: 0,
                recuperacao_potencial: 0,
              }
            }
          />
          <PreventiveHeatmap rows={heatmap.data ?? []} />
          <PreventiveScenarioCatalog scenarios={scenarios.data ?? []} />
        </>
      )}
    </div>
  );
}
