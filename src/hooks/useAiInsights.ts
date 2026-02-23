import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type InsightType = "daily_summary" | "alert" | "action_plan" | "weekly_report";

export interface AiInsight {
  id: string;
  tenant_id: string;
  created_at: string;
  insight_type: InsightType;
  payload: any;
  generated_by_user_id: string | null;
  period_start: string | null;
  period_end: string | null;
  filters: any;
}

export function useAiInsights() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [generating, setGenerating] = useState<InsightType | null>(null);

  // Fetch latest insights by type
  const insightsQuery = useQuery({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_insights")
        .select("id, tenant_id, created_at, insight_type, payload, generated_by_user_id, period_start, period_end, filters")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as AiInsight[];
    },
    staleTime: 2 * 60 * 1000,
  });

  const getLatestByType = (type: InsightType): AiInsight | undefined => {
    return insightsQuery.data?.find((i) => i.insight_type === type);
  };

  const generateInsight = async (type: InsightType, filters: Record<string, any> = {}) => {
    setGenerating(type);
    try {
      const { data, error } = await supabase.functions.invoke("generate-ai-insights", {
        body: { insight_type: type, filters },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      await queryClient.invalidateQueries({ queryKey: ["ai-insights"] });

      toast({
        title: "Insight gerado com sucesso",
        description: `${typeLabels[type]} atualizado.`,
      });

      return data.insight as AiInsight;
    } catch (err: any) {
      console.error("Error generating insight:", err);
      toast({
        title: "Erro ao gerar insight",
        description: err.message || "Tente novamente.",
        variant: "destructive",
      });
      return null;
    } finally {
      setGenerating(null);
    }
  };

  return {
    insights: insightsQuery.data || [],
    loading: insightsQuery.isLoading,
    generating,
    generateInsight,
    getLatestByType,
    refetch: insightsQuery.refetch,
  };
}

export const typeLabels: Record<InsightType, string> = {
  daily_summary: "Resumo Executivo",
  alert: "Alertas e Riscos",
  action_plan: "Plano de Ação",
  weekly_report: "Relatório Semanal",
};
