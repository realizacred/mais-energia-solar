/**
 * Hooks for WhatsApp Automation Templates.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface WaAutomationTemplate {
  id: string;
  nome: string;
  tipo: string;
  gatilho_config: Record<string, any>;
  mensagem: string;
  ativo: boolean;
  ordem: number;
}

export interface WaLeadStatus {
  id: string;
  nome: string;
}

export function useWaAutomationTemplates() {
  return useQuery({
    queryKey: ["wa_automation_templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_automation_templates")
        .select("id, nome, tipo, mensagem, gatilho_config, ativo, ordem, created_at, updated_at")
        .order("ordem");
      if (error) throw error;
      return (data ?? []).map(t => ({
        ...t,
        gatilho_config: (typeof t.gatilho_config === "object" && t.gatilho_config !== null)
          ? t.gatilho_config as Record<string, any>
          : {},
      })) as WaAutomationTemplate[];
    },
    staleTime: STALE_TIME,
  });
}

export function useWaLeadStatuses() {
  return useQuery({
    queryKey: ["wa_lead_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as WaLeadStatus[];
    },
    staleTime: STALE_TIME,
  });
}

export function useWaAutomationConfig() {
  return useQuery({
    queryKey: ["wa_automation_config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_automation_config")
        .select("automacoes_ativas")
        .maybeSingle();
      if (error) throw error;
      return data?.automacoes_ativas ?? false;
    },
    staleTime: STALE_TIME,
  });
}

export function useToggleWaAutomacoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (newValue: boolean) => {
      const { error } = await supabase
        .from("whatsapp_automation_config")
        .update({ automacoes_ativas: newValue })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_automation_config"] });
    },
  });
}

export function useToggleWaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_automation_templates")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_automation_templates"] });
    },
  });
}

export function useSalvarWaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase
          .from("whatsapp_automation_templates")
          .update(data)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("whatsapp_automation_templates")
          .insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_automation_templates"] });
    },
  });
}

export function useDeletarWaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_automation_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa_automation_templates"] });
    },
  });
}
