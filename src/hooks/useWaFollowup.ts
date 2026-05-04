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
  kindFilter?: "all" | "propostas" | "conversas";
  cenarioFilter?: string;
}) {
  return useQuery({
    queryKey: [
      QUEUE_KEY,
      params.statusFilter,
      params.isAdmin,
      params.userId,
      params.kindFilter ?? "all",
      params.cenarioFilter ?? "all",
    ],
    queryFn: async () => {
      let query = supabase
        .from("wa_followup_queue")
        .select(`
          id, tenant_id, status, tentativa, scheduled_at, sent_at, responded_at,
          assigned_to, mensagem_enviada, mensagem_sugerida, ai_confidence, ai_reason,
          cenario, proposta_id, versao_id, proposal_context, metadata,
          conversation_id, created_at, updated_at,
          rule:wa_followup_rules(nome, cenario, prioridade, prazo_minutos)
        `)
        .order("scheduled_at", { ascending: true })
        .limit(100);

      if (params.statusFilter !== "all") {
        query = query.eq("status", params.statusFilter);
      }

      if (params.kindFilter === "propostas") {
        query = query.not("proposta_id", "is", null);
      } else if (params.kindFilter === "conversas") {
        query = query.is("proposta_id", null);
      }

      if (params.cenarioFilter && params.cenarioFilter !== "all") {
        query = query.eq("cenario", params.cenarioFilter);
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

// ─── Proposal Suggestion Review Mutations ───────────────────
// Revisão humana de sugestões de IA para follow-up por proposta.
// Reaproveita wa_followup_queue + wa_followup_logs. NÃO envia mensagens.

async function getTenantContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.id) throw new Error("Não autenticado");
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile?.tenant_id) throw new Error("Tenant não encontrado");
  return { tenantId: profile.tenant_id as string, userId: user.id };
}

async function logProposalAction(params: {
  tenantId: string;
  item: FollowupQueueItem;
  action: string;
  metadata?: Record<string, any>;
}) {
  try {
    await supabase.from("wa_followup_logs").insert({
      tenant_id: params.tenantId,
      conversation_id: params.item.conversation_id,
      rule_id: (params.item as any).rule_id ?? null,
      queue_id: params.item.id,
      action: params.action,
      cenario: params.item.cenario,
      tentativa: params.item.tentativa,
      assigned_to: params.item.assigned_to,
      proposta_id: params.item.proposta_id,
      versao_id: params.item.versao_id,
      proposal_context: params.item.proposal_context as any,
      mensagem_original: params.item.mensagem_sugerida,
      metadata: params.metadata ?? {},
    });
  } catch {
    // log é best-effort — nunca bloquear ação de revisão
  }
}

export function useEditProposalSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { item: FollowupQueueItem; mensagem: string }) => {
      const { tenantId } = await getTenantContext();
      const meta = { ...(params.item.metadata || {}), human_edited: true, edited_at: new Date().toISOString() };
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .update({ mensagem_sugerida: params.mensagem, metadata: meta })
        .eq("id", params.item.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Item não encontrado");
      await logProposalAction({
        tenantId, item: params.item, action: "proposal_suggestion_edited",
        metadata: { edited_at: meta.edited_at },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUEUE_KEY] });
    },
  });
}

export function useRejectProposalSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { item: FollowupQueueItem; reason?: string }) => {
      const { tenantId } = await getTenantContext();
      const meta = {
        ...(params.item.metadata || {}),
        rejected_at: new Date().toISOString(),
        rejected_reason: params.reason || null,
      };
      // Status seguro do CHECK: 'cancelado'
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .update({ status: "cancelado", metadata: meta })
        .eq("id", params.item.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Item não encontrado");
      await logProposalAction({
        tenantId, item: params.item, action: "proposal_suggestion_rejected",
        metadata: { rejected_reason: params.reason || null },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUEUE_KEY] });
      qc.invalidateQueries({ queryKey: [QUEUE_STATS_KEY] });
    },
  });
}

export function usePostponeProposalSuggestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { item: FollowupQueueItem; scheduledAt: string; reason?: string }) => {
      const { tenantId } = await getTenantContext();
      const meta = {
        ...(params.item.metadata || {}),
        postponed_at: new Date().toISOString(),
        postponed_reason: params.reason || null,
      };
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .update({ scheduled_at: params.scheduledAt, metadata: meta })
        .eq("id", params.item.id)
        .eq("tenant_id", tenantId)
        .select("id")
        .single();
      if (error) throw error;
      if (!data) throw new Error("Item não encontrado");
      await logProposalAction({
        tenantId, item: params.item, action: "proposal_suggestion_postponed",
        metadata: { scheduled_at: params.scheduledAt, postponed_reason: params.reason || null },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUEUE_KEY] });
    },
  });
}
