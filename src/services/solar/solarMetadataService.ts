import { supabase } from "@/integrations/supabase/client";

export interface ConcessionariaOption {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
}

export interface RoofAreaFactor {
  tipo_telhado: string;
  label: string;
  enabled: boolean;
  fator_area: number;
  inclinacao_padrao: number;
  desvio_azimutal_padrao: number;
  topologias_permitidas: string[];
  tipos_sistema_permitidos: string[];
}

export const solarMetadataService = {
  async fetchConcessionarias(): Promise<ConcessionariaOption[]> {
    const { data, error } = await supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return (data || []) as ConcessionariaOption[];
  },

  async fetchRoofTypes(consultorCode?: string | null): Promise<RoofAreaFactor[]> {
    if (consultorCode) {
      const { data, error } = await supabase.rpc("get_roof_types_by_consultor", {
        p_consultor_code: consultorCode,
      });
      if (error) throw error;
      return (data || []) as any;
    } else {
      const { data, error } = await supabase
        .from("tenant_roof_area_factors")
        .select("tipo_telhado, label, enabled, fator_area, inclinacao_padrao, desvio_azimutal_padrao, topologias_permitidas, tipos_sistema_permitidos")
        .eq("enabled", true)
        .order("tipo_telhado");
      if (error) throw error;
      return (data || []) as any;
    }
  }
};
