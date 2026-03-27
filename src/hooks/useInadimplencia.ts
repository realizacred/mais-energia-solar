// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays } from "date-fns";

const STALE_TIME = 1000 * 60 * 5;

export interface ParcelaComCliente {
  id: string;
  recebimento_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  created_at: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_id: string;
  dias_atraso: number;
  valor_total_recebimento: number;
}

export interface InadimplenciaStats {
  totalAtrasadas: number;
  valorTotalAtrasado: number;
  clientesInadimplentes: number;
  mediaAtraso: number;
}

export function useParcelasAtrasadas() {
  return useQuery({
    queryKey: ["parcelas-atrasadas"],
    queryFn: async () => {
      // Atualizar status de parcelas atrasadas
      await supabase.rpc("update_parcelas_atrasadas");

      // Buscar parcelas atrasadas, excluindo recebimentos aguardando_instalacao
      const { data, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          recebimentos!inner (
            id,
            valor_total,
            status,
            clientes!inner (
              id,
              nome,
              telefone
            )
          )
        `)
        .eq("status", "atrasada")
        .neq("recebimentos.status", "aguardando_instalacao")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      return (data || []).map((p: any) => ({
        id: p.id,
        recebimento_id: p.recebimento_id,
        numero_parcela: p.numero_parcela,
        valor: p.valor,
        data_vencimento: p.data_vencimento,
        status: p.status,
        created_at: p.created_at,
        cliente_nome: p.recebimentos?.clientes?.nome || "N/A",
        cliente_telefone: p.recebimentos?.clientes?.telefone || "",
        cliente_id: p.recebimentos?.clientes?.id || "",
        valor_total_recebimento: p.recebimentos?.valor_total || 0,
        dias_atraso: differenceInDays(new Date(), new Date(p.data_vencimento)),
      })) as ParcelaComCliente[];
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshInadimplencia() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["parcelas-atrasadas"] });
}
