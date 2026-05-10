/**
 * useVincularCliente — vínculo manual lead ↔ cliente existente.
 * Usado em /admin/leads quando matched_projeto_id é null mas cliente existe
 * (ex.: SolarMarket migrado com telefone divergente).
 *
 * Backend: RPCs suggest_cliente_for_lead / link_lead_to_cliente / unlink_lead_cliente.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ClienteCandidate {
  cliente_id: string;
  nome: string;
  telefone: string | null;
  telefone_normalized: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  external_source: string | null;
  external_id: string | null;
  projeto_count: number;
  match_score: number;
  match_reason: string | null;
}

export function useSuggestClientesParaLead(leadId: string | null, enabled = true) {
  return useQuery({
    queryKey: ["suggest-cliente-for-lead", leadId],
    enabled: !!leadId && enabled,
    staleTime: 30_000,
    queryFn: async (): Promise<ClienteCandidate[]> => {
      const { data, error } = await supabase.rpc("suggest_cliente_for_lead", {
        p_lead_id: leadId!,
      });
      if (error) throw error;
      return (data ?? []) as ClienteCandidate[];
    },
  });
}

export function useVincularCliente() {
  const qc = useQueryClient();

  const link = useMutation({
    mutationFn: async (args: { leadId: string; clienteId: string; reason?: string }) => {
      const { data, error } = await supabase.rpc("link_lead_to_cliente", {
        p_lead_id: args.leadId,
        p_cliente_id: args.clienteId,
        p_reason: args.reason ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Cliente vinculado ao lead");
      qc.invalidateQueries({ queryKey: ["orcamentos-admin"] });
      qc.invalidateQueries({ queryKey: ["suggest-cliente-for-lead"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao vincular cliente"),
  });

  const unlink = useMutation({
    mutationFn: async (leadId: string) => {
      const { data, error } = await supabase.rpc("unlink_lead_cliente", {
        p_lead_id: leadId,
      });
      if (error) throw error;
      return data as boolean;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      qc.invalidateQueries({ queryKey: ["orcamentos-admin"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao remover vínculo"),
  });

  return { link, unlink };
}
