import type { Otimizador } from "@/hooks/useOtimizadoresCatalogo";

export function calcCompletudeOtimizador(o: Otimizador): number {
  const fields = [
    o.fabricante, o.modelo, o.potencia_wp, o.tensao_entrada_max_v,
    o.corrente_entrada_max_a, o.tensao_saida_v, o.eficiencia_percent,
    o.peso_kg, o.garantia_anos,
  ];
  const filled = fields.filter(v => v != null && v !== "").length;
  return Math.round((filled / fields.length) * 100);
}
