import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type AnaliseCreditoStatus = 
  | 'rascunho'
  | 'pendente_documentos'
  | 'pronto_para_envio'
  | 'enviada_ao_banco'
  | 'em_analise'
  | 'aprovado'
  | 'aprovado_com_condicoes'
  | 'reprovado'
  | 'cancelado';

export interface AnaliseCredito {
  id: string;
  tenant_id: string;
  cliente_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  status: AnaliseCreditoStatus;
  cpf_cnpj: string | null;
  tipo_pessoa: string | null;
  renda_mensal: number | null;
  entrada: number | null;
  score_credito: number | null;
  banco: string | null;
  bank_config_id: string | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
  prazo_meses: number | null;
  taxa_juros: number | null;
  protocolo_banco: string | null;
  data_envio: string | null;
  data_retorno: string | null;
  responsavel_id: string | null;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface AnaliseCreditoHistorico {
  id: string;
  analise_credito_id: string;
  status_anterior: string | null;
  status_novo: string;
  actor_id: string | null;
  observacoes: string | null;
  created_at: string;
  actor?: {
    nome: string | null;
  };
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

export function useAnaliseCreditoById(id: string) {
  return useQuery({
    queryKey: ["analise-credito", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as AnaliseCredito;
    },
    enabled: !!id,
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
          status: values.status || 'rascunho'
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito"] });
      toast({ title: "Análise de crédito iniciada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao iniciar análise",
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

export function useAnaliseCreditoHistorico(analiseId: string) {
  return useQuery({
    queryKey: ["analise-credito-historico", analiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito_historico")
        .select("*, actor:profiles(nome)")
        .eq("analise_credito_id", analiseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AnaliseCreditoHistorico[];
    },
    enabled: !!analiseId,
  });
}

export function useAnaliseCreditoDocumentos(analiseId: string) {
  return useQuery({
    queryKey: ["analise-credito-documentos", analiseId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito_documentos")
        .select("*, document:project_documents(*)")
        .eq("analise_credito_id", analiseId);

      if (error) throw error;
      return data;
    },
    enabled: !!analiseId,
  });
}

export function useVincularDocumentoCredito() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      analise_credito_id, 
      project_document_id, 
      checklist_item_id 
    }: { 
      analise_credito_id: string; 
      project_document_id: string; 
      checklist_item_id?: string 
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      
      const { data, error } = await supabase
        .from("analise_credito_documentos")
        .upsert({
          tenant_id: profile?.tenant_id,
          analise_credito_id,
          project_document_id,
          checklist_item_id
        }, { onConflict: 'analise_credito_id,project_document_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito-documentos", vars.analise_credito_id] });
    }
  });
}
