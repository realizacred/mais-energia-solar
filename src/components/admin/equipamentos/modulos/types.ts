export interface Modulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  tipo_celula: string;
  num_celulas: number | null;
  tensao_sistema: string | null;
  eficiencia_percent: number | null;
  comprimento_mm: number | null;
  largura_mm: number | null;
  profundidade_mm: number | null;
  peso_kg: number | null;
  area_m2: number | null;
  bifacial: boolean;
  garantia_produto_anos: number | null;
  garantia_performance_anos: number | null;
  voc_v: number | null;
  isc_a: number | null;
  vmp_v: number | null;
  imp_a: number | null;
  temp_coeff_pmax: number | null;
  temp_coeff_voc: number | null;
  temp_coeff_isc: number | null;
  ativo: boolean;
  status: "rascunho" | "revisao" | "publicado";
  tenant_id: string | null;
  datasheet_url: string | null;
  datasheet_source_url: string | null;
  datasheet_found_at: string | null;
  created_at: string;
  updated_at: string;
}

export const CELL_TYPES = [
  "Mono PERC",
  "N-Type TOPCon",
  "N-Type HJT",
  "N-Type HPBC",
  "Policristalino",
] as const;

export const TENSAO_SISTEMAS = ["1000V", "1500V"] as const;

export const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400" },
  revisao: { label: "Revisão", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  publicado: { label: "Publicado", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" },
};

export const MODULO_QUERY_KEY = ["modulos-solares"] as const;

export const MODULOS_SELECT = `
  id, fabricante, modelo, potencia_wp, tipo_celula, num_celulas, tensao_sistema,
  eficiencia_percent, comprimento_mm, largura_mm, profundidade_mm, peso_kg, area_m2,
  bifacial, garantia_produto_anos, garantia_performance_anos,
  voc_v, isc_a, vmp_v, imp_a,
  temp_coeff_pmax, temp_coeff_voc, temp_coeff_isc,
  ativo, status, tenant_id,
  datasheet_url, datasheet_source_url, datasheet_found_at,
  created_at, updated_at
`.replace(/\s+/g, " ").trim();
