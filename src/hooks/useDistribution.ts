import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

// ── Types ─────────────────────────────────────────────
export interface DistributionRule {
  id: string;
  tenant_id: string | null;
  nome: string;
  tipo: string; // 'round_robin' | 'manual' | 'regiao' | 'capacidade'
  config: Record<string, any>;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface DistributionLog {
  id: string;
  tenant_id: string | null;
  lead_id: string;
  consultor_id: string;
  consultor_anterior_id: string | null;
  rule_id: string | null;
  motivo: string | null;
  distribuido_em: string | null;
  distribuido_por: string | null;
  lead?: { nome: string; lead_code: string | null };
  consultor?: { nome: string };
}

export interface SlaBreach {
  id: string;
  tenant_id: string | null;
  lead_id: string;
  consultor_id: string | null;
  sla_rule_id: string | null;
  tipo: string;
  minutos_limite: number;
  minutos_real: number | null;
  escalado: boolean;
  escalado_para: string | null;
  resolvido: boolean;
  resolvido_em: string | null;
  created_at: string | null;
  lead?: { nome: string; lead_code: string | null; telefone: string };
  vendedor?: { nome: string };
}

export interface MotivoPerda {
  id: string;
  tenant_id: string | null;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string | null;
}

// ── Distribution Rules Hook ──────────────────────────
export function useDistributionRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const rulesQuery = useQuery({
    queryKey: ["distribution-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_distribution_rules")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as DistributionRule[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsertRule = useMutation({
    mutationFn: async (rule: Partial<DistributionRule> & { nome: string; tipo: string }) => {
      if (rule.id) {
        const { error } = await supabase
          .from("lead_distribution_rules")
          .update(rule)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("lead_distribution_rules").insert(rule);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-rules"] });
      toast({ title: "Regra salva" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteRule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("lead_distribution_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["distribution-rules"] });
      toast({ title: "Regra excluída" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return {
    rules: rulesQuery.data || [],
    loading: rulesQuery.isLoading,
    upsertRule: upsertRule.mutateAsync,
    deleteRule: deleteRule.mutate,
  };
}

// ── Distribution Log Hook ────────────────────────────
export function useDistributionLog(limit = 50) {
  return useQuery({
    queryKey: ["distribution-log", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_distribution_log")
        .select("*, lead:leads(nome, lead_code), consultor:consultores(nome)")
        .order("distribuido_em", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as unknown as DistributionLog[];
    },
    staleTime: 30 * 1000,
  });
}

// ── SLA Breaches Hook ────────────────────────────────
export function useSlaBreaches() {
  return useQuery({
    queryKey: ["sla-breaches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sla_breaches")
        .select("*, lead:leads(nome, lead_code, telefone), consultor:consultores(nome)")
        .eq("resolvido", false)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as unknown as SlaBreach[];
    },
    staleTime: 30 * 1000,
  });
}

// ── Assign Lead to Vendor (distribution) ─────────────
export function useAssignLead() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      vendedorId,
      vendedorNome,
      motivo,
      ruleId,
      vendedorAnteriorId,
    }: {
      leadId: string;
      vendedorId: string;
      vendedorNome: string;
      motivo?: string;
      ruleId?: string;
      vendedorAnteriorId?: string | null;
    }) => {
      // 1. Update lead with consultor_id + consultor (name for backwards compat)
      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          consultor_id: vendedorId,
          consultor: vendedorNome,
          distribuido_em: new Date().toISOString(),
        })
        .eq("id", leadId);
      if (leadErr) throw leadErr;

      // 2. Log the distribution
      const { error: logErr } = await supabase
        .from("lead_distribution_log")
        .insert({
          lead_id: leadId,
          consultor_id: vendedorId,
          consultor_anterior_id: vendedorAnteriorId || null,
          rule_id: ruleId || null,
          motivo: motivo || "manual",
          distribuido_por: user?.id || null,
        });
      if (logErr) console.error("Log error:", logErr);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      queryClient.invalidateQueries({ queryKey: ["distribution-log"] });
      toast({ title: "Lead distribuído com sucesso" });
    },
    onError: (err: any) => {
      toast({ title: "Erro na distribuição", description: err.message, variant: "destructive" });
    },
  });
}

// ── Motivos de Perda Hook ────────────────────────────
export function useMotivosPerda() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["motivos-perda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as MotivoPerda[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const upsert = useMutation({
    mutationFn: async (motivo: Partial<MotivoPerda> & { nome: string }) => {
      if (motivo.id) {
        const { error } = await supabase.from("motivos_perda").update(motivo).eq("id", motivo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("motivos_perda").insert(motivo);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivos-perda"] });
      toast({ title: "Motivo salvo" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("motivos_perda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["motivos-perda"] });
      toast({ title: "Motivo excluído" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  return {
    motivos: query.data || [],
    loading: query.isLoading,
    upsert: upsert.mutateAsync,
    remove: remove.mutate,
  };
}

// ── Record Loss Reason ───────────────────────────────
export function useRecordLoss() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      leadId,
      motivoPerdaId,
      motivoPerdaObs,
      statusId,
    }: {
      leadId: string;
      motivoPerdaId: string;
      motivoPerdaObs?: string;
      statusId: string;
    }) => {
      const { error } = await supabase
        .from("leads")
        .update({
          motivo_perda_id: motivoPerdaId,
          motivo_perda_obs: motivoPerdaObs || null,
          status_id: statusId,
        })
        .eq("id", leadId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      toast({ title: "Motivo de perda registrado" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });
}
