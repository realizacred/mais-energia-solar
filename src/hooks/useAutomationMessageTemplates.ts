import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AutomationMessageTemplate {
  id: string;
  evento: string;
  canal: string;
  template_mensagem: string;
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
        .from("notification_rules")
        .select("*")
        .not("evento", "is", null)
        .order("evento");
      if (error) throw error;
      return (data as any[]).map(t => ({
        id: t.id,
        evento: t.evento,
        canal: t.canal,
        template_mensagem: t.template_mensagem,
        ativo: t.ativo,
        metadata: t.metadata || {}
      })) as AutomationMessageTemplate[];
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

      const dbPayload = {
        tenant_id: profile.tenant_id,
        evento: payload.evento,
        canal: payload.canal,
        template_mensagem: payload.template_mensagem,
        ativo: payload.ativo,
        metadata: payload.metadata
      };

      if (payload.id) {
        const { error } = await supabase
          .from("notification_rules")
          .update(dbPayload)
          .eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_rules")
          .insert(dbPayload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
