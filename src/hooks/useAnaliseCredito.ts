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
  | 'cancelado'
  | 'pendente'; 

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
  bank_config_id?: string | null;
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
  version: number;
  is_locked: boolean;
  checklist_snapshot: any;
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
  } | null;
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

      const correlation_id = crypto.randomUUID();
      const insertData = {
        ...values,
        tenant_id: profile.tenant_id,
        criado_por: user.id,
        status: values.status || 'rascunho',
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from("analise_credito")
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      // 1. Log creation event with correlation
      await supabase.from("credit_analysis_events").insert({
        tenant_id: profile.tenant_id,
        analise_id: data.id,
        event_type: 'analysis_created',
        actor_id: user.id,
        status_novo: data.status,
        payload: data,
        correlation_id,
        idempotency_key: `create_analise_${data.id}`
      } as any);

      // 2. Notify finance managers (DA-48, status engine)
      if (data.status !== 'rascunho') {
        try {
          await supabase.rpc('create_notification' as any, {
            p_tenant_id: profile.tenant_id,
            p_title: "Nova Solicitação de Crédito",
            p_message: `Uma nova análise de crédito foi iniciada para o cliente com CPF/CNPJ ${data.cpf_cnpj}.`,
            p_type: "credit_request",
            p_severity: "info",
            p_metadata: { analise_id: data.id, deal_id: data.deal_id },
            p_roles_permitidos: ["admin", "gerente", "super_admin"]
          });
        } catch (nErr) {
          console.warn("Falha ao enviar notificação de crédito:", nErr);
        }
      }

      return { ...data, correlation_id };
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
    mutationFn: async ({ id, version, ...values }: Partial<AnaliseCredito> & { id: string; version?: number; correlation_id?: string }) => {
      const correlation_id = values.correlation_id || crypto.randomUUID();
      
      // First check if it's locked
      const { data: current } = await supabase
        .from("analise_credito")
        .select("status, is_locked, version, tenant_id")
        .eq("id", id)
        .single();

      if (current?.is_locked) {
        throw new Error("Esta análise está bloqueada para alterações pois já foi finalizada ou enviada.");
      }

      const updateQuery = supabase
        .from("analise_credito")
        .update({ ...values, updated_at: new Date().toISOString() } as any)
        .eq("id", id);

      // Optimistic concurrency control
      if (version !== undefined) {
        updateQuery.eq("version", version);
      }

      const { data, error } = await updateQuery.select().single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error("Concorrência detectada: esta análise foi alterada por outro usuário. Recarregue a página.");
        }
        throw error;
      }

      // Log update event
      const { data: { user } } = await supabase.auth.getUser();
      if (values.status && values.status !== current?.status) {
        await supabase.from("credit_analysis_events").insert({
          tenant_id: current?.tenant_id,
          analise_id: id,
          event_type: 'status_changed',
          actor_id: user?.id,
          status_anterior: current?.status,
          status_novo: values.status,
          payload: values,
          correlation_id,
          idempotency_key: `update_status_${id}_${Date.now()}`
        } as any);

        // Notify if becoming active request
        if (values.status === 'pendente_documentos' && current?.status === 'rascunho') {
          await supabase.from("notifications").insert({
            tenant_id: current?.tenant_id,
            title: "Solicitação de Crédito Enviada",
            message: `A análise de crédito ${id} foi enviada para conferência documental.`,
            type: "credit_request",
            severity: "info",
            metadata: { analise_id: id },
            roles_permitidos: ["admin", "gerente", "super_admin"]
          } as any);
        }
      }

      return { ...data, correlation_id };
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito"] });
      queryClient.invalidateQueries({ queryKey: ["analise-credito", data.id] });
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
        .from("credit_analysis_events")
        .select("*, actor:profiles(nome)")
        .eq("analise_id", analiseId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Adapt field names if necessary for frontend compatibility
      return (data || []).map(e => ({
        ...e,
        analise_credito_id: e.analise_id
      })) as any as AnaliseCreditoHistorico[];
    },
    enabled: !!analiseId,
  });
}

export function useAnaliseCreditoDocumentos(analiseId?: string) {
  return useQuery({
    queryKey: ["analise-credito-documentos", analiseId],
    queryFn: async () => {
      if (!analiseId) return [];
      const { data, error } = await supabase
        .from("analise_credito_documentos")
        .select("*, document:project_documents(*)")
        .eq("analise_credito_id", analiseId);

      if (error) throw error;
      return data as any;
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
      // Check lock state first
      const { data: current } = await supabase
        .from("analise_credito")
        .select("status, is_locked")
        .eq("id", analise_credito_id)
        .single();

      if (current?.is_locked || ['enviada_ao_banco', 'aprovada', 'reprovada'].includes(current?.status || '')) {
        throw new Error("Não é permitido alterar documentos de uma análise bloqueada ou enviada.");
      }

      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user?.id).single();
      
      const upsertData = {
        tenant_id: profile?.tenant_id,
        analise_credito_id,
        project_document_id,
        checklist_item_id
      };

      const { data, error } = await supabase
        .from("analise_credito_documentos")
        .upsert(upsertData as any, { onConflict: 'analise_credito_id,project_document_id' })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["analise-credito-documentos", vars.analise_credito_id] });
      toast({ title: "Documento vinculado com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao vincular documento",
        description: error.message,
        variant: "destructive",
      });
    }
  });
}
