/**
 * Extracted data loading hooks from ProposalWizard
 * Handles: equipment catalog, banks, solar brain premises, tenant tariffs
 */
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSolarPremises } from "@/hooks/useSolarPremises";
import type { UCData, PremissasData, PreDimensionamentoData, BancoFinanciamento } from "./types";

// ─── Apply tenant tariff defaults to a UC ──────────
export function applyTenantTarifasToUC(
  uc: UCData,
  t: TenantTarifas,
): UCData {
  return {
    ...uc,
    distribuidora: uc.distribuidora || t.concessionaria_nome || "",
    distribuidora_id: uc.distribuidora_id || t.concessionaria_id || "",
    tarifa_distribuidora: uc.tarifa_distribuidora || t.tarifa || 0,
    tarifa_fio_b: uc.tarifa_fio_b || t.tusd_fio_b_bt || 0,
    tarifa_te_p: uc.tarifa_te_p || t.tarifa_te_ponta || 0,
    tarifa_tusd_p: uc.tarifa_tusd_p || t.tarifa_tusd_ponta || 0,
    tarifa_fio_b_p: uc.tarifa_fio_b_p || t.tusd_fio_b_ponta || 0,
    tarifa_tarifacao_p: uc.tarifa_tarifacao_p || t.tarifacao_compensada_ponta || 0,
    tarifa_te_fp: uc.tarifa_te_fp || t.tarifa_te_fora_ponta || 0,
    tarifa_tusd_fp: uc.tarifa_tusd_fp || t.tarifa_tusd_fora_ponta || 0,
    tarifa_fio_b_fp: uc.tarifa_fio_b_fp || t.tusd_fio_b_fora_ponta || 0,
    tarifa_tarifacao_fp: uc.tarifa_tarifacao_fp || t.tarifacao_compensada_fora_ponta || 0,
    demanda_consumo_rs: uc.demanda_consumo_rs || t.preco_demanda || 0,
    demanda_geracao_rs: uc.demanda_geracao_rs || t.preco_demanda_geracao || 0,
    outros_encargos_atual: uc.outros_encargos_atual || t.outros_encargos_atual || 0,
    outros_encargos_novo: uc.outros_encargos_novo || t.outros_encargos_novo || 0,
    imposto_energia: uc.imposto_energia || t.imposto_energia || 0,
    fator_simultaneidade: uc.fator_simultaneidade || t.fator_simultaneidade || 30,
  };
}

export interface TenantTarifas {
  tarifa: number; tusd_fio_b_bt: number;
  tarifa_te_ponta: number; tarifa_tusd_ponta: number; tusd_fio_b_ponta: number;
  tarifa_te_fora_ponta: number; tarifa_tusd_fora_ponta: number; tusd_fio_b_fora_ponta: number;
  tarifacao_compensada_bt: number; tarifacao_compensada_ponta: number; tarifacao_compensada_fora_ponta: number;
  imposto_energia: number; fator_simultaneidade: number;
  preco_demanda: number; preco_demanda_geracao: number;
  outros_encargos_atual: number; outros_encargos_novo: number;
  fase_tensao_rede: string; grupo_tarifario: string;
  concessionaria_nome?: string; concessionaria_id?: string;
}

export function useEquipmentCatalog() {
  const [modulos, setModulos] = useState<any[]>([]);
  const [inversores, setInversores] = useState<any[]>([]);
  const [otimizadores, setOtimizadores] = useState<any[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);

  useEffect(() => {
    setLoadingEquip(true);
    Promise.all([
      supabase.from("modulos_solares").select("id, fabricante, modelo, potencia_wp, tipo_celula, eficiencia_percent").eq("ativo", true).order("potencia_wp", { ascending: false }),
      supabase.from("inversores_catalogo").select("id, fabricante, modelo, potencia_nominal_kw, tipo, mppt_count, fases").eq("ativo", true).order("potencia_nominal_kw", { ascending: false }),
      supabase.from("otimizadores_catalogo").select("id, fabricante, modelo, potencia_wp, eficiencia_percent, compatibilidade").eq("ativo", true).order("fabricante"),
    ]).then(([modRes, invRes, otimRes]) => {
      setModulos(modRes.data || []);
      setInversores(invRes.data || []);
      setOtimizadores(otimRes.data || []);
      setLoadingEquip(false);
    });
  }, []);

  return { modulos, inversores, otimizadores, loadingEquip };
}

export function useBancosCatalog() {
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);

  useEffect(() => {
    setLoadingBancos(true);
    supabase
      .from("financiamento_bancos")
      .select("id, nome, taxa_mensal, max_parcelas")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true })
      .then(({ data }) => {
        setBancos((data || []) as BancoFinanciamento[]);
        setLoadingBancos(false);
      });
  }, []);

  return { bancos, loadingBancos };
}

export function useSolarBrainSync(
  setPremissas: React.Dispatch<React.SetStateAction<PremissasData>>,
  setPreDimensionamento: React.Dispatch<React.SetStateAction<PreDimensionamentoData>>,
) {
  const { data: solarBrain } = useSolarPremises();

  useEffect(() => {
    if (!solarBrain) return;
    setPremissas(prev => ({
      ...prev,
      imposto: solarBrain.imposto_energia ?? prev.imposto,
      inflacao_energetica: solarBrain.inflacao_energetica ?? prev.inflacao_energetica,
      perda_eficiencia_anual: solarBrain.perda_eficiencia ?? prev.perda_eficiencia_anual,
      sobredimensionamento: solarBrain.sobredimensionamento ?? prev.sobredimensionamento,
    }));
    setPreDimensionamento(prev => {
      const configs = { ...prev.topologia_configs };
      if (solarBrain.taxa_desempenho_tradicional != null) {
        configs.tradicional = { ...configs.tradicional, desempenho: solarBrain.taxa_desempenho_tradicional };
      }
      if (solarBrain.taxa_desempenho_microinversor != null) {
        configs.microinversor = { ...configs.microinversor, desempenho: solarBrain.taxa_desempenho_microinversor };
      }
      if (solarBrain.taxa_desempenho_otimizador != null) {
        configs.otimizador = { ...configs.otimizador, desempenho: solarBrain.taxa_desempenho_otimizador };
      }
      return {
        ...prev,
        sobredimensionamento: solarBrain.sobredimensionamento ?? prev.sobredimensionamento,
        topologia_configs: configs,
        topologias: solarBrain.topologias ?? prev.topologias,
        tipos_kit: solarBrain.tipo_kits ?? prev.tipos_kit,
        considerar_transformador: solarBrain.considerar_kits_transformador ?? prev.considerar_transformador,
        desempenho: configs.tradicional?.desempenho ?? prev.desempenho,
        margem_pot_ideal: solarBrain.margem_potencia_ideal ?? prev.margem_pot_ideal,
        sombreamento_config: solarBrain.sombreamento_config ?? prev.sombreamento_config,
      };
    });
  }, [solarBrain]);

  return solarBrain;
}

export function useTenantTarifas() {
  const [tenantTarifas, setTenantTarifas] = useState<TenantTarifas | null>(null);

  useEffect(() => {
    (async () => {
      const { data: tp } = await supabase
        .from("tenant_premises")
        .select(
          "tarifa, tusd_fio_b_bt, tarifa_te_ponta, tarifa_tusd_ponta, tusd_fio_b_ponta, " +
          "tarifa_te_fora_ponta, tarifa_tusd_fora_ponta, tusd_fio_b_fora_ponta, " +
          "tarifacao_compensada_bt, tarifacao_compensada_ponta, tarifacao_compensada_fora_ponta, " +
          "imposto_energia, fator_simultaneidade, fase_tensao_rede, grupo_tarifario, " +
          "preco_demanda, preco_demanda_geracao, outros_encargos_atual, outros_encargos_novo, " +
          "concessionaria_id"
        )
        .limit(1)
        .maybeSingle();

      if (!tp) return;
      const tpAny = tp as any;

      let concNome = "";
      const concId = tpAny.concessionaria_id as string | null;
      if (concId) {
        const { data: conc } = await supabase
          .from("concessionarias")
          .select("nome")
          .eq("id", concId)
          .maybeSingle();
        concNome = conc?.nome || "";
      }

      setTenantTarifas({
        ...tpAny,
        concessionaria_nome: concNome,
        concessionaria_id: concId || undefined,
      });
    })();
  }, []);

  return tenantTarifas;
}

export function useCustomFieldsAvailability() {
  const [hasCustomFieldsPre, setHasCustomFieldsPre] = useState(false);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  useEffect(() => {
    supabase
      .from("deal_custom_fields")
      .select("id, field_context")
      .eq("is_active", true)
      .then(({ data }) => {
        const fields = data || [];
        setHasCustomFieldsPre(fields.some(f => f.field_context === "pre_dimensionamento") || fields.length > 0);
        setLoadingCustomFields(false);
      });
  }, []);

  return { hasCustomFieldsPre, loadingCustomFields };
}

export function useUcsWithTarifas(tenantTarifas: TenantTarifas | null) {
  const handleUcsChange = useCallback((
    setUcs: React.Dispatch<React.SetStateAction<UCData[]>>,
    newUcs: UCData[] | ((prev: UCData[]) => UCData[]),
  ) => {
    setUcs(prev => {
      const resolved = typeof newUcs === "function" ? newUcs(prev) : newUcs;
      if (!tenantTarifas) return resolved;
      return resolved.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas]);

  return handleUcsChange;
}
