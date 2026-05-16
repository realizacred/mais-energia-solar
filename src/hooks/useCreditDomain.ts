import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type CreditSimulationStatus = 
  | 'rascunho'
  | 'simulada'
  | 'descartada'
  | 'convertida_em_analise';

export type CreditAnalysisStatus = 
  | 'pendente_documentos'
  | 'pronto_para_envio'
  | 'enviada_ao_banco'
  | 'em_analise'
  | 'pendencia_bancaria'
  | 'aprovada'
  | 'reprovada'
  | 'cancelada';

export interface CreditSimulation {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  lead_id: string | null;
  cliente_nome: string | null;
  cpf_cnpj: string | null;
  tipo_pessoa: 'pf' | 'pj' | null;
  renda_mensal: number | null;
  valor_solicitado: number | null;
  valor_entrada: number | null;
  prazo_meses: number | null;
  taxa_juros_estimada: number | null;
  banco_id: string | null;
  status: CreditSimulationStatus;
  snapshot_proposta: any;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditAnalysis {
  id: string;
  tenant_id: string;
  deal_id: string | null;
  lead_id: string | null;
  simulation_id: string | null;
  status: CreditAnalysisStatus | string;
  cpf_cnpj: string | null;
  tipo_pessoa: string | null;
  renda_mensal: number | null;
  valor_solicitado: number | null;
  valor_aprovado: number | null;
  prazo_meses: number | null;
  banco: string | null;
  bank_config_id: string | null;
  protocolo_banco: string | null;
  data_envio: string | null;
  data_retorno: string | null;
  sla_vencimento: string | null;
  status_detalhado: string | null;
  observacoes: string | null;
  version: number;
  is_locked: boolean;
  checklist_snapshot: any;
  created_at: string;
  updated_at: string;
}

export interface CreditEvent {
  id: string;
  tenant_id: string;
  analise_id: string | null;
  simulation_id: string | null;
  projeto_id: string | null;
  event_type: string;
  actor_id: string | null;
  status_anterior: string | null;
  status_novo: string | null;
  payload: any;
  observacoes: string | null;
  created_at: string;
  actor?: { nome: string | null };
}

// Hooks for Simulations
export function useCreditSimulations(projectId?: string | null) {
  return useQuery({
    queryKey: ["credit-simulations", projectId],
    queryFn: async () => {
      let query = supabase
        .from("credit_simulations")
        .select("*")
        .order("created_at", { ascending: false });

      if (projectId) query = query.eq("projeto_id", projectId);

      const { data, error } = await query;
      if (error) throw error;
      return data as CreditSimulation[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCreditSimulation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<CreditSimulation> & { idempotency_key?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", user.id).single();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const correlation_id = crypto.randomUUID();
      const idempotency_key = values.idempotency_key || `sim_${Date.now()}_${user.id}`;

      const { data, error } = await supabase
        .from("credit_simulations")
        .insert({
          ...values,
          tenant_id: profile.tenant_id,
          criado_por: user.id
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Log Event with Bank Operations Core standards
      await supabase.from("credit_analysis_events").insert({
        tenant_id: profile.tenant_id,
        simulation_id: data.id,
        projeto_id: data.projeto_id,
        event_type: 'simulation_created',
        actor_id: user.id,
        status_novo: data.status,
        payload: data,
        correlation_id,
        idempotency_key: `evt_${idempotency_key}`
      } as any);

      return { ...data, correlation_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-simulations"] });
      toast({ title: "Simulação criada com sucesso" });
    }
  });
}

export function useConvertSimulationToAnalysis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (simulationId: string) => {
      const correlation_id = crypto.randomUUID();
      
      const { data: sim, error: simError } = await supabase
        .from("credit_simulations")
        .select("*")
        .eq("id", simulationId)
        .single();
      
      if (simError || !sim) throw new Error("Simulação não encontrada");

      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: analysis, error: anaError } = await supabase
        .from("analise_credito")
        .insert({
          tenant_id: sim.tenant_id,
          simulation_id: sim.id,
          deal_id: sim.projeto_id,
          lead_id: sim.lead_id,
          status: 'pendente_documentos',
          cpf_cnpj: sim.cpf_cnpj,
          tipo_pessoa: sim.tipo_pessoa,
          renda_mensal: sim.renda_mensal,
          valor_solicitado: sim.valor_solicitado,
          prazo_meses: sim.prazo_meses,
          bank_config_id: sim.banco_id,
          criado_por: user?.id,
          updated_at: new Date().toISOString()
        } as any)
        .select()
        .single();

      if (anaError) throw anaError;

      await supabase
        .from("credit_simulations")
        .update({ status: 'convertida_em_analise' } as any)
        .eq("id", sim.id);

      // Log Event with Correlation and Idempotency
      await supabase.from("credit_analysis_events").insert({
        tenant_id: sim.tenant_id,
        analise_id: analysis.id,
        simulation_id: sim.id,
        projeto_id: sim.projeto_id,
        event_type: 'analysis_created',
        actor_id: user?.id,
        status_novo: 'pendente_documentos',
        payload: { simulation: sim, analysis },
        correlation_id,
        idempotency_key: `conv_${simulationId}`
      } as any);

      return { ...analysis, correlation_id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-simulations"] });
      queryClient.invalidateQueries({ queryKey: ["analise-credito"] });
      toast({ title: "Conversão concluída com sucesso" });
    }
  });
}

// Status Engine Helper
export function resolveCreditAnalysisStatus(analysis: Partial<CreditAnalysis>, docs: any[], checklist: any[]): CreditAnalysisStatus {
  if (analysis.status === 'rascunho') return 'pendente_documentos' as any;
  
  const requiredDocs = checklist.filter(item => item.is_required);
  const linkedDocsCount = docs.filter(doc => requiredDocs.some(req => req.id === doc.checklist_item_id)).length;
  
  if (linkedDocsCount < requiredDocs.length) return 'pendente_documentos';
  if (!analysis.banco || !analysis.bank_config_id) return 'pendente_documentos';
  
  if (analysis.protocolo_banco) return 'enviada_ao_banco';
  
  return analysis.status as CreditAnalysisStatus;
}

export function useCreditOperationJobs(analysisId?: string) {
  return useQuery({
    queryKey: ["credit-operation-jobs", analysisId],
    queryFn: async () => {
      let query = supabase
        .from("credit_operation_jobs")
        .select("*")
        .order("created_at", { ascending: false });

      if (analysisId) query = query.eq("analysis_id", analysisId);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000, // Refresh every 10s for async status tracking
  });
}

export function useCreditMetrics() {
  return useQuery({
    queryKey: ["credit-metrics"],
    queryFn: async () => {
      const { data: jobs, error: jobsError } = await supabase
        .from("credit_operation_jobs")
        .select("status, operation_type, attempts");

      const { data: events, error: eventsError } = await supabase
        .from("credit_analysis_events")
        .select("event_type");

      const { data: analyses, error: anaError } = await supabase
        .from("analise_credito")
        .select("sla_vencimento, status")
        .not("sla_vencimento", "is", null);

      if (jobsError || eventsError || anaError) throw jobsError || eventsError || anaError;

      const now = new Date();
      const metrics = {
        pendingJobs: jobs?.filter(j => j.status === 'pending').length || 0,
        failedJobs: jobs?.filter(j => j.status === 'failed').length || 0,
        retries: jobs?.reduce((acc, j) => acc + (j.attempts || 0), 0) || 0,
        expiredSLA: analyses?.filter(a => new Date(a.sla_vencimento!) < now && !['aprovada', 'reprovada', 'cancelada'].includes(a.status)).length || 0,
        eventCounts: (events || []).reduce((acc: any, e) => {
          acc[e.event_type] = (acc[e.event_type] || 0) + 1;
          return acc;
        }, {}),
      };

      return metrics;
    },
  });
}

export function useCreditWorkflowConfig(bankSlug: string) {
  return useQuery({
    queryKey: ["credit-workflow-config", bankSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_workflow_configs")
        .select("*")
        .eq("bank_slug", bankSlug)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!bankSlug,
  });
}
