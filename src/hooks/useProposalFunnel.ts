// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 5;

export interface FunnelMetrics {
  total_geradas: number;
  total_enviadas: number;
  total_vistas: number;
  total_aceitas: number;
  total_recusadas: number;
  taxa_visualizacao: number;
  taxa_conversao: number;
  propostas_quentes: number;
  avg_tempo_abertura_horas: number | null;
  period_days: number;
}

export interface VendorMetrics {
  vendedor: string;
  vendedor_id: string;
  total: number;
  aceitas: number;
  pendentes: number;
  valor_aceito: number;
  taxa_conversao: number;
}

export interface HotProposal {
  id: string;
  titulo: string;
  codigo: string;
  status: string;
  total_aberturas: number;
  primeiro_acesso_em: string | null;
  ultimo_acesso_em: string | null;
  enviada_at: string | null;
  cliente_nome: string | null;
  valor_total: number;
  potencia_kwp: number;
  vendedor: string | null;
}

export function useProposalFunnel(days = 30) {
  const { user } = useAuth();

  const metrics = useQuery({
    queryKey: ["proposal-funnel-metrics", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_proposal_funnel_metrics" as any, {
        p_days: days,
      });
      if (error) throw error;
      return data as FunnelMetrics;
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  const vendors = useQuery({
    queryKey: ["proposal-vendors", days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_proposals_by_vendor" as any, {
        p_days: days,
      });
      if (error) throw error;
      return (data || []) as VendorMetrics[];
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  const hotProposals = useQuery({
    queryKey: ["proposal-hot"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_hot_proposals" as any, {
        p_limit: 10,
      });
      if (error) throw error;
      return (data || []) as HotProposal[];
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });

  return { metrics, vendors, hotProposals };
}
