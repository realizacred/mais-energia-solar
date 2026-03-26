import type { Inversor } from "@/hooks/useInversoresCatalogo";

export function calcCompletudeInversor(i: Inversor): number {
  const fields = [
    i.fabricante, i.modelo, i.potencia_nominal_kw, i.eficiencia_max_percent,
    i.tensao_entrada_max_v, i.tensao_mppt_min_v, i.tensao_mppt_max_v,
    i.corrente_entrada_max_a, i.mppt_count, i.fases, i.tensao_saida_v,
    i.corrente_saida_a, i.peso_kg, i.garantia_anos,
  ];
  const filled = fields.filter(v => v != null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}
