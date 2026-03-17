import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useWaInstanceConsultores() {
  return useQuery({
    queryKey: ["wa-instance-consultores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_instance_consultores")
        .select("id, instance_id, consultor_id, tenant_id");
      return data || [];
    },
    staleTime: 60 * 1000,
  });
}

export function useWaAutoReplyConfig() {
  return useQuery({
    queryKey: ["wa-auto-reply-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_auto_reply_config")
        .select("id, ativo, mensagem_fora_horario, mensagem_feriado, cooldown_minutos, silenciar_alertas, silenciar_sla")
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useWaAutomationConfig() {
  return useQuery({
    queryKey: ["whatsapp-automation-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_automation_config")
        .select("id, mensagem_boas_vindas, auto_reply_enabled, auto_reply_message")
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
