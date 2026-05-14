import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface AnaliseCredito {
  id: string;
  tenant_id: string;
  cliente_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  status: 'pendente' | 'em_analise' | 'aprovado' | 'reprovado' | 'cancelado';
  cpf_cnpj: string | null;
  renda_mensal: number | null;
  score_credito: number | null;
  banco: string | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
  prazo_meses: number | null;
  taxa_juros: number | null;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export function useAnaliseCredito(dealId?: string | null, leadId?: string | null) {
  return useQuery({
    queryKey: ["analise-credito", dealId, leadId],
    queryFn: async () => {
      let query = supabase
        .from("analise_credito")
        .select("*")
        .order("created_at", { ascending: false });

      if (dealId) {
        query = query.eq("deal_id", dealId);
      } else if (leadId) {
        query = query.eq("lead_id", leadId);
      } else {
        return [];
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AnaliseCredito[];
    },
    enabled: !!(dealId || leadId),
  });
}

export function useCreateAnaliseCredito() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<AnaliseCredito>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const { data, error } = await supabase
        .from("analise_credito")
        .insert({
          ...values,
          tenant_id: profile.tenant_id,
          criado_por: user.id,
          status: 'pendente'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito"] });
      toast({ title: "Solicitação de crédito enviada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao solicitar crédito",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateAnaliseCredito() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<AnaliseCredito> & { id: string }) => {
      const { data, error } = await supabase
        .from("analise_credito")
        .update(values)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito"] });
      if (data.deal_id) {
        queryClient.invalidateQueries({ queryKey: ["projeto-detalhe", data.deal_id] });
      }
      toast({ title: "Análise de crédito atualizada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar análise",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
