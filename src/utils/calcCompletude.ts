import type { Modulo } from "@/components/admin/equipamentos/modulos/types";

export function calcCompletude(m: Modulo): number {
  const fields = [
    m.fabricante, m.modelo, m.potencia_wp, m.tipo_celula,
    m.num_celulas, m.eficiencia_percent,
    m.vmp_v, m.imp_a, m.voc_v, m.isc_a,
    m.comprimento_mm, m.largura_mm, m.profundidade_mm, m.peso_kg,
    m.temp_coeff_pmax, m.temp_coeff_voc, m.temp_coeff_isc,
    m.garantia_produto_anos, m.garantia_performance_anos,
  ];
  const filled = fields.filter(v => v != null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}
