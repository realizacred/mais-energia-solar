/**
 * usePerformanceDashboard — Queries for PerformanceDashboard.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15; // 15 min — analytics/report dashboard

interface Lead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  consultor: string | null;
  consultor_id: string | null;
  created_at: string;
  status_id: string | null;
  motivo_perda_id: string | null;
  valor_estimado: number | null;
}

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface MotivoPerda {
  id: string;
  nome: string;
}

interface Consultor {
  id: string;
  nome: string;
}

interface Deal {
  id: string;
  owner_id: string;
  deal_value: number;
  deal_status: string;
  stage_name: string;
  created_at: string;
  kwp: number;
}

export function usePerformanceLeads() {
  return useQuery({
    queryKey: ["performance-dashboard", "leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, nome, estado, cidade, media_consumo, consultor, consultor_id, created_at, status_id, motivo_perda_id, valor_estimado")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as Lead[];
    },
    staleTime: STALE_TIME,
  });
}

export function usePerformanceStatuses() {
  return useQuery({
    queryKey: ["performance-dashboard", "lead-statuses"],
    queryFn: async (): Promise<LeadStatus[]> => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome, cor, ordem")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as LeadStatus[];
    },
    staleTime: STALE_TIME,
  });
}

export function usePerformanceMotivosPerda() {
  return useQuery({
    queryKey: ["performance-dashboard", "motivos-perda"],
    queryFn: async (): Promise<MotivoPerda[]> => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("id, nome")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as MotivoPerda[];
    },
    staleTime: STALE_TIME,
  });
}

export function usePerformanceConsultores() {
  return useQuery({
    queryKey: ["performance-dashboard", "consultores"],
    queryFn: async (): Promise<Consultor[]> => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Consultor[];
    },
    staleTime: STALE_TIME,
  });
}

export function usePerformanceDeals() {
  return useQuery({
    queryKey: ["performance-dashboard", "deals"],
    queryFn: async (): Promise<Deal[]> => {
      const { data, error } = await supabase
        .from("deal_kanban_projection")
        .select("deal_id, owner_id, deal_value, deal_status, stage_name, last_stage_change, deal_kwp")
        .limit(1000);
      if (error) throw error;
      return (data ?? []).map((d: any) => ({
        id: d.deal_id,
        owner_id: d.owner_id,
        deal_value: d.deal_value || 0,
        deal_status: d.deal_status,
        stage_name: d.stage_name || "",
        created_at: d.last_stage_change,
        kwp: d.deal_kwp || 0,
      }));
    },
    staleTime: STALE_TIME,
  });
}
