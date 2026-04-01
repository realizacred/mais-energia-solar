import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

const MONTH_LABELS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export interface DREMes {
  mes: string;
  mesLabel: string;
  receitas_propostas: number;
  receitas_avulsas: number;
  total_receitas: number;
  despesas_operacionais: number;
  despesas_por_categoria: Record<string, number>;
  comissoes_pagas: number;
  resultado_bruto: number;
  resultado_liquido: number;
}

function monthRange(anoMesInicio: string, anoMesFim: string) {
  const [yI, mI] = anoMesInicio.split("-").map(Number);
  const [yF, mF] = anoMesFim.split("-").map(Number);
  const months: { year: number; month: number; key: string; label: string }[] = [];
  let y = yI, m = mI;
  while (y < yF || (y === yF && m <= mF)) {
    months.push({
      year: y,
      month: m,
      key: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MONTH_LABELS[m - 1]}/${y}`,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return months;
}

export function useDRE(anoMesInicio: string, anoMesFim: string) {
  return useQuery<DREMes[], Error>({
    queryKey: ["dre", anoMesInicio, anoMesFim],
    queryFn: async (): Promise<DREMes[]> => {
      const months = monthRange(anoMesInicio, anoMesFim);
      if (!months.length) return [];

      const firstDay = `${months[0].key}-01`;
      const lastMonth = months[months.length - 1];
      const lastDay = `${lastMonth.key}-${new Date(lastMonth.year, lastMonth.month, 0).getDate()}`;

      const [pagRes, lancRes, comRes] = await Promise.all([
        supabase
          .from("pagamentos")
          .select("valor_pago, data_pagamento")
          .gte("data_pagamento", firstDay)
          .lte("data_pagamento", lastDay),
        (supabase as any)
          .from("lancamentos_financeiros")
          .select("tipo, categoria, valor, data_lancamento, status")
          .gte("data_lancamento", firstDay)
          .lte("data_lancamento", lastDay)
          .neq("status", "cancelado"),
        supabase
          .from("comissoes")
          .select("valor_comissao, status, mes_referencia, ano_referencia")
          .eq("status", "pago"),
      ]);

      const pagamentos = pagRes.data || [];
      const lancamentos = (lancRes.data || []) as Array<{
        tipo: string; categoria: string; valor: number; data_lancamento: string; status: string;
      }>;
      const comissoes = comRes.data || [];

      return months.map(({ key, label, year, month }) => {
        const receitas_propostas = pagamentos
          .filter((p: any) => {
            const d = new Date(p.data_pagamento);
            return d.getFullYear() === year && d.getMonth() + 1 === month;
          })
          .reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);

        let receitas_avulsas = 0;
        let despesas_operacionais = 0;
        const despesas_por_categoria: Record<string, number> = {};

        for (const l of lancamentos) {
          const d = new Date(l.data_lancamento);
          if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
          const v = Number(l.valor);
          if (l.tipo === "receita") {
            receitas_avulsas += v;
          } else {
            despesas_operacionais += v;
            despesas_por_categoria[l.categoria] = (despesas_por_categoria[l.categoria] || 0) + v;
          }
        }

        const comissoes_pagas = comissoes
          .filter((c: any) => c.ano_referencia === year && c.mes_referencia === month)
          .reduce((s: number, c: any) => s + Number(c.valor_comissao || 0), 0);

        const total_receitas = receitas_propostas + receitas_avulsas;
        const resultado_bruto = total_receitas - despesas_operacionais;
        const resultado_liquido = resultado_bruto - comissoes_pagas;

        return {
          mes: key,
          mesLabel: label,
          receitas_propostas,
          receitas_avulsas,
          total_receitas,
          despesas_operacionais,
          despesas_por_categoria,
          comissoes_pagas,
          resultado_bruto,
          resultado_liquido,
        };
      });
    },
    staleTime: STALE_TIME,
    enabled: Boolean(anoMesInicio && anoMesFim),
  });
}
