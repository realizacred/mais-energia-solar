import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntelligenceMetrics {
  totalAnalisados: number;
  alertasAtivos: number;
  alertasResolvidos: number;
  taxaConversao: number;
  tempoMedioResolucao: number; // hours
  distribuicaoTemperamento: { temperamento: string; count: number }[];
  conversaoPorAbordagem: { acao: string; sucesso: number; total: number }[];
}

export function useIntelligenceMetrics() {
  return useQuery({
    queryKey: ["intelligence-metrics"],
    queryFn: async (): Promise<IntelligenceMetrics> => {
      // Fetch profiles for distribution
      const { data: profiles, error: pErr } = await supabase
        .from("lead_intelligence_profiles")
        .select("temperamento, status_acao");
      if (pErr) throw pErr;

      // Fetch alerts for metrics
      const { data: alerts, error: aErr } = await supabase
        .from("intelligence_alerts")
        .select("acao_tomada, resultado, created_at, resolvido_at");
      if (aErr) throw aErr;

      const totalAnalisados = profiles?.length || 0;
      const alertasAtivos = alerts?.filter((a) => !a.resolvido_at).length || 0;
      const alertasResolvidos = alerts?.filter((a) => a.resolvido_at).length || 0;

      // Distribuição temperamento
      const tempMap: Record<string, number> = {};
      for (const p of profiles || []) {
        const t = p.temperamento || "sem_analise";
        tempMap[t] = (tempMap[t] || 0) + 1;
      }
      const distribuicaoTemperamento = Object.entries(tempMap).map(([temperamento, count]) => ({
        temperamento,
        count,
      }));

      // Conversão por abordagem
      const abordagemMap: Record<string, { sucesso: number; total: number }> = {};
      for (const a of alerts || []) {
        if (!a.acao_tomada) continue;
        if (!abordagemMap[a.acao_tomada]) {
          abordagemMap[a.acao_tomada] = { sucesso: 0, total: 0 };
        }
        abordagemMap[a.acao_tomada].total += 1;
        if (a.resultado === "sucesso") {
          abordagemMap[a.acao_tomada].sucesso += 1;
        }
      }
      const conversaoPorAbordagem = Object.entries(abordagemMap).map(([acao, v]) => ({
        acao,
        ...v,
      }));

      // Taxa conversão global
      const convertidos = profiles?.filter((p) => p.status_acao === "convertido").length || 0;
      const taxaConversao = totalAnalisados > 0 ? (convertidos / totalAnalisados) * 100 : 0;

      // Tempo médio resolução (hours)
      let totalHours = 0;
      let resolved = 0;
      for (const a of alerts || []) {
        if (a.resolvido_at && a.created_at) {
          const diff = new Date(a.resolvido_at).getTime() - new Date(a.created_at).getTime();
          totalHours += diff / (1000 * 60 * 60);
          resolved += 1;
        }
      }
      const tempoMedioResolucao = resolved > 0 ? Math.round((totalHours / resolved) * 10) / 10 : 0;

      return {
        totalAnalisados,
        alertasAtivos,
        alertasResolvidos,
        taxaConversao: Math.round(taxaConversao * 10) / 10,
        tempoMedioResolucao,
        distribuicaoTemperamento,
        conversaoPorAbordagem,
      };
    },
    staleTime: 1000 * 60 * 2,
  });
}
