import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface FinanceiroKpis {
  receita_total: number;
  receita_pendente: number;
  receita_paga: number;
  comissoes_pendentes: number;
  comissoes_pagas: number;
  parcelas_atrasadas: number;
}

export interface RecebimentoRow {
  id: string;
  cliente_id: string;
  valor_total: number;
  numero_parcelas: number;
  status: string;
  created_at: string;
  cliente_nome?: string;
}

export interface ComissaoRow {
  id: string;
  consultor_id: string;
  descricao: string;
  valor_base: number;
  percentual_comissao: number;
  valor_comissao: number;
  status: string;
  created_at: string;
  consultor_nome?: string;
}

export function useFinanceiroKpis() {
  return useQuery({
    queryKey: ["financeiro-kpis"],
    queryFn: async () => {
      const [recResult, comResult, parcResult] = await Promise.all([
        supabase.from("recebimentos").select("valor_total, status"),
        supabase.from("comissoes").select("valor_comissao, status"),
        supabase
          .from("parcelas")
          .select("valor, status, data_vencimento, recebimentos!inner(status)")
          .eq("status", "pendente")
          .neq("recebimentos.status", "aguardando_instalacao")
          .lt("data_vencimento", new Date().toISOString().split("T")[0]),
      ]);

      const recs = recResult.data || [];
      const coms = comResult.data || [];
      const parcs = parcResult.data || [];

      return {
        receita_total: recs.reduce((s, r) => s + Number(r.valor_total || 0), 0),
        receita_pendente: recs.filter(r => r.status === "pendente").reduce((s, r) => s + Number(r.valor_total || 0), 0),
        receita_paga: recs.filter(r => r.status === "quitado").reduce((s, r) => s + Number(r.valor_total || 0), 0),
        comissoes_pendentes: coms.filter(c => c.status === "pendente").reduce((s, c) => s + Number(c.valor_comissao || 0), 0),
        comissoes_pagas: coms.filter(c => c.status === "pago").reduce((s, c) => s + Number(c.valor_comissao || 0), 0),
        parcelas_atrasadas: parcs.reduce((s, p) => s + Number(p.valor || 0), 0),
      } as FinanceiroKpis;
    },
    staleTime: STALE_TIME,
  });
}

export function useRecebimentosRecentes() {
  return useQuery({
    queryKey: ["financeiro-recebimentos-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("recebimentos")
        .select("id, cliente_id, valor_total, numero_parcelas, status, created_at, clientes(nome)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        cliente_nome: r.clientes?.nome || "—",
      })) as RecebimentoRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useComissoesRecentes() {
  return useQuery({
    queryKey: ["financeiro-comissoes-recentes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comissoes")
        .select("id, consultor_id, descricao, valor_base, percentual_comissao, valor_comissao, status, created_at, consultores(nome)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data || []).map((c: any) => ({
        ...c,
        consultor_nome: c.consultores?.nome || "—",
      })) as ComissaoRow[];
    },
    staleTime: STALE_TIME,
  });
}

export interface MonthlyFinanceiro {
  label: string;
  receita: number;
  comissoes: number;
}

export function useFinanceiroMensal() {
  return useQuery({
    queryKey: ["financeiro-mensal"],
    queryFn: async () => {
      const now = new Date();
      const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

      const [recResult, comResult] = await Promise.all([
        supabase.from("recebimentos").select("valor_total, created_at"),
        supabase.from("comissoes").select("valor_comissao, mes_referencia, ano_referencia"),
      ]);

      const recs = recResult.data || [];
      const coms = comResult.data || [];
      const months: MonthlyFinanceiro[] = [];

      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const m = d.getMonth();
        const y = d.getFullYear();

        const receita = recs
          .filter(r => {
            const rd = new Date(r.created_at);
            return rd.getMonth() === m && rd.getFullYear() === y;
          })
          .reduce((s, r) => s + Number(r.valor_total || 0), 0);

        const comissoes = coms
          .filter(c => c.mes_referencia === m + 1 && c.ano_referencia === y)
          .reduce((s, c) => s + Number(c.valor_comissao || 0), 0);

        months.push({ label: `${monthNames[m]}/${String(y).slice(2)}`, receita, comissoes });
      }

      return months;
    },
    staleTime: STALE_TIME,
  });
}
