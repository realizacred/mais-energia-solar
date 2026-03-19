import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReaquecimentoOportunidade {
  id: string;
  tenant_id: string;
  lead_id: string;
  data_analise: string;
  meses_inativos: number;
  valor_perdido_acumulado: number;
  novo_valor_projeto: number | null;
  economia_potencial_12m: number | null;
  mensagem_sugerida: string;
  temperamento_detectado: string;
  dor_principal: string;
  urgencia_score: number;
  contexto_json: Record<string, any>;
  status: string;
  enviado_em: string | null;
  resultado: string | null;
  created_at: string;
  updated_at: string;
  lead?: {
    id: string;
    nome: string;
    telefone: string;
    email: string | null;
    lead_code: string;
  };
}

export function useReaquecimentoOportunidades(filters?: { status?: string }) {
  return useQuery({
    queryKey: ["reaquecimento-oportunidades", filters],
    queryFn: async () => {
      let query = supabase
        .from("reaquecimento_oportunidades")
        .select("*, lead:leads(id, nome, telefone, email, lead_code)")
        .order("urgencia_score", { ascending: false });

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query.limit(200);
      if (error) throw error;
      return data as ReaquecimentoOportunidade[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useUpdateReaquecimentoStatus() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: Record<string, any> = { status };
      if (status === "enviado") payload.enviado_em = new Date().toISOString();

      const { error } = await supabase
        .from("reaquecimento_oportunidades")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaquecimento-oportunidades"] });
    },
  });
}

export function useRunReaquecimentoManual() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { data, error } = await supabase.functions.invoke("reaquecimento-analyzer", {
        body: { tenant_id: tenantId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reaquecimento-oportunidades"] });
      qc.invalidateQueries({ queryKey: ["intelligence-alerts"] });
    },
  });
}
