/**
 * useConsultorDashboard — Hook for consultant personal dashboard data.
 * §16: Queries only in hooks. §23: staleTime mandatory. RB-13: Brasília timezone.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

interface ConsultorKPIs {
  totalLeads: number;
  hotLeads: number;
  followUpsHoje: number;
  propostasEnviadasMes: number;
}

interface HotLead {
  id: string;
  nome: string;
  telefone: string | null;
  score: number;
  nivel: string;
  updated_at: string;
}

interface OverdueFollowUp {
  id: string;
  lead_id: string;
  lead_nome: string;
  descricao: string | null;
  data_agendada: string;
}

interface FunnelStage {
  nome: string;
  cor: string | null;
  count: number;
}

export interface ConsultorDashboardData {
  kpis: ConsultorKPIs;
  hotLeads: HotLead[];
  overdueFollowUps: OverdueFollowUp[];
  funnelStages: FunnelStage[];
}

async function resolveConsultorName(userId: string): Promise<{ nome: string; tenantId: string } | null> {
  const { data: consultor } = await supabase
    .from("consultores")
    .select("nome, tenant_id")
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();
  return consultor ? { nome: consultor.nome, tenantId: consultor.tenant_id } : null;
}

async function resolveTenantId(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.tenant_id ?? null;
}

function getTodayBrasiliaRange() {
  const now = new Date();
  const brStr = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  return { start: `${brStr}T00:00:00`, end: `${brStr}T23:59:59` };
}

function getMonthStartBrasilia() {
  const now = new Date();
  const year = Number(now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric" }));
  const month = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo", month: "2-digit" });
  return `${year}-${month}-01T00:00:00`;
}

async function fetchDashboardData(userId: string, isAdmin: boolean): Promise<ConsultorDashboardData> {
  const consultor = await resolveConsultorName(userId);
  
  // Admin without consultant record: use tenant from profiles
  let tenantId: string;
  let consultorNome: string | null = null;
  
  if (consultor) {
    tenantId = consultor.tenantId;
    consultorNome = consultor.nome;
  } else if (isAdmin) {
    const tid = await resolveTenantId(userId);
    if (!tid) return { kpis: { totalLeads: 0, hotLeads: 0, followUpsHoje: 0, propostasEnviadasMes: 0 }, hotLeads: [], overdueFollowUps: [], funnelStages: [] };
    tenantId = tid;
  } else {
    return { kpis: { totalLeads: 0, hotLeads: 0, followUpsHoje: 0, propostasEnviadasMes: 0 }, hotLeads: [], overdueFollowUps: [], funnelStages: [] };
  }

  const today = getTodayBrasiliaRange();
  const monthStart = getMonthStartBrasilia();

  // Build leads query — admin sees all, consultant sees own
  let leadsQuery = supabase
    .from("leads")
    .select("id, nome, telefone, status_id, updated_at")
    .is("deleted_at", null);
  if (!isAdmin && consultorNome) {
    leadsQuery = leadsQuery.eq("consultor", consultorNome);
  }

  // Parallel queries
  const [leadsRes, hotScoresRes, followUpsRes, propostasRes, statusesRes] = await Promise.all([
    // 1. Leads (filtered or all)
    leadsQuery,

    // 2. Hot lead scores (last 30 days)
    supabase
      .from("lead_scores")
      .select("lead_id, score, nivel")
      .eq("nivel", "hot")
      .eq("tenant_id", tenantId),

    // 3. Overdue follow-ups
    supabase
      .from("lead_atividades")
      .select("id, lead_id, descricao, data_agendada")
      .eq("concluido", false)
      .eq("tenant_id", tenantId)
      .lt("data_agendada", new Date().toISOString())
      .order("data_agendada", { ascending: true })
      .limit(20),

    // 4. Propostas enviadas this month
    supabase
      .from("proposta_envios")
      .select("id, enviado_por")
      .eq("tenant_id", tenantId)
      .gte("enviado_em", monthStart),

    // 5. All lead statuses for funnel
    supabase
      .from("lead_status")
      .select("id, nome, cor, ordem")
      .eq("tenant_id", tenantId)
      .order("ordem"),
  ]);

  const leads = leadsRes.data || [];
  const leadIds = new Set(leads.map(l => l.id));
  const hotScores = (hotScoresRes.data || []).filter(s => leadIds.has(s.lead_id));
  const hotLeadIds = new Set(hotScores.map(s => s.lead_id));

  // KPIs
  const kpis: ConsultorKPIs = {
    totalLeads: leads.length,
    hotLeads: hotLeadIds.size,
    followUpsHoje: (followUpsRes.data || []).filter(f => leadIds.has(f.lead_id)).length,
    propostasEnviadasMes: (propostasRes.data || []).length,
  };

  // Hot leads top 5
  const scoreMap = new Map(hotScores.map(s => [s.lead_id, s]));
  const hotLeadsList: HotLead[] = leads
    .filter(l => hotLeadIds.has(l.id))
    .map(l => ({
      id: l.id,
      nome: l.nome,
      telefone: l.telefone,
      score: scoreMap.get(l.id)?.score ?? 0,
      nivel: "hot",
      updated_at: l.updated_at,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Overdue follow-ups (only for this consultant's leads)
  const overdueFollowUps: OverdueFollowUp[] = (followUpsRes.data || [])
    .filter(f => leadIds.has(f.lead_id))
    .slice(0, 5)
    .map(f => {
      const lead = leads.find(l => l.id === f.lead_id);
      return {
        id: f.id,
        lead_id: f.lead_id,
        lead_nome: lead?.nome ?? "Lead",
        descricao: f.descricao,
        data_agendada: f.data_agendada,
      };
    });

  // Funnel stages
  const statuses = statusesRes.data || [];
  const statusCountMap = new Map<string | null, number>();
  leads.forEach(l => {
    statusCountMap.set(l.status_id, (statusCountMap.get(l.status_id) || 0) + 1);
  });

  const funnelStages: FunnelStage[] = [
    ...statuses.map(s => ({
      nome: s.nome,
      cor: s.cor,
      count: statusCountMap.get(s.id) || 0,
    })),
  ];

  const semStatus = statusCountMap.get(null) || 0;
  if (semStatus > 0) {
    funnelStages.unshift({ nome: "Sem status", cor: null, count: semStatus });
  }

  return { kpis, hotLeads: hotLeadsList, overdueFollowUps, funnelStages };
}

export function useConsultorDashboard(userId: string | undefined, isAdmin = false) {
  return useQuery({
    queryKey: ["consultor-dashboard", userId, isAdmin],
    queryFn: () => fetchDashboardData(userId!, isAdmin),
    enabled: !!userId,
    staleTime: STALE_TIME,
  });
}
