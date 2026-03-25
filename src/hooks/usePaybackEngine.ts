import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

// ─── Types ──────────────────────────────────────────────────────
export interface PaybackConfig {
  custo_disponibilidade_monofasico: number;
  custo_disponibilidade_bifasico: number;
  custo_disponibilidade_trifasico: number;
  taxas_fixas_mensais: number;
  degradacao_anual_painel: number;
  reajuste_anual_tarifa: number;
  tarifa_fio_b_padrao: number;
}

export interface FioBEscalonamento {
  ano: number;
  percentual_nao_compensado: number;
}

export interface ConfigTributaria {
  aliquota_icms: number;
  possui_isencao_scee: boolean;
  percentual_isencao: number;
  observacoes: string | null;
}

export type RegimeCompensacao = "gd1" | "gd2";
export type TipoLigacao = "monofasico" | "bifasico" | "trifasico";

export interface PaybackInput {
  consumoMensal: number;
  tarifaKwh: number;
  custoSistema: number;
  geracaoMensalKwh: number;
  estado: string;
  regime: RegimeCompensacao;
  tipoLigacao: TipoLigacao;
  tarifaFioB?: number; // override from concessionaria
  custoDisponibilidade?: number; // override from concessionaria
  concessionariaId?: string; // when set, loads ICMS from concessionaria first
}

export interface PaybackScenario {
  label: string;
  economiaBruta: number;
  custoFioB: number;
  contaInevitavel: number;
  economiaLiquida: number;
  paybackMeses: number;
  paybackAnos: number;
  tarifaCompensavelLiquida: number;
  kwhCompensado: number;
  percentualFioB: number;
}

export interface PaybackResult {
  conservador: PaybackScenario;
  otimista: PaybackScenario;
  fioBImpactoAnual: { ano: number; percentual: number; custoFioB: number; economiaLiquida: number }[];
  configUsada: {
    icms: number;
    isencaoScee: boolean;
    percentualIsencao: number;
    percentualFioBAtual: number;
    custoDisponibilidade: number;
    taxasFixas: number;
  };
  alertas: string[];
}

const DEFAULT_PAYBACK_CONFIG: PaybackConfig = {
  custo_disponibilidade_monofasico: 30,
  custo_disponibilidade_bifasico: 50,
  custo_disponibilidade_trifasico: 100,
  taxas_fixas_mensais: 0,
  degradacao_anual_painel: 0.8,
  reajuste_anual_tarifa: 5.0,
  tarifa_fio_b_padrao: 0.40,
};

const DEFAULT_TRIBUTARIA: ConfigTributaria = {
  aliquota_icms: 18,
  possui_isencao_scee: false,
  percentual_isencao: 0,
  observacoes: null,
};

// ─── Hook ───────────────────────────────────────────────────────
export function usePaybackEngine() {
  const [paybackConfig, setPaybackConfig] = useState<PaybackConfig>(DEFAULT_PAYBACK_CONFIG);
  const [fioBSchedule, setFioBSchedule] = useState<FioBEscalonamento[]>([]);
  const [tributariaCache, setTributariaCache] = useState<Record<string, ConfigTributaria>>({});
  const [loading, setLoading] = useState(true);
  const [alertas, setAlertas] = useState<string[]>([]);

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    const alerts: string[] = [];

    try {
      // Load all configs in parallel
      const [paybackRes, fioBRes] = await Promise.all([
        supabase.from("payback_config").select("id, custo_disponibilidade_monofasico, custo_disponibilidade_bifasico, custo_disponibilidade_trifasico, taxas_fixas_mensais, degradacao_anual_painel, reajuste_anual_tarifa, tarifa_fio_b_padrao").limit(1).single(),
        supabase.from("fio_b_escalonamento").select("id, ano, percentual_nao_compensado").order("ano", { ascending: true }),
      ]);

      if (paybackRes.data) {
        setPaybackConfig({
          custo_disponibilidade_monofasico: Number(paybackRes.data.custo_disponibilidade_monofasico),
          custo_disponibilidade_bifasico: Number(paybackRes.data.custo_disponibilidade_bifasico),
          custo_disponibilidade_trifasico: Number(paybackRes.data.custo_disponibilidade_trifasico),
          taxas_fixas_mensais: Number(paybackRes.data.taxas_fixas_mensais),
          degradacao_anual_painel: Number(paybackRes.data.degradacao_anual_painel),
          reajuste_anual_tarifa: Number(paybackRes.data.reajuste_anual_tarifa),
          tarifa_fio_b_padrao: Number(paybackRes.data.tarifa_fio_b_padrao),
        });
      } else {
        alerts.push("Configuração de payback não encontrada. Usando valores padrão do mercado.");
      }

      if (fioBRes.data && fioBRes.data.length > 0) {
        setFioBSchedule(fioBRes.data.map(f => ({
          ano: f.ano,
          percentual_nao_compensado: Number(f.percentual_nao_compensado),
        })));
      } else {
        alerts.push("Escalonamento do Fio B não configurado. Usando valores padrão da Lei 14.300.");
        setFioBSchedule([
          { ano: 2023, percentual_nao_compensado: 15 },
          { ano: 2024, percentual_nao_compensado: 30 },
          { ano: 2025, percentual_nao_compensado: 45 },
          { ano: 2026, percentual_nao_compensado: 60 },
          { ano: 2027, percentual_nao_compensado: 75 },
          { ano: 2028, percentual_nao_compensado: 90 },
        ]);
      }

      setAlertas(alerts);
    } catch (error) {
      console.error("Erro ao carregar configurações de payback:", error);
      alerts.push("Erro ao carregar configurações. Usando valores padrão do mercado.");
      setAlertas(alerts);
    } finally {
      setLoading(false);
    }
  };

  // Load tributária config from concessionária (if available) or state fallback
  const loadTributaria = async (estado: string, concessionariaId?: string): Promise<ConfigTributaria> => {
    const cacheKey = concessionariaId ? `conc_${concessionariaId}` : estado;
    if (tributariaCache[cacheKey]) return tributariaCache[cacheKey];

    try {
      // 1) Try concessionária-specific ICMS if provided
      if (concessionariaId) {
        const { data: concData } = await supabase
          .from("concessionarias")
          .select("aliquota_icms, possui_isencao_scee, percentual_isencao, estado")
          .eq("id", concessionariaId)
          .limit(1)
          .single();

        if (concData) {
          // If concessionária has its own ICMS values, use them
          const hasOwnIcms = concData.aliquota_icms != null || concData.possui_isencao_scee != null;
          if (hasOwnIcms) {
            // Load state defaults for any NULL fields
            const stateConfig = await loadStateTributaria(concData.estado || estado);
            const config: ConfigTributaria = {
              aliquota_icms: concData.aliquota_icms != null ? Number(concData.aliquota_icms) : stateConfig.aliquota_icms,
              possui_isencao_scee: concData.possui_isencao_scee != null ? concData.possui_isencao_scee : stateConfig.possui_isencao_scee,
              percentual_isencao: concData.percentual_isencao != null ? Number(concData.percentual_isencao) : stateConfig.percentual_isencao,
              observacoes: `Concessionária com ICMS próprio`,
            };
            setTributariaCache(prev => ({ ...prev, [cacheKey]: config }));
            return config;
          }
        }
      }

      // 2) Fallback to state config
      return await loadStateTributaria(estado);
    } catch {
      return DEFAULT_TRIBUTARIA;
    }
  };

  // Load state-level tributária config
  const loadStateTributaria = async (estado: string): Promise<ConfigTributaria> => {
    if (tributariaCache[estado]) return tributariaCache[estado];

    try {
      const { data, error } = await supabase
        .from("config_tributaria_estado")
        .select("aliquota_icms, possui_isencao_scee, percentual_isencao, observacoes")
        .eq("estado", estado)
        .limit(1)
        .single();

      if (error || !data) {
        return DEFAULT_TRIBUTARIA;
      }

      const config: ConfigTributaria = {
        aliquota_icms: Number(data.aliquota_icms),
        possui_isencao_scee: data.possui_isencao_scee,
        percentual_isencao: Number(data.percentual_isencao),
        observacoes: data.observacoes,
      };

      setTributariaCache(prev => ({ ...prev, [estado]: config }));
      return config;
    } catch {
      return DEFAULT_TRIBUTARIA;
    }
  };

  // Get Fio B percentage for a given year
  const getFioBPercentual = (ano: number): number => {
    // Find the matching or most recent year <= ano
    const sorted = [...fioBSchedule].sort((a, b) => b.ano - a.ano);
    const match = sorted.find(f => f.ano <= ano);
    return match ? match.percentual_nao_compensado / 100 : 0.9; // default to 90% if beyond schedule
  };

  // Get custo de disponibilidade by tipo_ligacao
  const getCustoDisponibilidade = (tipo: TipoLigacao, override?: number): number => {
    if (override && override > 0) return override;
    switch (tipo) {
      case "monofasico": return paybackConfig.custo_disponibilidade_monofasico;
      case "bifasico": return paybackConfig.custo_disponibilidade_bifasico;
      case "trifasico": return paybackConfig.custo_disponibilidade_trifasico;
      default: return paybackConfig.custo_disponibilidade_monofasico;
    }
  };

  // ─── Core Calculation ─────────────────────────────────────────
  const calcularPayback = async (input: PaybackInput): Promise<PaybackResult> => {
    const tributaria = await loadTributaria(input.estado, input.concessionariaId);
    const anoAtual = new Date().getFullYear();
    const percentualFioB = input.regime === "gd1" ? 0 : getFioBPercentual(anoAtual);
    const tarifaFioB = input.tarifaFioB && input.tarifaFioB > 0
      ? input.tarifaFioB
      : paybackConfig.tarifa_fio_b_padrao;
    const custoDisponibilidade = getCustoDisponibilidade(input.tipoLigacao, input.custoDisponibilidade);
    const taxasFixas = paybackConfig.taxas_fixas_mensais;
    const resultAlertas = [...alertas];

    // Check for missing data and add alerts
    if (!input.tarifaFioB || input.tarifaFioB === 0) {
      resultAlertas.push("Recomendado configurar tarifa Fio B da concessionária para maior precisão.");
    }

    // PASSO 1: kWh compensado (first year baseline)
    // @TODO: Injeção de energia (Créditos futuros) não contemplada, refinar usando saldo de crédito mensal equivalente a calcSeries25
    const kwhCompensado = Math.min(input.geracaoMensalKwh, input.consumoMensal);

    // PASSO 2: Conta inevitável (fixa)
    const contaInevitavel = custoDisponibilidade + taxasFixas;

    // ─── Helper: Iterative payback with degradation + tariff adjustment ───
    const calcIterativePayback = (tarifaCompensavel: number, fioBFraction: number): {
      paybackMeses: number;
      economiaBruta: number;
      custoFioB: number;
      economiaLiquida: number;
    } => {
      const degradacao = paybackConfig.degradacao_anual_painel / 100; // e.g. 0.008
      const reajuste = paybackConfig.reajuste_anual_tarifa / 100; // e.g. 0.05

      // First-month values (for display / scenario summary)
      const economiaBruta0 = kwhCompensado * tarifaCompensavel;
      const custoFioB0 = input.regime === "gd1" ? 0 : kwhCompensado * tarifaFioB * fioBFraction;
      const economiaLiquida0 = Math.max(0, economiaBruta0 - custoFioB0 - contaInevitavel);

      // Iterative payback: month-by-month accumulation
      let accumulated = 0;
      const maxMonths = 30 * 12; // 30 years max
      let paybackMeses = Infinity;

      for (let m = 1; m <= maxMonths; m++) {
        const yearIndex = Math.floor((m - 1) / 12);
        // Apply degradation: generation decreases each year
        const geracaoFator = Math.pow(1 - degradacao, yearIndex);
        // Apply tariff increase: tariff increases each year
        const tarifaFator = Math.pow(1 + reajuste, yearIndex);
        // Update Fio B percentage for this year
        const anoAtualIter = anoAtual + yearIndex;
        const fioBPctIter = input.regime === "gd1" ? 0 : getFioBPercentual(anoAtualIter);

        const kwhComp = kwhCompensado * geracaoFator;
        const tarifaAdj = tarifaCompensavel * tarifaFator;
        const fioBAdj = tarifaFioB * tarifaFator;

        const econMes = kwhComp * tarifaAdj;
        const fioBMes = input.regime === "gd1" ? 0 : kwhComp * fioBAdj * fioBPctIter;
        const econLiq = Math.max(0, econMes - fioBMes - contaInevitavel);

        accumulated += econLiq;
        if (accumulated >= input.custoSistema && paybackMeses === Infinity) {
          paybackMeses = m;
          break;
        }
      }

      return {
        paybackMeses,
        economiaBruta: economiaBruta0,
        custoFioB: custoFioB0,
        economiaLiquida: economiaLiquida0,
      };
    };

    // ─── Cenário CONSERVADOR ─────────────────────────────────
    // Assume sem isenção ICMS (pior caso), ICMS integral
    const icmsConservador = tributaria.aliquota_icms / 100;
    const tarifaCompensavelConservadora = input.tarifaKwh * (1 - icmsConservador);

    const conservadorCalc = calcIterativePayback(tarifaCompensavelConservadora, percentualFioB);

    // ─── Cenário OTIMISTA ────────────────────────────────────
    // Aplica isenção ICMS quando disponível
    let icmsOtimista = icmsConservador;
    if (tributaria.possui_isencao_scee) {
      const isencaoFator = tributaria.percentual_isencao / 100;
      icmsOtimista = icmsConservador * (1 - isencaoFator);
    }
    const tarifaCompensavelOtimista = input.tarifaKwh * (1 - icmsOtimista);

    const otimistaCalc = calcIterativePayback(tarifaCompensavelOtimista, percentualFioB);

    // ─── Impacto Fio B ao longo dos anos (with degradation + reajuste) ───
    const fioBImpactoAnual: PaybackResult["fioBImpactoAnual"] = [];
    if (input.regime === "gd2") {
      const degradacao = paybackConfig.degradacao_anual_painel / 100;
      const reajuste = paybackConfig.reajuste_anual_tarifa / 100;
      for (let ano = 2023; ano <= 2033; ano++) {
        const yearIndex = ano - anoAtual;
        const geracaoFator = yearIndex >= 0 ? Math.pow(1 - degradacao, yearIndex) : 1;
        const tarifaFator = yearIndex >= 0 ? Math.pow(1 + reajuste, yearIndex) : 1;
        const pct = getFioBPercentual(ano);
        const kwhComp = kwhCompensado * geracaoFator;
        const custoFiob = kwhComp * tarifaFioB * tarifaFator * pct;
        const economiaAno = (kwhComp * tarifaCompensavelOtimista * tarifaFator) - custoFiob - contaInevitavel;
        fioBImpactoAnual.push({
          ano,
          percentual: pct * 100,
          custoFioB: custoFiob,
          economiaLiquida: Math.max(0, economiaAno),
        });
      }
    }

    // Guard Infinity: se payback nunca foi atingido, limitar a 31 anos (inviável)
    const safePaybackAnos = (meses: number) =>
      !isFinite(meses) ? 31 : meses / 12;

    return {
      conservador: {
        label: "Conservador",
        economiaBruta: conservadorCalc.economiaBruta,
        custoFioB: conservadorCalc.custoFioB,
        contaInevitavel,
        economiaLiquida: conservadorCalc.economiaLiquida,
        paybackMeses: isFinite(conservadorCalc.paybackMeses) ? conservadorCalc.paybackMeses : 372,
        paybackAnos: safePaybackAnos(conservadorCalc.paybackMeses),
        tarifaCompensavelLiquida: tarifaCompensavelConservadora,
        kwhCompensado,
        percentualFioB: percentualFioB * 100,
      },
      otimista: {
        label: "Otimista",
        economiaBruta: otimistaCalc.economiaBruta,
        custoFioB: otimistaCalc.custoFioB,
        contaInevitavel,
        economiaLiquida: otimistaCalc.economiaLiquida,
        paybackMeses: isFinite(otimistaCalc.paybackMeses) ? otimistaCalc.paybackMeses : 372,
        paybackAnos: safePaybackAnos(otimistaCalc.paybackMeses),
        tarifaCompensavelLiquida: tarifaCompensavelOtimista,
        kwhCompensado,
        percentualFioB: percentualFioB * 100,
      },
      fioBImpactoAnual,
      configUsada: {
        icms: tributaria.aliquota_icms,
        isencaoScee: tributaria.possui_isencao_scee,
        percentualIsencao: tributaria.percentual_isencao,
        percentualFioBAtual: percentualFioB * 100,
        custoDisponibilidade,
        taxasFixas,
      },
      alertas: resultAlertas,
    };
  };

  return {
    calcularPayback,
    paybackConfig,
    fioBSchedule,
    loading,
    getFioBPercentual,
    loadTributaria,
  };
}
