/**
 * Phase 4B — Analytics Comercial (somente leitura).
 *
 * Reaproveita (RB-76, sem novas tabelas / sem edge function):
 *  - proposal_followup_attempts
 *  - proposal_followup_locks
 *  - proposal_communication_optout
 *  - vw_proposal_followup_inbox
 *
 * Agrega no cliente: 1 query por tabela (limit 1000 cobre janelas usuais).
 * RLS já isola por tenant_id.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FollowupComercialAnalytics {
  // Top KPIs
  totalRecuperacao: number;
  valorPotencial: number;
  enviadosHoje: number;
  enviados7d: number;
  enviados30d: number;
  taxaSucesso: number;        // sent / total no período (%)
  taxaFalha: number;          // failed / total (%)
  taxaResposta: number;       // com client_response_at / sent (%)
  cooldownsAtivos: number;
  optOuts: number;
  forcedCount30d: number;
  diasParadoMedio: number;

  // Séries
  daily: Array<{ date: string; sent: number; failed: number; queued: number; responded: number }>;
  byStatus: Array<{ status: string; count: number }>;
  byMode: Array<{ mode: string; count: number }>;
  topConsultores: Array<{
    consultor_id: string;
    nome: string | null;
    total: number;
    sent: number;
    failed: number;
    forced: number;
    sucesso: number; // %
  }>;
}

const TZ = "America/Sao_Paulo";

function toLocalDate(iso: string): string {
  // YYYY-MM-DD em America/Sao_Paulo
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export function useFollowupComercialAnalytics() {
  return useQuery({
    queryKey: ["followup-comercial-analytics"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<FollowupComercialAnalytics> => {
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [attemptsRes, locksRes, optoutsRes, inboxRes, summaryRes] = await Promise.all([
        supabase
          .from("proposal_followup_attempts")
          .select(
            "id,consultor_id,delivery_status,mode,sent_at,client_response_at,created_at,metadata"
          )
          .gte("created_at", since30d)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("proposal_followup_locks")
          .select("proposta_id,locked_until")
          .gt("locked_until", new Date().toISOString())
          .limit(1000),
        supabase
          .from("proposal_communication_optout")
          .select("cliente_id", { count: "exact", head: true }),
        supabase
          .from("vw_proposal_followup_inbox")
          .select("dias_parado")
          .limit(1000),
        // Total real + valor potencial (sem limit — agregação SQL)
        supabase.rpc("get_followup_inbox_summary", {
          p_classe: null,
          p_consultor_id: null,
          p_dias_min: null,
          p_search: null,
        }),
      ]);

      if (attemptsRes.error) throw attemptsRes.error;
      if (locksRes.error) throw locksRes.error;
      if (optoutsRes.error) throw optoutsRes.error;
      if (inboxRes.error) throw inboxRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const attempts = attemptsRes.data ?? [];
      const inbox = inboxRes.data ?? [];
      const summary = (summaryRes.data ?? {}) as Record<string, number>;

      // Totais reais via RPC (não limitados a 1000)
      const totalRecuperacao = Number(summary.total_count ?? 0);
      const valorPotencial = Number(summary.valor_potencial_total ?? 0);
      // Média de dias_parado: amostra de até 1000 (suficiente para média estável)
      const diasArr = inbox
        .map((r: any) => Number(r.dias_parado))
        .filter((n) => Number.isFinite(n) && n >= 0);
      const diasParadoMedio = diasArr.length
        ? diasArr.reduce((a, b) => a + b, 0) / diasArr.length
        : 0;

      // Janelas
      const todayLocal = toLocalDate(new Date().toISOString());
      const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;

      let enviadosHoje = 0;
      let enviados7d = 0;
      let enviados30d = 0;
      let sentCount = 0;
      let failedCount = 0;
      let respondedCount = 0;
      let forcedCount30d = 0;

      const dailyMap = new Map<
        string,
        { sent: number; failed: number; queued: number; responded: number }
      >();
      const statusMap = new Map<string, number>();
      const modeMap = new Map<string, number>();
      const consultorMap = new Map<
        string,
        { total: number; sent: number; failed: number; forced: number }
      >();

      attempts.forEach((a: any) => {
        const status = a.delivery_status as string;
        statusMap.set(status, (statusMap.get(status) ?? 0) + 1);

        const mode = (a.mode ?? "manual") as string;
        modeMap.set(mode, (modeMap.get(mode) ?? 0) + 1);

        const isSent = status === "sent" || status === "delivered";
        const isFailed = status === "failed";
        const isQueued = status === "queued";
        const responded = Boolean(a.client_response_at);
        const forced = Boolean(a.metadata?.force);

        if (isSent) sentCount++;
        if (isFailed) failedCount++;
        if (responded) respondedCount++;
        if (forced) forcedCount30d++;

        const createdMs = new Date(a.created_at).getTime();
        const localDate = toLocalDate(a.created_at);

        if (isSent) {
          enviados30d++;
          if (createdMs >= since7d) enviados7d++;
          if (localDate === todayLocal) enviadosHoje++;
        }

        const bucket = dailyMap.get(localDate) ?? { sent: 0, failed: 0, queued: 0, responded: 0 };
        if (isSent) bucket.sent++;
        if (isFailed) bucket.failed++;
        if (isQueued) bucket.queued++;
        if (responded) bucket.responded++;
        dailyMap.set(localDate, bucket);

        if (a.consultor_id) {
          const c = consultorMap.get(a.consultor_id) ?? { total: 0, sent: 0, failed: 0, forced: 0 };
          c.total++;
          if (isSent) c.sent++;
          if (isFailed) c.failed++;
          if (forced) c.forced++;
          consultorMap.set(a.consultor_id, c);
        }
      });

      const totalAttempts = attempts.length;
      const taxaSucesso = totalAttempts ? (sentCount / totalAttempts) * 100 : 0;
      const taxaFalha = totalAttempts ? (failedCount / totalAttempts) * 100 : 0;
      const taxaResposta = sentCount ? (respondedCount / sentCount) * 100 : 0;

      // Daily — preencher 30 dias (timeline contínua)
      const daily: FollowupComercialAnalytics["daily"] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = toLocalDate(d.toISOString());
        const v = dailyMap.get(key) ?? { sent: 0, failed: 0, queued: 0, responded: 0 };
        daily.push({ date: key, ...v });
      }

      const byStatus = Array.from(statusMap.entries())
        .map(([status, count]) => ({ status, count }))
        .sort((a, b) => b.count - a.count);

      const byMode = Array.from(modeMap.entries())
        .map(([mode, count]) => ({ mode, count }))
        .sort((a, b) => b.count - a.count);

      // Top consultores: precisa nomes
      const consultorIds = Array.from(consultorMap.keys());
      let nomes: Record<string, string | null> = {};
      if (consultorIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id,nome")
          .in("user_id", consultorIds);
        nomes = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p.nome ?? null]));
      }

      const topConsultores = Array.from(consultorMap.entries())
        .map(([consultor_id, v]) => ({
          consultor_id,
          nome: nomes[consultor_id] ?? null,
          total: v.total,
          sent: v.sent,
          failed: v.failed,
          forced: v.forced,
          sucesso: v.total ? (v.sent / v.total) * 100 : 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        totalRecuperacao,
        valorPotencial,
        enviadosHoje,
        enviados7d,
        enviados30d,
        taxaSucesso,
        taxaFalha,
        taxaResposta,
        cooldownsAtivos: locksRes.data?.length ?? 0,
        optOuts: optoutsRes.count ?? 0,
        forcedCount30d,
        diasParadoMedio,
        daily,
        byStatus,
        byMode,
        topConsultores,
      };
    },
  });
}
