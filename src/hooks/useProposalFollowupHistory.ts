/**
 * Phase 4A — Histórico de tentativas de follow-up por proposta (somente leitura).
 *
 * Reaproveita: proposal_followup_attempts + proposal_followup_locks (RB-76).
 * RLS já isola por tenant_id; aqui só consultamos com filtro proposta_id.
 *
 * Não cria envio, não altera guardrails, não chama edge function.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupAttemptRow {
  id: string;
  tenant_id: string;
  proposta_id: string;
  versao_id: string | null;
  consultor_id: string | null;
  attempt_number: number;
  channel: string;
  mode: string | null;
  message_text: string | null;
  ai_generated: boolean | null;
  scheduled_for: string | null;
  sent_at: string | null;
  delivery_status: string;
  delivery_error: string | null;
  client_response_at: string | null;
  outcome: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, unknown> | null;
}

export interface FollowupLockRow {
  proposta_id: string;
  channel: string;
  tenant_id: string;
  locked_until: string;
  reason: string | null;
  last_message_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileMini {
  user_id: string;
  display_name: string | null;
  full_name: string | null;
}

export interface FollowupHistoryData {
  attempts: FollowupAttemptRow[];
  lock: FollowupLockRow | null;
  profiles: Record<string, ProfileMini>;
}

export function useProposalFollowupHistory(propostaId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["proposal-followup-history", propostaId],
    enabled: Boolean(propostaId) && enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<FollowupHistoryData> => {
      if (!propostaId) return { attempts: [], lock: null, profiles: {} };

      const [attemptsRes, lockRes] = await Promise.all([
        supabase
          .from("proposal_followup_attempts")
          .select(
            "id,tenant_id,proposta_id,versao_id,consultor_id,attempt_number,channel,mode,message_text,ai_generated,scheduled_for,sent_at,delivery_status,delivery_error,client_response_at,outcome,approved_by,created_at,updated_at,metadata"
          )
          .eq("proposta_id", propostaId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("proposal_followup_locks")
          .select("*")
          .eq("proposta_id", propostaId)
          .maybeSingle(),
      ]);

      if (attemptsRes.error) throw attemptsRes.error;
      // lock pode não existir — maybeSingle retorna data:null sem erro
      if (lockRes.error && lockRes.error.code !== "PGRST116") throw lockRes.error;

      const attempts = (attemptsRes.data ?? []) as FollowupAttemptRow[];
      const lock = (lockRes.data ?? null) as FollowupLockRow | null;

      // Profiles dos consultores e aprovadores
      const ids = new Set<string>();
      attempts.forEach((a) => {
        if (a.consultor_id) ids.add(a.consultor_id);
        if (a.approved_by) ids.add(a.approved_by);
      });

      let profiles: Record<string, ProfileMini> = {};
      if (ids.size > 0) {
        const { data: profData } = await supabase
          .from("profiles")
          .select("user_id,display_name,full_name")
          .in("user_id", Array.from(ids));
        profiles = Object.fromEntries(
          ((profData ?? []) as ProfileMini[]).map((p) => [p.user_id, p])
        );
      }

      return { attempts, lock, profiles };
    },
  });
}
