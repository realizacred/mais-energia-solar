/**
 * Hook read-only para a Central de Recuperação Comercial (/admin/followup-comercial).
 * Reaproveita: vw_proposal_followup_inbox + RPC get_followup_kpis (Phase 0).
 * RB-76: não duplicar — view já consolida propostas + versões + atividade + memória.
 */
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type FollowupClasse =
  | "sem_resposta"
  | "visualizada_sem_retorno"
  | "esquecida"
  | "negociacao_quente"
  | "outro";

export interface FollowupInboxRow {
  proposta_id: string;
  versao_id: string | null;
  versao_numero: number | null;
  titulo: string | null;
  codigo: string | null;
  status: string | null;
  is_principal: boolean | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  telefone_normalized: string | null;
  consultor_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  tenant_id: string | null;
  valor_total: number | null;
  potencia_kwp: number | null;
  enviada_at: string | null;
  aceita_at: string | null;
  recusada_at: string | null;
  valido_ate: string | null;
  primeiro_acesso_em: string | null;
  ultimo_acesso_em: string | null;
  total_aberturas: number | null;
  versao_viewed_at: string | null;
  status_visualizacao: string | null;
  ultimo_followup_em: string | null;
  qtd_followups: number | null;
  ultimo_canal: string | null;
  ultimo_outcome: string | null;
  ultima_mensagem: string | null;
  bloqueado_ate: string | null;
  temperatura: string | null;
  score_ia: number | null;
  objecao_principal: string | null;
  sugestao_ia: string | null;
  proxima_acao_em: string | null;
  classe_followup: FollowupClasse | string | null;
  dias_parado: number | null;
  ultima_atividade_em: string | null;
  projeto_id: string | null;
}

export interface FollowupKpis {
  sem_resposta: number;
  visualizadas_sem_retorno: number;
  esquecidas_30d: number;
  esquecidas_60d: number;
  esquecidas_90d: number;
  quentes: number;
  frias: number;
  followups_pendentes: number;
  recuperadas_30d: number;
}

export function useFollowupComercialKpis() {
  return useQuery({
    queryKey: ["followup-comercial-kpis"],
    queryFn: async (): Promise<FollowupKpis> => {
      const { data, error } = await supabase.rpc("get_followup_kpis");
      if (error) throw error;
      const k = (data ?? {}) as Record<string, number>;
      return {
        sem_resposta: Number(k.sem_resposta ?? 0),
        visualizadas_sem_retorno: Number(k.visualizadas_sem_retorno ?? 0),
        esquecidas_30d: Number(k.esquecidas_30d ?? 0),
        esquecidas_60d: Number(k.esquecidas_60d ?? 0),
        esquecidas_90d: Number(k.esquecidas_90d ?? 0),
        quentes: Number(k.quentes ?? 0),
        frias: Number(k.frias ?? 0),
        followups_pendentes: Number(k.followups_pendentes ?? 0),
        recuperadas_30d: Number(k.recuperadas_30d ?? 0),
      };
    },
    staleTime: 60 * 1000,
  });
}

export type FollowupInboxSort =
  | "dias_parado"
  | "score_ia"
  | "valor_total"
  | "ultima_atividade";

export interface FollowupInboxFilters {
  classe?: FollowupClasse | "todos";
  consultorId?: string | null;
  diasMin?: number | null;
  search?: string | null;
  sort?: FollowupInboxSort;
}

const PAGE_SIZE = 50;

function sortKeyFromRow(row: FollowupInboxRow, sort: FollowupInboxSort): number | null {
  switch (sort) {
    case "score_ia":
      return row.score_ia == null ? null : Number(row.score_ia);
    case "valor_total":
      return row.valor_total == null ? null : Number(row.valor_total);
    case "ultima_atividade":
      return row.ultima_atividade_em ? new Date(row.ultima_atividade_em).getTime() / 1000 : null;
    case "dias_parado":
    default:
      return row.dias_parado == null ? null : Number(row.dias_parado);
  }
}

/**
 * Inbox paginada por cursor. Reaproveita RPC get_followup_inbox_page.
 * Página de até 50 linhas; UI usa fetchNextPage para lazy-load.
 */
export function useFollowupComercialInbox(filters: FollowupInboxFilters = {}) {
  const sort: FollowupInboxSort = filters.sort ?? "dias_parado";
  return useInfiniteQuery({
    queryKey: ["followup-comercial-inbox", { ...filters, sort }],
    initialPageParam: { value: null as number | null, id: null as string | null },
    queryFn: async ({ pageParam }): Promise<FollowupInboxRow[]> => {
      const { data: { user } } = await supabase.auth.getUser();
      const p_consultor_id = filters.consultorId || (user?.id);

      const { data, error } = await supabase.rpc("get_followup_inbox_page", {
        p_classe: filters.classe && filters.classe !== "todos" ? filters.classe : null,
        p_consultor_id,
        p_dias_min: filters.diasMin && filters.diasMin > 0 ? filters.diasMin : null,
        p_search: filters.search && filters.search.trim().length >= 2 ? filters.search.trim() : null,
        p_sort: sort,
        p_cursor_value: pageParam.value,
        p_cursor_id: pageParam.id,
        p_page_size: PAGE_SIZE,
      });
      if (error) throw error;
      return (data ?? []) as FollowupInboxRow[];
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      const last = lastPage[lastPage.length - 1];
      return { value: sortKeyFromRow(last, sort), id: last.proposta_id };
    },
    staleTime: 30 * 1000,
  });
}

export interface FollowupInboxSummary {
  total_count: number;
  valor_potencial_total: number;
  dias_parado_p50: number;
  dias_parado_p90: number;
}

/**
 * Sumário real (server-side) com os MESMOS filtros da inbox.
 * Total e valor potencial NUNCA são derivados do que está renderizado.
 */
export function useFollowupComercialInboxSummary(filters: FollowupInboxFilters = {}) {
  return useQuery({
    queryKey: ["followup-comercial-inbox-summary", filters],
    queryFn: async (): Promise<FollowupInboxSummary> => {
      const { data: { user } } = await supabase.auth.getUser();
      const p_consultor_id = filters.consultorId || (user?.id);

      const { data, error } = await supabase.rpc("get_followup_inbox_summary", {
        p_classe: filters.classe && filters.classe !== "todos" ? filters.classe : null,
        p_consultor_id,
        p_dias_min: filters.diasMin && filters.diasMin > 0 ? filters.diasMin : null,
        p_search: filters.search && filters.search.trim().length >= 2 ? filters.search.trim() : null,
      });
      if (error) throw error;
      const s = (data ?? {}) as Record<string, number>;
      return {
        total_count: Number(s.total_count ?? 0),
        valor_potencial_total: Number(s.valor_potencial_total ?? 0),
        dias_parado_p50: Number(s.dias_parado_p50 ?? 0),
        dias_parado_p90: Number(s.dias_parado_p90 ?? 0),
      };
    },
    staleTime: 30 * 1000,
  });
}

// =====================================================================
// Phase 2 — Envio manual com guardrails
// =====================================================================

export interface SendFollowupInput {
  proposta_id: string;
  versao_id?: string | null;
  message: string;
  channel?: "whatsapp";
  force?: boolean;
  force_reason?: string;
}

export interface SendFollowupResult {
  success: true;
  attempt_id: string;
  attempt_number: number;
  delivery_status: "queued";
  locked_until: string;
  sent_today: number;
  daily_cap: number;
  instance_id: string;
  bypassed_guardrails: string[];
}

export class FollowupSendError extends Error {
  code: string;
  detail?: string;
  meta?: Record<string, unknown>;
  constructor(code: string, message: string, meta?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.meta = meta;
  }
}

const errorCopy: Record<string, string> = {
  opted_out: "Cliente optou por não receber este canal (LGPD). Não pode ser forçado.",
  cooldown_active: "Cooldown ativo — aguarde antes de reenviar.",
  daily_cap_reached: "Limite diário de envios atingido para este canal.",
  max_attempts_reached: "Máximo de tentativas atingido para esta proposta.",
  force_max_attempts_requires_manager: "Apenas gerente/admin pode forçar acima do máximo de tentativas.",
  force_daily_cap_requires_admin: "Apenas admin pode forçar acima do limite diário.",
  force_reason_required: "Justificativa obrigatória para envio forçado (mín. 5 caracteres).",
  forbidden_role: "Você não tem permissão para enviar follow-up.",
  tenant_mismatch: "Proposta pertence a outro tenant.",
  duplicate_attempt: "Já existe um envio em andamento para esta proposta.",
  no_wa_instance_connected: "Nenhuma instância WhatsApp conectada.",
  telefone_missing: "Cliente sem telefone normalizado.",
  cliente_missing: "Proposta sem cliente vinculado.",
  message_too_short: "Mensagem precisa de pelo menos 5 caracteres.",
  message_too_long: "Mensagem muito longa (máx. 2000 caracteres).",
  enqueue_failed: "Falha ao enfileirar mensagem no WhatsApp.",
};

// =====================================================================
// Phase 3 — Sugestão IA (reutiliza ai-followup-intelligence, RB-76)
// =====================================================================

export interface FollowupAiScoreBreakdown {
  engajamento: number;
  urgencia_temporal: number;
  valor: number;
  risco: number;
}

export interface FollowupAiSuggestion {
  deve_fazer_followup: boolean;
  nivel_urgencia: "baixo" | "medio" | "alto";
  motivo: string;
  mensagem_sugerida: string;
  risco: "baixo" | "medio" | "alto";
  precisa_revisao_humana: boolean;
  // Phase 4C — score refinado (efêmero, não persistido por proposta)
  score_total?: number;
  score_breakdown?: FollowupAiScoreBreakdown;
  razoes?: string[];
  acao_recomendada?: string;
}

export function useFollowupAiSuggestion() {
  return useMutation<FollowupAiSuggestion, Error, FollowupInboxRow>({
    mutationFn: async (row) => {
      const dias = row.dias_parado ?? 0;
      const cenario =
        dias > 60 ? "esquecida_60d_mais"
        : dias > 30 ? "esquecida_30d"
        : (row.total_aberturas ?? 0) > 0 ? "visualizada_sem_retorno"
        : "sem_resposta";

      const { data, error } = await supabase.functions.invoke("ai-followup-intelligence", {
        body: {
          type: "proposal_followup",
          cenario,
          proposal_context: {
            cliente_nome: row.cliente_nome,
            valor_total: row.valor_total,
            potencia_kwp: row.potencia_kwp,
            status_proposta: row.status,
            enviado_em: row.enviada_at,
            viewed_at: row.versao_viewed_at,
            valido_ate: row.valido_ate,
            dias_sem_resposta: dias,
            // Phase 4C — enriquecimento (whitelist server-side)
            tentativas_anteriores: row.qtd_followups ?? 0,
            ultimo_canal: row.ultimo_canal,
            ultimo_outcome: row.ultimo_outcome,
            total_aberturas: row.total_aberturas ?? 0,
          },
        },
      });
      if (error) {
        let payload: any = null;
        try { payload = (error as any).context?.body ? JSON.parse((error as any).context.body) : null; } catch { /* ignore */ }
        const msg = payload?.error ?? error.message ?? "Falha ao gerar sugestão";
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data as FollowupAiSuggestion;
    },
    onError: (err) => {
      toast.error(err.message || "Falha ao gerar sugestão IA");
    },
  });
}

export function useSendProposalFollowup() {
  const qc = useQueryClient();
  return useMutation<SendFollowupResult, FollowupSendError, SendFollowupInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke("proposal-followup-send", {
        body: { channel: "whatsapp", ...input },
      });
      if (error) {
        // supabase-js wraps non-2xx into FunctionsHttpError; try to read context
        let payload: any = null;
        try { payload = (error as any).context?.body ? JSON.parse((error as any).context.body) : null; } catch { /* ignore */ }
        const code = payload?.error ?? "unknown_error";
        throw new FollowupSendError(code, errorCopy[code] ?? error.message, payload);
      }
      if (data?.error) {
        throw new FollowupSendError(data.error, errorCopy[data.error] ?? data.error, data);
      }
      return data as SendFollowupResult;
    },
    onSuccess: () => {
      toast.success("Follow-up enfileirado — aguardando confirmação do WhatsApp.");
      qc.invalidateQueries({ queryKey: ["followup-comercial-inbox"] });
      qc.invalidateQueries({ queryKey: ["followup-comercial-kpis"] });
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });
}
