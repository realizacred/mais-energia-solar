// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface FechamentoCaixa {
  id: string;
  tenant_id: string;
  data_inicio: string;
  data_fim: string;
  tipo: string;
  total_recebido: number;
  total_parcelas_pagas: number;
  total_recebimentos_quitados: number;
  total_receitas_avulsas: number;
  total_despesas: number;
  total_receitas: number;
  saldo_periodo: number;
  breakdown_formas: Record<string, number>;
  breakdown_categorias: Record<string, number>;
  breakdown_despesas: Record<string, number>;
  status: string;
  fechado_por: string | null;
  fechado_em: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ResumoFechamento {
  total: number;
  quantidade: number;
  formas: Record<string, number>;
  receitasAvulsas: number;
  despesas: number;
  breakdownCategorias: Record<string, number>;
  breakdownDespesas: Record<string, number>;
  totalReceitas: number;
  saldoPeriodo: number;
}

export function useFechamentosCaixa() {
  return useQuery({
    queryKey: ["fechamentos-caixa"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fechamentos_caixa")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as FechamentoCaixa[];
    },
    staleTime: STALE_TIME,
  });
}

export function useResumoFechamento(dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ["resumo-fechamento", dataInicio, dataFim],
    queryFn: async (): Promise<ResumoFechamento> => {
      // 1. Pagamentos (parcelas pagas)
      const { data: pagData, error: pagErr } = await supabase
        .from("pagamentos")
        .select("valor_pago, forma_pagamento, data_pagamento")
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim);
      if (pagErr) throw pagErr;

      const items = pagData || [];
      const total = items.reduce((s, p) => s + Number(p.valor_pago || 0), 0);
      const formas = items.reduce((acc, p) => {
        const f = p.forma_pagamento || "outros";
        acc[f] = (acc[f] || 0) + Number(p.valor_pago || 0);
        return acc;
      }, {} as Record<string, number>);

      // 2. Lançamentos financeiros do período
      const { data: lancData, error: lancErr } = await (supabase as any)
        .from("lancamentos_financeiros")
        .select("tipo, categoria, valor, status")
        .gte("data_lancamento", dataInicio)
        .lte("data_lancamento", dataFim)
        .neq("status", "cancelado");
      if (lancErr) throw lancErr;

      const lancs = (lancData || []) as Array<{ tipo: string; categoria: string; valor: number; status: string }>;

      let receitasAvulsas = 0;
      const breakdownCategorias: Record<string, number> = {};
      let despesas = 0;
      const breakdownDespesas: Record<string, number> = {};

      for (const l of lancs) {
        const v = Number(l.valor);
        if (l.tipo === "receita") {
          receitasAvulsas += v;
          breakdownCategorias[l.categoria] = (breakdownCategorias[l.categoria] || 0) + v;
        } else {
          despesas += v;
          breakdownDespesas[l.categoria] = (breakdownDespesas[l.categoria] || 0) + v;
        }
      }

      const totalReceitas = total + receitasAvulsas;
      const saldoPeriodo = totalReceitas - despesas;

      return {
        total,
        quantidade: items.length,
        formas,
        receitasAvulsas,
        despesas,
        breakdownCategorias,
        breakdownDespesas,
        totalReceitas,
        saldoPeriodo,
      };
    },
    staleTime: 1000 * 30,
    enabled: !!dataInicio && !!dataFim,
  });
}

export function usePagamentosPeriodo(dataInicio: string, dataFim: string) {
  return useQuery({
    queryKey: ["pagamentos-periodo", dataInicio, dataFim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pagamentos")
        .select(`
          id, valor_pago, forma_pagamento, data_pagamento, observacoes, created_at,
          recebimentos(
            id, valor_total, numero_parcelas, descricao,
            clientes(id, nome, telefone)
          )
        `)
        .gte("data_pagamento", dataInicio)
        .lte("data_pagamento", dataFim)
        .order("data_pagamento", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        cliente_nome: p.recebimentos?.clientes?.nome || "—",
        cliente_telefone: p.recebimentos?.clientes?.telefone || "",
      }));
    },
    staleTime: 1000 * 30,
    enabled: !!dataInicio && !!dataFim,
  });
}

export function useCriarFechamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      tipo: string;
      dataInicio: string;
      dataFim: string;
      totalRecebido: number;
      totalParcelas: number;
      breakdownFormas: Record<string, number>;
      totalReceitasAvulsas: number;
      totalDespesas: number;
      totalReceitas: number;
      saldoPeriodo: number;
      breakdownCategorias: Record<string, number>;
      breakdownDespesas: Record<string, number>;
      observacoes?: string;
      fechadoPor: string;
    }) => {
      const { data, error } = await (supabase as any)
        .from("fechamentos_caixa")
        .insert({
          tipo: payload.tipo,
          data_inicio: payload.dataInicio,
          data_fim: payload.dataFim,
          total_recebido: payload.totalRecebido,
          total_parcelas_pagas: payload.totalParcelas,
          total_receitas_avulsas: payload.totalReceitasAvulsas,
          total_despesas: payload.totalDespesas,
          total_receitas: payload.totalReceitas,
          saldo_periodo: payload.saldoPeriodo,
          breakdown_formas: payload.breakdownFormas,
          breakdown_categorias: payload.breakdownCategorias,
          breakdown_despesas: payload.breakdownDespesas,
          status: "fechado",
          fechado_por: payload.fechadoPor,
          fechado_em: new Date().toISOString(),
          observacoes: payload.observacoes || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fechamentos-caixa"] });
      qc.invalidateQueries({ queryKey: ["resumo-fechamento"] });
    },
  });
}
