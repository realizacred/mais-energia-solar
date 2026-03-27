export interface BateriaCompletude {
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  dimensoes_mm: string | null;
}

export function calcCompletudeBateria(b: BateriaCompletude): number {
  const fields = [
    b.fabricante, b.modelo, b.tipo_bateria, b.energia_kwh,
    b.tensao_nominal_v, b.potencia_max_saida_kw,
    b.corrente_max_descarga_a, b.corrente_max_carga_a, b.dimensoes_mm,
  ];
  const filled = fields.filter(f => f != null && f !== "").length;
  return Math.round((filled / fields.length) * 100);
}
