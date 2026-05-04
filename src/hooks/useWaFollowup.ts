// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────

export type FollowupQueueItem = {
  id: string;
  tenant_id: string;
  status: string;
  tentativa: number;
  scheduled_at: string;
  sent_at: string | null;
  responded_at: string | null;
  assigned_to: string | null;
  mensagem_enviada: string | null;
  mensagem_sugerida: string | null;
  ai_confidence: number | null;
  ai_reason: string | null;
  cenario: string | null;
  proposta_id: string | null;
  versao_id: string | null;
  proposal_context: Record<string, any> | null;
  metadata: Record<string, any> | null;
  conversation_id: string;
  created_at: string;
  updated_at: string;
  rule: {
    nome: string;
    cenario: string;
    prioridade: string;
    prazo_minutos: number;
  } | null;
};

export type FollowupConversationInfo = {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  status: string;
  last_message_at: string | null;
};

export type FollowupMessagePreview = {
  id: string;
  content: string | null;
  direction: string;
  created_at: string;
  message_type: string | null;
};

export interface FollowupRule {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  cenario: string;
  prazo_minutos: number;
  prioridade: string;
  mensagem_template: string | null;
  envio_automatico: boolean;
  max_tentativas: number;
  status_conversa: string[] | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type FollowupRuleFormData = Omit<FollowupRule, "id" | "tenant_id" | "created_at" | "updated_at">;

export interface FollowupVendedor {
  id: string;
  nome: string;
  user_id: string | null;
}

// ─── Query Keys ─────────────────────────────────────────────

const QUEUE_KEY = "wa-followup-queue-page" as const;
const RULES_KEY = "wa-followup-rules" as const;
const QUEUE_STATS_KEY = "wa-followup-queue-stats" as const;
const VENDEDORES_KEY = "wa-followup-vendedores-page" as const;

// ─── Queue Page Hooks ───────────────────────────────────────

export function useFollowupQueue(params: {
  statusFilter: string;
  isAdmin: boolean;
  userId: string | undefined;
}) {
  return useQuery({
    queryKey: [QUEUE_KEY, params.statusFilter, params.isAdmin, params.userId],
    queryFn: async () => {
      let query = supabase
        .from("wa_followup_queue")
        .select(`
          id, status, tentativa, scheduled_at, sent_at, responded_at,
          assigned_to, mensagem_enviada, conversation_id, created_at,
          rule:wa_followup_rules(nome, cenario, prioridade, prazo_minutos)
        `)
        .order("scheduled_at", { ascending: true })
        .limit(100);

      if (params.statusFilter !== "all") {
        query = query.eq("status", params.statusFilter);
      }

      if (!params.isAdmin && params.userId) {
        query = query.eq("assigned_to", params.userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as FollowupQueueItem[];
    },
    staleTime: 15_000,
  });
}

export function useFollowupVendedores() {
  return useQuery({
    queryKey: [VENDEDORES_KEY],
    queryFn: async () => {
      const { data } = await supabase.from("consultores").select("id, nome, user_id").eq("ativo", true);
      return (data || []) as FollowupVendedor[];
    },
    staleTime: 60_000,
  });
}

export function useFollowupConversations(conversationIds: string[]) {
  return useQuery({
    queryKey: ["wa-followup-convs-page", conversationIds],
    queryFn: async () => {
      if (conversationIds.length === 0) return [];
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone, status, last_message_at")
        .in("id", conversationIds);
      return (data || []) as FollowupConversationInfo[];
    },
    enabled: conversationIds.length > 0,
    staleTime: 30_000,
  });
}

export function useFollowupDrawerMessages(conversationId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["followup-drawer-messages", conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const { data } = await supabase
        .from("wa_messages")
        .select("id, content, direction, created_at, message_type")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(30);
      return ((data || []) as FollowupMessagePreview[]).reverse();
    },
    enabled: !!conversationId && enabled,
  });
}

// ─── Rules Hooks ────────────────────────────────────────────

export function useFollowupRules() {
  return useQuery({
    queryKey: [RULES_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_rules")
        .select("id, tenant_id, nome, descricao, cenario, prazo_minutos, prioridade, mensagem_template, envio_automatico, max_tentativas, status_conversa, ativo, ordem, created_at, updated_at")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FollowupRule[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export function useFollowupQueueStats() {
  return useQuery({
    queryKey: [QUEUE_STATS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .select("status, rule_id");
      if (error) throw error;
      const pendentes = (data || []).filter((q) => q.status === "pendente").length;
      const enviados = (data || []).filter((q) => q.status === "enviado").length;
      const respondidos = (data || []).filter((q) => q.status === "respondido").length;
      return { pendentes, enviados, respondidos, total: data?.length || 0 };
    },
    staleTime: 1000 * 30,
  });
}

// ─── Mutations ──────────────────────────────────────────────

export function useProcessFollowupsNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-wa-followups");
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUEUE_STATS_KEY] });
      qc.invalidateQueries({ queryKey: ["wa-followup-pending-widget"] });
    },
  });
}

export function useSaveFollowupRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { rule?: FollowupRule; form: FollowupRuleFormData }) => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();
      const tenantId = profileData?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");

      if (params.rule) {
        const { error } = await supabase
          .from("wa_followup_rules")
          .update({
            nome: params.form.nome,
            descricao: params.form.descricao,
            cenario: params.form.cenario,
            prazo_minutos: params.form.prazo_minutos,
            prioridade: params.form.prioridade,
            mensagem_template: params.form.mensagem_template,
            envio_automatico: params.form.envio_automatico,
            max_tentativas: params.form.max_tentativas,
            status_conversa: params.form.status_conversa,
            ativo: params.form.ativo,
            ordem: params.form.ordem,
          })
          .eq("id", params.rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wa_followup_rules").insert([{
          tenant_id: tenantId,
          nome: params.form.nome,
          descricao: params.form.descricao,
          cenario: params.form.cenario,
          prazo_minutos: params.form.prazo_minutos,
          prioridade: params.form.prioridade,
          mensagem_template: params.form.mensagem_template,
          envio_automatico: params.form.envio_automatico,
          max_tentativas: params.form.max_tentativas,
          status_conversa: params.form.status_conversa,
          ativo: params.form.ativo,
          ordem: params.form.ordem,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
}

export function useDeleteFollowupRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wa_followup_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
}

export function useToggleFollowupRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("wa_followup_rules").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
}
