/**
 * useFollowUp — Queries for FollowUpManager.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min — operational follow-up data

export interface FollowUpItem {
  id: string;
  code: string | null;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  consultor: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  type: "lead" | "orcamento";
}

export function useFollowUpLeads() {
  return useQuery({
    queryKey: ["followup", "leads"],
    queryFn: async (): Promise<FollowUpItem[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, lead_code, nome, telefone, cidade, estado, consultor, ultimo_contato, proxima_acao, data_proxima_acao, created_at")
        .is("deleted_at", null);
      if (error) throw error;
      return (data ?? []).map((l: any) => ({
        ...l,
        code: l.lead_code,
        type: "lead" as const,
      }));
    },
    staleTime: STALE_TIME,
  });
}

export function useFollowUpOrcamentos() {
  return useQuery({
    queryKey: ["followup", "orcamentos"],
    queryFn: async (): Promise<FollowUpItem[]> => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, orc_code, cidade, estado, consultor, ultimo_contato, proxima_acao, data_proxima_acao, created_at, lead:leads!inner(nome, telefone)");
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        id: o.id,
        code: o.orc_code,
        nome: (o.lead as any)?.nome || "Sem nome",
        telefone: (o.lead as any)?.telefone || "",
        cidade: o.cidade,
        estado: o.estado,
        consultor: o.consultor,
        ultimo_contato: o.ultimo_contato,
        proxima_acao: o.proxima_acao,
        data_proxima_acao: o.data_proxima_acao,
        created_at: o.created_at,
        type: "orcamento" as const,
      }));
    },
    staleTime: STALE_TIME,
  });
}

export function useFollowUpConsultores() {
  return useQuery({
    queryKey: ["followup", "consultores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("nome, telefone")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as { nome: string; telefone: string | null }[];
    },
    staleTime: STALE_TIME,
  });
}

export function useRegistrarContato() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      id: string;
      type: "lead" | "orcamento";
      proxima_acao: string | null;
      data_proxima_acao: string | null;
    }) => {
      const table = payload.type === "lead" ? "leads" : "orcamentos";
      const { error } = await supabase
        .from(table)
        .update({
          ultimo_contato: new Date().toISOString(),
          proxima_acao: payload.proxima_acao,
          data_proxima_acao: payload.data_proxima_acao,
        })
        .eq("id", payload.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["followup"] });
    },
  });
}
