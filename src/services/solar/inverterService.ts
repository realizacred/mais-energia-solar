import { supabase } from "@/integrations/supabase/client";

export interface Inversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number;
  potencia_maxima_kw: number | null;
  tipo: string;
  tensao_entrada_max_v: number | null;
  corrente_entrada_max_a: number | null;
  tensao_mppt_min_v: number | null;
  tensao_mppt_max_v: number | null;
  corrente_saida_a: number | null;
  fator_potencia: number | null;
  mppt_count: number | null;
  strings_por_mppt: number | null;
  fases: string;
  tensao_saida_v: number | null;
  eficiencia_max_percent: number | null;
  garantia_anos: number | null;
  peso_kg: number | null;
  dimensoes_mm: string | null;
  wifi_integrado: boolean | null;
  ip_protection: string | null;
  datasheet_url: string | null;
  status: string;
  ativo: boolean;
  tenant_id: string | null;
}

const SELECT_COLS = "id, tenant_id, fabricante, modelo, potencia_nominal_kw, potencia_maxima_kw, tipo, fases, mppt_count, strings_por_mppt, tensao_entrada_max_v, tensao_saida_v, corrente_entrada_max_a, tensao_mppt_min_v, tensao_mppt_max_v, corrente_saida_a, fator_potencia, eficiencia_max_percent, peso_kg, dimensoes_mm, garantia_anos, ip_protection, wifi_integrado, datasheet_url, status, ativo, created_at, updated_at";

export const inverterService = {
  async fetchAll(): Promise<Inversor[]> {
    const allData: Inversor[] = [];
    const batchSize = 1000;
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from("inversores_catalogo")
        .select(SELECT_COLS)
        .order("fabricante")
        .order("potencia_nominal_kw")
        .range(offset, offset + batchSize - 1);

      if (error) throw error;
      if (!data || data.length === 0) break;

      allData.push(...(data as Inversor[]));
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return allData;
  },

  async save(id: string | undefined, data: Record<string, unknown>) {
    if (id) {
      const { error } = await supabase
        .from("inversores_catalogo")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("inversores_catalogo")
        .insert(data as any);
      if (error) throw error;
    }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("inversores_catalogo")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async toggleActive(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("inversores_catalogo")
      .update({ ativo })
      .eq("id", id);
    if (error) throw error;
  }
};
