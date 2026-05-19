import { useMemo } from "react";
import { useWizardContext } from "../WizardContext";
import { calcPrecoFinal, resolveCustoKit } from "../types";
import { calcularSerieFinanceira25Anos } from "../utils/financingMath";

export function useSolarCalculation() {
  const {
    ucs,
    potenciaKwp,
    locIrradiacao,
    itens,
    servicos,
    venda,
    premissas,
    preDimensionamento,
  } = useWizardContext();

  const results = useMemo(() => {
    // 1. Basic metrics
    const consumoTotal = ucs.reduce((s, u) => {
      if (u.grupo_tarifario === "A") return s + (u.consumo_mensal_p || 0) + (u.consumo_mensal_fp || 0);
      return s + (u.consumo_mensal || 0);
    }, 0);

    const irrad = locIrradiacao || 4.5;
    // Fator de geração (kWh/kWp/mês) = irradiação * 30 * eficiência
    // Usamos o fator de geração da topologia tradicional como base
    const fatorGeracao = preDimensionamento.fator_geracao || (irrad * 30 * 0.80);
    
    const geracaoMensalEstimada = potenciaKwp * fatorGeracao;
    const offset = consumoTotal > 0 ? (geracaoMensalEstimada / consumoTotal) * 100 : 0;

    // 2. Potência Sugerida
    const potenciaSugeridaKwp = consumoTotal > 0 ? (consumoTotal / fatorGeracao) : 0;

    // 3. Equipment details
    const modulos = itens.filter(i => i.categoria === "modulo");
    const inversores = itens.filter(i => i.categoria === "inversor");
    const totalModulos = modulos.reduce((s, m) => s + m.quantidade, 0);
    const totalPotenciaInversores = inversores.reduce((s, i) => s + (i.potencia_w * i.quantidade) / 1000, 0);

    // 4. Financials
    const precoFinal = calcPrecoFinal(itens, servicos, venda);
    
    // 5. Payback & ROI (using financingMath)
    const financialInput = {
      precoFinal,
      potenciaKwp,
      irradiacao: irrad,
      geracaoMensalKwh: geracaoMensalEstimada,
      consumoTotal,
      tarifaBase: ucs[0]?.tarifa_distribuidora || 0.85,
      custoDisponibilidade: ucs[0]?.custo_disponibilidade_valor || 50,
      premissas,
      regra: ucs[0]?.regra || "GD2",
      fase: ucs[0]?.fase || "bifasico",
      grupo: ucs[0]?.grupo_tarifario || "B",
      tarifaFioB: ucs[0]?.tarifa_fio_b || 0,
    };

    const financialData = calcularSerieFinanceira25Anos(financialInput);
    
    const areaEstimada = totalModulos * 2.2; // ~2.2m² por módulo
    const economiaAnual = financialData.economia_anual || (financialData.economia_mensal * 12);
    
    // 6. Alerts
    const alertas: string[] = [];
    if (potenciaKwp > 0) {
      if (totalModulos === 0) alertas.push("Nenhum módulo selecionado");
      if (totalPotenciaInversores === 0) alertas.push("Nenhum inversor selecionado");
      
      const oversizing = totalPotenciaInversores > 0 ? (potenciaKwp / totalPotenciaInversores) : 0;
      if (oversizing > 1.4) alertas.push("Oversizing alto (> 140%)");
      if (oversizing < 0.8 && totalPotenciaInversores > 0) alertas.push("Inversor subutilizado (< 80%)");

      // Redes Monofásicas geralmente limitam a 7.5kW ou 10kW
      const fase = ucs[0]?.fase || "bifasico";
      if (fase === "monofasico" && potenciaKwp > 8) {
        alertas.push("Potência alta para rede monofásica");
      }

      // Se a geração é muito maior que o consumo (offset > 120%)
      if (offset > 120) {
        alertas.push("Geração muito superior ao consumo");
      }
    }


    return {
      consumoTotal,
      potenciaSugeridaKwp,
      geracaoMensalEstimada,
      offset,
      totalModulos,
      totalPotenciaInversores,
      areaEstimada,
      precoFinal,
      economiaMensal: financialData.economia_mensal,
      paybackAnos: financialData.payback_meses / 12,
      roiPercent: financialData.tir * 100, // Usando TIR como proxy para ROI simplificado
      alertas,
    };
  }, [ucs, potenciaKwp, locIrradiacao, itens, servicos, venda, premissas, preDimensionamento]);

  return results;
}
