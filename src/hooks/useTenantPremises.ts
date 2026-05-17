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
  // Sombreamento config
  sombreamento_config: SombreamentoConfig;
  // Monitoring losses
  shading_loss_percent: number;
  soiling_loss_percent: number;
  other_losses_percent: number;
  // Solar Brain fields (calculadora pública)
  percentual_economia: number;
  vida_util_sistema: number;
  geracao_mensal_por_kwp: number;
  custo_por_kwp: number;
  kg_co2_por_kwh: number;
  // Solaryum integration
  solaryum_token_vertys: string;
  solaryum_token_jng: string;
  solaryum_cif_descarga: boolean;
  solaryum_ibge_fallback: string;
  // Gateway de cobrança
  gateway_preferido: string;
  pagseguro_token: string;
  pagseguro_sandbox: boolean;
  asaas_token: string;
  asaas_sandbox: boolean;
  inter_client_id: string;
  inter_client_secret: string;
  inter_sandbox: boolean;
  sicoob_client_id: string;
  sicoob_sandbox: boolean;
  cobranca_multa_percentual: number;
  cobranca_juros_percentual: number;
  cobranca_dias_vencimento: number;
  // Notificações WA de pagamento
  wa_notif_pagamento: boolean;
  wa_notif_quitado: boolean;
  wa_notif_numero: string;
  // Templates WA de instalação
  wa_template_agendamento_instalacao: string;
  wa_template_reagendamento_instalacao: string;
  // Concessionária config
  concessionaria_motivos_reprovacao: string[];
  concessionaria_prazo_vistoria_dias: number;
}

export interface SombreamentoLevel {
  tradicional: number;
  microinversor: number;
  otimizador: number;
}

export interface SombreamentoConfig {
  pouco: SombreamentoLevel;
  medio: SombreamentoLevel;
  alto: SombreamentoLevel;
}

export const DEFAULT_SOMBREAMENTO_CONFIG: SombreamentoConfig = {
  pouco: { tradicional: 12, microinversor: 6, otimizador: 6 },
  medio: { tradicional: 25, microinversor: 12, otimizador: 12 },
  alto: { tradicional: 37, microinversor: 18, otimizador: 18 },
};

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
  imposto_energia: 18.00,
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
  fornecedor_filtro: "escolher",
  sombreamento_config: { ...DEFAULT_SOMBREAMENTO_CONFIG },
  // Monitoring losses
  shading_loss_percent: 8,
  soiling_loss_percent: 5,
  other_losses_percent: 12,
  // Solar Brain fields
  percentual_economia: 90,
  vida_util_sistema: 25,
  geracao_mensal_por_kwp: 130,
  custo_por_kwp: 5500,
  kg_co2_por_kwh: 0.084,
  // Solaryum integration
  solaryum_token_vertys: "",
  solaryum_token_jng: "",
  solaryum_cif_descarga: false,
  solaryum_ibge_fallback: "",
  // Gateway de cobrança
  gateway_preferido: "pagseguro",
  pagseguro_token: "",
  pagseguro_sandbox: true,
  asaas_token: "",
  asaas_sandbox: true,
  inter_client_id: "",
  inter_client_secret: "",
  inter_sandbox: true,
  sicoob_client_id: "",
  sicoob_sandbox: true,
  cobranca_multa_percentual: 2.00,
  cobranca_juros_percentual: 1.00,
  cobranca_dias_vencimento: 30,
  // Notificações WA de pagamento
  wa_notif_pagamento: true,
  wa_notif_quitado: true,
  wa_notif_numero: "",
  // Templates WA de instalação
  wa_template_agendamento_instalacao: "Olá {{nome_cliente}}! Sua instalação solar está agendada para {{data}} às {{hora}}. Qualquer dúvida, fale com {{consultor}}.",
  wa_template_reagendamento_instalacao: "Olá {{nome_cliente}}! Sua instalação foi reagendada para {{data}} às {{hora}}. Motivo: {{motivo}}. Qualquer dúvida, fale com {{consultor}}.",
  concessionaria_motivos_reprovacao: ["Projeto em desacordo", "Documentação incompleta", "Equipamento incompatível", "Problemas no aterramento", "Inversor não homologado", "Estrutura inadequada"],
  concessionaria_prazo_vistoria_dias: 30,
};

export interface RoofAreaFactor {
  id?: string;
  tenant_id?: string;
  tipo_telhado: string;
  label?: string;
  fator_area: number;
  inclinacao_padrao?: number;
  desvio_azimutal_padrao?: number;
  topologias_permitidas?: string[];
  tipos_sistema_permitidos?: string[];
  enabled: boolean;
}

export const ROOF_LABELS: Record<string, string> = {
  carport: "Carport",
  ceramico: "Cerâmico",
  fibrocimento: "Fibrocimento",
  laje: "Laje",
  shingle: "Shingle",
  metalico: "Metálico",
  zipado: "Zipado",
  solo: "Solo",
};

export const TOPOLOGIA_OPTIONS = [
  { value: "tradicional", label: "Tradicional" },
  { value: "microinversor", label: "Microinversor" },
  { value: "otimizador", label: "Otimizador" },
] as const;

export const TIPO_SISTEMA_OPTIONS = [
  { value: "on_grid", label: "On Grid" },
  { value: "hibrido", label: "Híbrido" },
  { value: "off_grid", label: "Off Grid" },
] as const;

export const DEFAULT_ROOF_FACTORS: RoofAreaFactor[] = [
  { tipo_telhado: "carport", label: "Carport", fator_area: 1.30, inclinacao_padrao: 0, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor", "otimizador"], tipos_sistema_permitidos: ["on_grid", "hibrido", "off_grid"], enabled: true },
  { tipo_telhado: "ceramico", label: "Cerâmico", fator_area: 1.20, inclinacao_padrao: 20, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor"], tipos_sistema_permitidos: ["on_grid", "hibrido"], enabled: true },
  { tipo_telhado: "fibrocimento", label: "Fibrocimento", fator_area: 1.20, inclinacao_padrao: 10, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor", "otimizador"], tipos_sistema_permitidos: ["on_grid", "hibrido"], enabled: true },
  { tipo_telhado: "laje", label: "Laje", fator_area: 1.20, inclinacao_padrao: 10, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor", "otimizador"], tipos_sistema_permitidos: ["on_grid", "hibrido", "off_grid"], enabled: true },
  { tipo_telhado: "shingle", label: "Shingle", fator_area: 1.20, inclinacao_padrao: 20, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor"], tipos_sistema_permitidos: ["on_grid", "hibrido"], enabled: true },
  { tipo_telhado: "metalico", label: "Metálico", fator_area: 1.20, inclinacao_padrao: 10, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor", "otimizador"], tipos_sistema_permitidos: ["on_grid", "hibrido"], enabled: true },
  { tipo_telhado: "zipado", label: "Zipado", fator_area: 1.20, inclinacao_padrao: 10, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional", "microinversor", "otimizador"], tipos_sistema_permitidos: ["on_grid", "hibrido"], enabled: true },
  { tipo_telhado: "solo", label: "Solo", fator_area: 1.60, inclinacao_padrao: 15, desvio_azimutal_padrao: 0, topologias_permitidas: ["tradicional"], tipos_sistema_permitidos: ["on_grid"], enabled: true },
];

/** Returns the display label for a roof factor */
export function getRoofLabel(f: RoofAreaFactor): string {
  return f.label || ROOF_LABELS[f.tipo_telhado] || f.tipo_telhado;
}

// ─── Hook ──────────────────────────────────────────

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tenantPremisesService } from "@/services/admin/tenantPremisesService";

export function useTenantPremises() {
  const qc = useQueryClient();
  const savedRef = useRef<string>("");

  const { data, isLoading: loading } = useQuery({
    queryKey: ["tenant-premises"],
    queryFn: () => tenantPremisesService.fetchAll(),
    staleTime: 1000 * 60 * 5,
  });

  const [premises, setPremises] = useState<TenantPremises>(PREMISES_DEFAULTS);
  const [roofFactors, setRoofFactors] = useState<RoofAreaFactor[]>(DEFAULT_ROOF_FACTORS);

  useEffect(() => {
    if (data?.premises) {
      setPremises({ ...PREMISES_DEFAULTS, ...data.premises });
      savedRef.current = JSON.stringify(data.premises);
    }
    if (data?.roofFactors && data.roofFactors.length > 0) {
      setRoofFactors(data.roofFactors);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: (p: Partial<TenantPremises>) => tenantPremisesService.savePremises(p),
    onSuccess: (res: any) => {
      if (res?.id) {
        setPremises(prev => ({ ...prev, id: res.id, tenant_id: res.tenant_id }));
      }
      savedRef.current = JSON.stringify(premises);
      qc.invalidateQueries({ queryKey: ["tenant-premises"] });
      toast.success("Premissas salvas com sucesso");
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar premissas", { description: e.message });
    }
  });

  const saveRoofFactorsMutation = useMutation({
    mutationFn: (factors: RoofAreaFactor[]) => tenantPremisesService.saveRoofFactors(factors),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tenant-premises"] });
      toast.success("Fatores de telhado salvos");
    },
    onError: (e: any) => {
      toast.error("Erro ao salvar fatores", { description: e.message });
    }
  });

  const isDirty = JSON.stringify(premises) !== savedRef.current;

  const save = useCallback(async () => {
    if (!premises.tusd_fio_b_bt || premises.tusd_fio_b_bt <= 0) {
      toast.error("Tarifa Fio B obrigatória", {
        description: "Informe o valor do TUSD Fio B (BT) da sua concessionária na aba Valores Padrões → Tarifas.",
      });
      return;
    }
    saveMutation.mutate(premises);
  }, [premises, saveMutation]);

  const saveRoofFactors = useCallback((factors: RoofAreaFactor[]) => {
    saveRoofFactorsMutation.mutate(factors);
  }, [saveRoofFactorsMutation]);

  const reset = useCallback(() => {
    const saved = savedRef.current ? JSON.parse(savedRef.current) : PREMISES_DEFAULTS;
    setPremises(saved);
  }, []);

  return {
    premises, setPremises,
    roofFactors, setRoofFactors,
    loading, 
    saving: saveMutation.isPending || saveRoofFactorsMutation.isPending, 
    isDirty,
    save, saveRoofFactors, reset, reload: () => qc.invalidateQueries({ queryKey: ["tenant-premises"] }),
  };
}
