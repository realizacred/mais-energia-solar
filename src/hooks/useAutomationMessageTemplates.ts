import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationMessageTemplate {
  id: string;
  gatilho: string;
  canal: string;
  template: string;
  ativo: boolean;
  metadata: Record<string, any>;
}

const QUERY_KEY = "automation-message-templates" as const;
const STALE_TIME = 1000 * 60 * 5;

export function useAutomationMessageTemplates() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_message_templates")
        .select("*")
        .order("gatilho");
      if (error) throw error;
      return (data as AutomationMessageTemplate[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveAutomationMessageTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<AutomationMessageTemplate>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      if (payload.id) {
        const { error } = await supabase
          .from("automation_message_templates")
          .update(payload)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("automation_message_templates")
          .insert({ ...payload, tenant_id: profile.tenant_id } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
