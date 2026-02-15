import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────

export interface TenantPremises {
  id?: string;
  tenant_id?: string;
  concessionaria_id?: string;
  // Tab 1 - Financeiras
  inflacao_energetica: number;
  vpl_taxa_desconto: number;
  considerar_custo_disponibilidade: boolean;
  // Tab 2 - Sistema Solar
  base_irradiancia: string;
  sobredimensionamento_padrao: number;
  perda_eficiencia_tradicional: number;
  perda_eficiencia_microinversor: number;
  perda_eficiencia_otimizador: number;
  troca_inversor_anos_tradicional: number;
  troca_inversor_anos_microinversor: number;
  troca_inversor_anos_otimizador: number;
  custo_troca_inversor_tradicional: number;
  custo_troca_inversor_microinversor: number;
  custo_troca_inversor_otimizador: number;
  margem_potencia_ideal: number;
  considerar_custo_disponibilidade_solar: boolean;
  // Tab 4 - Valores Padrões
  grupo_tarifario: string;
  tarifa: number;
  tarifa_te_ponta: number;
  tarifa_tusd_ponta: number;
  tarifa_te_fora_ponta: number;
  tarifa_tusd_fora_ponta: number;
  tusd_fio_b_bt: number;
  tusd_fio_b_fora_ponta: number;
  tusd_fio_b_ponta: number;
  tarifacao_compensada_bt: number;
  tarifacao_compensada_fora_ponta: number;
  tarifacao_compensada_ponta: number;
  preco_demanda_geracao: number;
  preco_demanda: number;
  fase_tensao_rede: string;
  fator_simultaneidade: number;
  imposto_energia: number;
  outros_encargos_atual: number;
  outros_encargos_novo: number;
  tipo_telhado_padrao: string;
  desvio_azimutal: number;
  inclinacao_modulos: number;
  topologias: string[];
  tipo_sistema: string;
  taxa_desempenho_tradicional: number;
  taxa_desempenho_microinversor: number;
  taxa_desempenho_otimizador: number;
  tipo_kits: string[];
  considerar_kits_transformador: boolean;
  tipo_preco: string;
  dod: number;
  fornecedor_filtro: string;
}

export const PREMISES_DEFAULTS: TenantPremises = {
  inflacao_energetica: 9.50,
  vpl_taxa_desconto: 12.00,
  considerar_custo_disponibilidade: true,
  base_irradiancia: "inpe_2017",
  sobredimensionamento_padrao: 20.00,
  perda_eficiencia_tradicional: 0.80,
  perda_eficiencia_microinversor: 0.50,
  perda_eficiencia_otimizador: 0.50,
  troca_inversor_anos_tradicional: 10,
  troca_inversor_anos_microinversor: 10,
  troca_inversor_anos_otimizador: 10,
  custo_troca_inversor_tradicional: 0.00,
  custo_troca_inversor_microinversor: 0.00,
  custo_troca_inversor_otimizador: 0.00,
  margem_potencia_ideal: 0.00,
  considerar_custo_disponibilidade_solar: true,
  grupo_tarifario: "BT",
  tarifa: 0.99027,
  tarifa_te_ponta: 0,
  tarifa_tusd_ponta: 0,
  tarifa_te_fora_ponta: 0,
  tarifa_tusd_fora_ponta: 0,
  tusd_fio_b_bt: 0.19703,
  tusd_fio_b_fora_ponta: 0,
  tusd_fio_b_ponta: 0,
  tarifacao_compensada_bt: 1.97031,
  tarifacao_compensada_fora_ponta: 0,
  tarifacao_compensada_ponta: 0,
  preco_demanda_geracao: 0,
  preco_demanda: 0,
  fase_tensao_rede: "bifasico_127_220",
  fator_simultaneidade: 30.00,
  imposto_energia: 0,
  outros_encargos_atual: 0,
  outros_encargos_novo: 0,
  tipo_telhado_padrao: "metalico",
  desvio_azimutal: 0,
  inclinacao_modulos: 20,
  topologias: ["tradicional", "microinversor", "otimizador"],
  tipo_sistema: "on_grid",
  taxa_desempenho_tradicional: 69.80,
  taxa_desempenho_microinversor: 72.00,
  taxa_desempenho_otimizador: 74.00,
  tipo_kits: ["fechados", "customizados"],
  considerar_kits_transformador: true,
  tipo_preco: "equipamentos",
  dod: 80.00,
  fornecedor_filtro: "qualquer",
};

export interface RoofAreaFactor {
  id?: string;
  tenant_id?: string;
  tipo_telhado: string;
  fator_area: number;
  enabled: boolean;
}

export const DEFAULT_ROOF_FACTORS: RoofAreaFactor[] = [
  { tipo_telhado: "carport", fator_area: 1.30, enabled: true },
  { tipo_telhado: "ceramico", fator_area: 1.20, enabled: true },
  { tipo_telhado: "fibrocimento", fator_area: 1.20, enabled: true },
  { tipo_telhado: "laje", fator_area: 1.20, enabled: true },
  { tipo_telhado: "shingle", fator_area: 1.20, enabled: true },
  { tipo_telhado: "metalico", fator_area: 1.20, enabled: true },
  { tipo_telhado: "zipado", fator_area: 1.20, enabled: true },
  { tipo_telhado: "solo", fator_area: 1.60, enabled: true },
];

// ─── Hook ──────────────────────────────────────────

export function useTenantPremises() {
  const [premises, setPremises] = useState<TenantPremises>(PREMISES_DEFAULTS);
  const [roofFactors, setRoofFactors] = useState<RoofAreaFactor[]>(DEFAULT_ROOF_FACTORS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savedRef = useRef<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [premRes, roofRes] = await Promise.all([
        supabase.from("tenant_premises").select("*").limit(1).maybeSingle(),
        supabase.from("tenant_roof_area_factors").select("*").order("tipo_telhado"),
      ]);

      if (premRes.data) {
        const d = premRes.data as any;
        setPremises({ ...PREMISES_DEFAULTS, ...d });
      }
      savedRef.current = JSON.stringify(premRes.data || PREMISES_DEFAULTS);

      if (roofRes.data && roofRes.data.length > 0) {
        setRoofFactors(roofRes.data as any);
      }
    } catch (e) {
      console.error("Failed to load tenant premises:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const isDirty = JSON.stringify(premises) !== savedRef.current;

  const save = useCallback(async () => {
    setSaving(true);
    try {
      const { id, tenant_id, ...payload } = premises as any;
      if (id) {
        const { error } = await supabase
          .from("tenant_premises")
          .update({ ...payload, updated_by: (await supabase.auth.getUser()).data.user?.id })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { data: ins, error } = await supabase
          .from("tenant_premises")
          .insert({ ...payload, created_by: (await supabase.auth.getUser()).data.user?.id })
          .select("id, tenant_id")
          .single();
        if (error) throw error;
        setPremises((prev) => ({ ...prev, id: (ins as any).id, tenant_id: (ins as any).tenant_id }));
      }
      savedRef.current = JSON.stringify(premises);
      toast.success("Premissas salvas com sucesso");
    } catch (e: any) {
      toast.error("Erro ao salvar premissas", { description: e.message });
    } finally {
      setSaving(false);
    }
  }, [premises]);

  const saveRoofFactors = useCallback(async (factors: RoofAreaFactor[]) => {
    setSaving(true);
    try {
      for (const f of factors) {
        const { id, tenant_id, ...payload } = f as any;
        if (id) {
          await supabase.from("tenant_roof_area_factors").update(payload).eq("id", id);
        } else {
          const { data } = await supabase
            .from("tenant_roof_area_factors")
            .insert(payload)
            .select("id, tenant_id")
            .single();
          if (data) {
            f.id = (data as any).id;
            f.tenant_id = (data as any).tenant_id;
          }
        }
      }
      setRoofFactors([...factors]);
      toast.success("Fatores de telhado salvos");
    } catch (e: any) {
      toast.error("Erro ao salvar fatores", { description: e.message });
    } finally {
      setSaving(false);
    }
  }, []);

  const reset = useCallback(() => {
    const saved = savedRef.current ? JSON.parse(savedRef.current) : PREMISES_DEFAULTS;
    setPremises(saved);
  }, []);

  return {
    premises, setPremises,
    roofFactors, setRoofFactors,
    loading, saving, isDirty,
    save, saveRoofFactors, reset, reload: load,
  };
}
