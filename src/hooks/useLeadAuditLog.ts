/**
 * Hook para buscar histórico de auditoria de leads.
 * §16: Queries só em hooks — §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadAuditEntry {
  id: string;
  lead_id: string;
  tenant_id: string;
  user_id: string | null;
  user_nome: string | null;
  campo_alterado: string;
  valor_anterior: string | null;
  valor_novo: string | null;
  created_at: string;
}

const STALE_TIME = 1000 * 60 * 2; // 2 min — quasi-realtime

const CAMPO_LABELS: Record<string, string> = {
  status_id: "Status",
  consultor: "Consultor",
  ultimo_contato: "Último Contato",
  proxima_acao: "Próxima Ação",
};

export function getCampoLabel(campo: string): string {
  return CAMPO_LABELS[campo] || campo;
}

export function useLeadAuditLog(leadId: string | null) {
  return useQuery<LeadAuditEntry[]>({
    queryKey: ["lead_audit_log", leadId],
    queryFn: async () => {
      if (!leadId) return [];
      const { data, error } = await supabase
        .from("lead_audit_log" as any)
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as LeadAuditEntry[];
    },
    staleTime: STALE_TIME,
    enabled: !!leadId,
  });
}
