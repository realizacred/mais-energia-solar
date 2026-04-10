/**
 * useCommercialMetrics — Queries for commercial metrics widgets.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 * Métricas: leads por origem, tempo médio fechamento, receita prevista vs realizada.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import { startOfMonth, subMonths, format } from "date-fns";

const STALE_TIME = 1000 * 60 * 5; // 5 min

// ── Types ────────────────────────────────────────────

export interface LeadOrigemMetric {
  origem: string;
  total: number;
  convertidos: number;
  taxaConversao: number;
}

export interface ClosingTimeMetric {
  consultor: string;
  dealsFechados: number;
  diasMedio: number;
  maisRapido: number;
  maisLento: number;
}

export interface RevenueMonthMetric {
  mes: string;       // "2026-01"
  mesLabel: string;   // "Jan/26"
  previsto: number;
  realizado: number;
  dealsAbertos: number;
  dealsGanhos: number;
}

// ── 1. Leads por Origem ──────────────────────────────

interface LeadOrigemRow {
  id: string;
  origem: string | null;
  lead_origem_id: string | null;
  status_id: string | null;
  data_conversao: string | null;
}

interface LeadOrigemRef {
  id: string;
  nome: string;
}

export function useLeadsByOrigin(months = 12) {
  const cutoff = useMemo(() => subMonths(new Date(), months).toISOString(), [months]);

  const leadsQuery = useQuery({
    queryKey: ["commercial-metrics", "leads-by-origin", months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("id, origem, lead_origem_id, status_id, data_conversao")
        .is("deleted_at", null)
        .gte("created_at", cutoff)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as LeadOrigemRow[];
    },
    staleTime: STALE_TIME,
  });

  const origensQuery = useQuery({
    queryKey: ["commercial-metrics", "lead-origens"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_origens")
        .select("id, nome")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as LeadOrigemRef[];
    },
    staleTime: STALE_TIME,
  });

  const statusesQuery = useQuery({
    queryKey: ["commercial-metrics", "lead-statuses-conversion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string }[];
    },
    staleTime: STALE_TIME,
  });

  const metrics = useMemo<LeadOrigemMetric[]>(() => {
    const leads = leadsQuery.data ?? [];
    const origens = origensQuery.data ?? [];
    const statuses = statusesQuery.data ?? [];
    if (leads.length === 0) return [];

    const origenMap = new Map(origens.map(o => [o.id, o.nome]));
    const convertedStatusIds = new Set(
      statuses
        .filter(s => {
          const n = s.nome.toLowerCase();
          return n.includes("fechado") || n.includes("conclu") || n.includes("ganho") || n.includes("convertido");
        })
        .map(s => s.id)
    );

    const groups = new Map<string, { total: number; convertidos: number }>();

    for (const lead of leads) {
      const origemNome = lead.lead_origem_id
        ? (origenMap.get(lead.lead_origem_id) ?? lead.origem ?? "Não informado")
        : (lead.origem || "Não informado");

      const entry = groups.get(origemNome) ?? { total: 0, convertidos: 0 };
      entry.total++;
      if (lead.data_conversao || convertedStatusIds.has(lead.status_id ?? "")) {
        entry.convertidos++;
      }
      groups.set(origemNome, entry);
    }

    return Array.from(groups.entries())
      .map(([origem, { total, convertidos }]) => ({
        origem,
        total,
        convertidos,
        taxaConversao: total > 0 ? Math.round((convertidos / total) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [leadsQuery.data, origensQuery.data, statusesQuery.data]);

  return {
    data: metrics,
    isLoading: leadsQuery.isLoading || origensQuery.isLoading || statusesQuery.isLoading,
  };
}

// ── 2. Tempo Médio de Fechamento ─────────────────────

interface ClosingDealRow {
  id: string;
  owner_id: string;
  created_at: string;
}

interface ClosingPropostaRow {
  deal_id: string | null;
  projeto_id: string | null;
  aceito_em: string | null;
}

export function useClosingTime(months = 12) {
  const cutoff = useMemo(() => subMonths(new Date(), months).toISOString(), [months]);

  const dealsQuery = useQuery({
    queryKey: ["commercial-metrics", "closing-deals", months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, owner_id, created_at")
        .eq("status", "won")
        .gte("created_at", cutoff)
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ClosingDealRow[];
    },
    staleTime: STALE_TIME,
  });

  const consultoresQuery = useQuery({
    queryKey: ["commercial-metrics", "consultores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, user_id")
        .eq("ativo", true);
      if (error) throw error;
      return (data ?? []) as { id: string; nome: string; user_id: string | null }[];
    },
    staleTime: STALE_TIME,
  });

  // Fetch accepted proposals to get close date
  const propostasQuery = useQuery({
    queryKey: ["commercial-metrics", "closing-propostas", months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("proposta_id, aceito_em, propostas_nativas!inner(deal_id, projeto_id)")
        .not("aceito_em", "is", null)
        .limit(2000);
      if (error) throw error;
      return (data ?? []).map((v: any) => ({
        deal_id: v.propostas_nativas?.deal_id ?? null,
        projeto_id: v.propostas_nativas?.projeto_id ?? null,
        aceito_em: v.aceito_em,
      })) as ClosingPropostaRow[];
    },
    staleTime: STALE_TIME,
  });

  const metrics = useMemo(() => {
    const deals = dealsQuery.data ?? [];
    const consultores = consultoresQuery.data ?? [];
    const propostas = propostasQuery.data ?? [];
    if (deals.length === 0) return { byConsultor: [] as ClosingTimeMetric[], mediaGeral: 0 };

    // Map owner_id (user_id in consultores) → consultor nome
    const consultorByUserId = new Map(consultores.map(c => [c.user_id ?? c.id, c.nome]));
    const consultorById = new Map(consultores.map(c => [c.id, c.nome]));

    // Map deal_id → aceito_em (first accept date)
    const acceptDateByDeal = new Map<string, string>();
    for (const p of propostas) {
      if (p.deal_id && p.aceito_em && !acceptDateByDeal.has(p.deal_id)) {
        acceptDateByDeal.set(p.deal_id, p.aceito_em);
      }
    }

    // Group by consultor
    const groups = new Map<string, number[]>();

    for (const deal of deals) {
      const closeDate = acceptDateByDeal.get(deal.id) ?? deal.created_at;
      const days = Math.round(
        (new Date(closeDate).getTime() - new Date(deal.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (days < 0 || days > 730) continue;

      const nome = consultorByUserId.get(deal.owner_id) ?? consultorById.get(deal.owner_id) ?? "Sem consultor";
      const arr = groups.get(nome) ?? [];
      arr.push(days);
      groups.set(nome, arr);
    }

    const byConsultor: ClosingTimeMetric[] = Array.from(groups.entries())
      .map(([consultor, days]) => ({
        consultor,
        dealsFechados: days.length,
        diasMedio: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
        maisRapido: Math.min(...days),
        maisLento: Math.max(...days),
      }))
      .sort((a, b) => a.diasMedio - b.diasMedio);

    const allDays = Array.from(groups.values()).flat();
    const mediaGeral = allDays.length > 0 ? Math.round(allDays.reduce((s, d) => s + d, 0) / allDays.length) : 0;

    return { byConsultor, mediaGeral };
  }, [dealsQuery.data, consultoresQuery.data, propostasQuery.data]);

  return {
    data: metrics,
    isLoading: dealsQuery.isLoading || consultoresQuery.isLoading || propostasQuery.isLoading,
  };
}

// ── 3. Receita Prevista vs Realizada ─────────────────

export function useRevenuePrevVsRealized(months = 6) {
  const cutoff = useMemo(() => subMonths(new Date(), months).toISOString(), [months]);

  const dealsQuery = useQuery({
    queryKey: ["commercial-metrics", "revenue-deals", months],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deals")
        .select("id, value, status, created_at, updated_at")
        .gte("created_at", cutoff)
        .gt("value", 0)
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as { id: string; value: number; status: string; created_at: string; updated_at: string }[];
    },
    staleTime: STALE_TIME,
  });

  const metrics = useMemo<{ monthly: RevenueMonthMetric[]; totalPrevisto: number; totalRealizado: number }>(() => {
    const deals = dealsQuery.data ?? [];
    if (deals.length === 0) return { monthly: [], totalPrevisto: 0, totalRealizado: 0 };

    const now = new Date();
    const monthsMap = new Map<string, RevenueMonthMetric>();

    // Initialize months
    for (let i = months - 1; i >= 0; i--) {
      const d = subMonths(now, i);
      const key = format(d, "yyyy-MM");
      const label = format(d, "MMM/yy");
      monthsMap.set(key, { mes: key, mesLabel: label, previsto: 0, realizado: 0, dealsAbertos: 0, dealsGanhos: 0 });
    }

    for (const deal of deals) {
      const createdMonth = format(new Date(deal.created_at), "yyyy-MM");

      if (deal.status === "won") {
        // Realized revenue: use updated_at month (when it was won)
        const wonMonth = format(new Date(deal.updated_at), "yyyy-MM");
        const entry = monthsMap.get(wonMonth);
        if (entry) {
          entry.realizado += deal.value;
          entry.dealsGanhos++;
        }
      }

      // All deals contribute to forecast in their creation month
      const entry = monthsMap.get(createdMonth);
      if (entry) {
        entry.previsto += deal.value;
        if (deal.status !== "won") {
          entry.dealsAbertos++;
        }
      }
    }

    const monthly = Array.from(monthsMap.values());
    const totalPrevisto = monthly.reduce((s, m) => s + m.previsto, 0);
    const totalRealizado = monthly.reduce((s, m) => s + m.realizado, 0);

    return { monthly, totalPrevisto, totalRealizado };
  }, [dealsQuery.data, months]);

  return {
    data: metrics,
    isLoading: dealsQuery.isLoading,
  };
}
