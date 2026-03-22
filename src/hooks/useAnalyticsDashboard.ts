/**
 * Hooks for AnalyticsDashboard data.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min — dashboard data

export interface AnalyticsLead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  consultor: string | null;
  created_at: string;
  status_id: string | null;
}

export interface AnalyticsLeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

export function useAnalyticsLeads() {
  return useQuery({
    queryKey: ["analytics_leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, estado, cidade, media_consumo, consultor, created_at, status_id")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AnalyticsLead[];
    },
    staleTime: STALE_TIME,
  });
}

export function useAnalyticsLeadStatuses() {
  return useQuery({
    queryKey: ["analytics_lead_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome, cor, ordem, probabilidade_peso, motivo_perda_obrigatorio")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as AnalyticsLeadStatus[];
    },
    staleTime: STALE_TIME,
  });
}
