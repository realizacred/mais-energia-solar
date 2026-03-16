import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { toast } from "sonner";
import type { ProposalChart, ProposalChartInsert, ProposalChartUpdate, RenderChartRequest } from "@/lib/proposal-charts/charts-types";

const QUERY_KEY = "proposal-charts";

export function useProposalCharts() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async (): Promise<ProposalChart[]> => {
      const { tenantId } = await getCurrentTenantId();
      const { data, error } = await supabase
        .from("proposal_charts")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as ProposalChart[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useCreateProposalChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (chart: Omit<ProposalChartInsert, "tenant_id">) => {
      const { tenantId } = await getCurrentTenantId();
      const { data, error } = await supabase
        .from("proposal_charts")
        .insert({ ...chart, tenant_id: tenantId } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Gráfico criado com sucesso");
    },
    onError: (e: Error) => {
      toast.error(`Erro ao criar gráfico: ${e.message}`);
    },
  });
}

export function useUpdateProposalChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: ProposalChartUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("proposal_charts")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Gráfico atualizado");
    },
    onError: (e: Error) => {
      toast.error(`Erro ao atualizar: ${e.message}`);
    },
  });
}

export function useDeleteProposalChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("proposal_charts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Gráfico excluído");
    },
    onError: (e: Error) => {
      toast.error(`Erro ao excluir: ${e.message}`);
    },
  });
}

export function useRenderChart() {
  return useMutation({
    mutationFn: async (request: RenderChartRequest) => {
      const { data, error } = await supabase.functions.invoke("proposal-chart-render", {
        body: request,
        headers: { "x-client-timeout": "120" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error ?? "Erro ao renderizar gráfico");
      return data as { success: true; image_base64: string; content_type: string; size_bytes: number };
    },
    onError: (e: Error) => {
      toast.error(`Erro ao renderizar gráfico: ${e.message}`);
    },
  });
}
