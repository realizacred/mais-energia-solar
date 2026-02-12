import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para consumir dados das materialized views do dashboard.
 * Os dados são pré-agregados no banco — muito mais rápido que processar client-side.
 * Chame refresh_dashboard_views() para atualizar os dados.
 */

export function useDashboardStats() {
  const leadsMensal = useQuery({
    queryKey: ["dashboard", "leads-mensal"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_leads_mensal");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 min — view é atualizada via refresh
  });

  const leadsEstado = useQuery({
    queryKey: ["dashboard", "leads-estado"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_leads_estado");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const vendedorPerformance = useQuery({
    queryKey: ["dashboard", "vendedor-performance"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_consultor_performance");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const pipeline = useQuery({
    queryKey: ["dashboard", "pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_pipeline");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const financeiro = useQuery({
    queryKey: ["dashboard", "financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dashboard_financeiro");
      if (error) throw error;
      return (data ?? [])[0] ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const refreshViews = async () => {
    const { error } = await supabase.rpc("refresh_dashboard_views");
    if (error) throw error;
    // Invalidar queries após refresh
    return true;
  };

  return {
    leadsMensal,
    leadsEstado,
    vendedorPerformance,
    pipeline,
    financeiro,
    refreshViews,
    isLoading:
      leadsMensal.isLoading ||
      leadsEstado.isLoading ||
      vendedorPerformance.isLoading ||
      pipeline.isLoading ||
      financeiro.isLoading,
  };
}
