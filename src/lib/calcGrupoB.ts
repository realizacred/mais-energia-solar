// ──────────────────────────────────────────────────────────────────────────────
// Motor de Cálculo Grupo B — 2026
// Regras: Lei 14.300 (GD I/II/III) com escalonamento Fio B conforme ANEEL
// Todas as regras aqui são DETERMINÍSTICAS e auditáveis.
// ──────────────────────────────────────────────────────────────────────────────

export type RegraGD = "GD_I" | "GD_II" | "GD_III";
export type TipoFase = "monofasico" | "bifasico" | "trifasico";

/** Percentual do Fio B compensável por ano (Lei 14.300) */
export const GD_FIO_B_PERCENT_BY_YEAR: Record<number, number> = {
  2023: 0.90, // 90% pago pelo prosumidor
  2024: 0.80,
  2025: 0.70,
  2026: 0.60, // 2026 = 60% Fio B cobrado (ou 40% compensável)
  2027: 0.50,
  2028: 0.40,
  2029: 0.30,
};

/** Percentual do Fio B que NÃO é compensado (é cobrado) */
export function getFioBCobranca(ano = 2026): number {
  return GD_FIO_B_PERCENT_BY_YEAR[ano] ?? 0.60;
}

export interface TariffComponentes {
  te_kwh: number;               // Tarifa de Energia (R$/kWh)
  tusd_fio_b_kwh: number;       // Fio B (R$/kWh)
  tusd_fio_a_kwh?: number;      // Fio A — apenas GD III
  tfsee_kwh?: number;           // TFSEE — apenas GD III
  pnd_kwh?: number;             // P&D — apenas GD III
  vigencia_inicio?: string;     // Data de vigência
  origem?: string;              // "ANEEL" | "manual" | "premissa"
  validation_status?: string;
}

export interface CustoDisponibilidade {
  monofasico: number;   // kWh/mês cobrados mesmo sem consumir
  bifasico: number;
  trifasico: number;
}

export interface CalcGrupoBInput {
  regra: RegraGD;
  fase: TipoFase;
  geracao_mensal_kwh: number;
  consumo_mensal_kwh: number;
  tariff: TariffComponentes;
  custo_disponibilidade: CustoDisponibilidade;
  ano?: number; // default 2026
}

export interface CalcGrupoBResult {
  // Inputs reprocessados
  geracao_kwh: number;
  consumo_kwh: number;
  // Custo de disponibilidade
  custo_disponibilidade_kwh: number;
  // Compensação
  consumo_compensavel_kwh: number;
  energia_compensada_kwh: number;
  // Tarifação
  regra_aplicada: RegraGD;
  fio_b_percent_cobrado: number;    // ex: 0.60 para 2026
  valor_credito_kwh: number;        // R$/kWh do crédito
  valor_credito_breakdown: {
    te: number;
    fio_b_compensado: number;
    fio_a?: number;
    tfsee?: number;
    pnd?: number;
  };
  // Resultado
  economia_mensal_rs: number;
  // Auditoria
  vigencia_tariff?: string;
  origem_tariff: string;
  incompleto_gd3: boolean;
  alertas: string[];
}

/**
 * Calcula a economia mensal de um prosumidor Grupo B.
 * Função pura, determinística, auditável.
 */
export function calcGrupoB(input: CalcGrupoBInput): CalcGrupoBResult {
  const { regra, fase, geracao_mensal_kwh, consumo_mensal_kwh, tariff, custo_disponibilidade, ano = 2026 } = input;
  const alertas: string[] = [];
  let incompleto_gd3 = false;

  // 1. Custo de disponibilidade (kWh/mês mínimos cobrados pela distribuidora)
  const custo_disp_kwh =
    fase === "monofasico" ? custo_disponibilidade.monofasico :
    fase === "bifasico"  ? custo_disponibilidade.bifasico :
    custo_disponibilidade.trifasico;

  // 2. Consumo compensável (consumo acima do custo mínimo)
  const consumo_compensavel_kwh = Math.max(consumo_mensal_kwh - custo_disp_kwh, 0);

  // 3. Energia efetivamente compensada (limitada ao que foi gerado)
  const energia_compensada_kwh = Math.min(geracao_mensal_kwh, consumo_compensavel_kwh);

  // 4. Valor do crédito por kWh (depende da regra GD)
  const fioBCobranca = getFioBCobranca(ano);
  const fioBCompensado = 1 - fioBCobranca; // porção do Fio B que é COMPENSADA
  let valor_credito_kwh = 0;
  const breakdown = {
    te: 0,
    fio_b_compensado: 0,
    fio_a: undefined as number | undefined,
    tfsee: undefined as number | undefined,
    pnd: undefined as number | undefined,
  };

  if (regra === "GD_I") {
    // GD I: 100% compensável (TUSD + TE) — regime antigo ainda em transição
    valor_credito_kwh = tariff.te_kwh + tariff.tusd_fio_b_kwh;
    breakdown.te = tariff.te_kwh;
    breakdown.fio_b_compensado = tariff.tusd_fio_b_kwh;
    alertas.push("GD I — regime de compensação integral (sem escalonamento Fio B)");

  } else if (regra === "GD_II") {
    // GD II 2026: TE + (1 - cobrança%) × FioB
    // Em 2026: 60% cobrado → 40% compensado
    const fioB_compensado_kwh = tariff.tusd_fio_b_kwh * fioBCompensado;
    valor_credito_kwh = tariff.te_kwh + fioB_compensado_kwh;
    breakdown.te = tariff.te_kwh;
    breakdown.fio_b_compensado = fioB_compensado_kwh;
    if (fioBCompensado === 0) alertas.push("Atenção: Fio B 100% cobrado neste ano — sem compensação Fio B");

  } else if (regra === "GD_III") {
    // GD III: TE + 1.0×FioB + 0.40×FioA + TFSEE + P&D
    // GD III tem compensação MAIOR (inclui componentes de alta tensão)
    const fioA = tariff.tusd_fio_a_kwh ?? 0;
    const tfsee = tariff.tfsee_kwh ?? 0;
    const pnd = tariff.pnd_kwh ?? 0;

    if (!tariff.tusd_fio_a_kwh) {
      incompleto_gd3 = true;
      alertas.push("GD III incompleto: Fio A não disponível — economia estimada sem este componente");
    }
    if (!tariff.tfsee_kwh) alertas.push("TFSEE não disponível — usando zero");
    if (!tariff.pnd_kwh) alertas.push("P&D não disponível — usando zero");

    const fioB_compensado_kwh = tariff.tusd_fio_b_kwh; // GD III: 100% Fio B compensado
    const fioA_parcial = fioA * 0.40; // 40% do Fio A
    valor_credito_kwh = tariff.te_kwh + fioB_compensado_kwh + fioA_parcial + tfsee + pnd;
    breakdown.te = tariff.te_kwh;
    breakdown.fio_b_compensado = fioB_compensado_kwh;
    breakdown.fio_a = fioA_parcial;
    breakdown.tfsee = tfsee;
    breakdown.pnd = pnd;
  }

  // 5. Economia mensal
  const economia_mensal_rs = Math.round(energia_compensada_kwh * valor_credito_kwh * 100) / 100;

  // Alertas adicionais
  if (tariff.validation_status === 'atencao') alertas.push("Tarifa com dados suspeitos — revisar com distribuidora");
  if (!tariff.te_kwh || tariff.te_kwh <= 0) alertas.push("TE não configurada — resultado pode estar incorreto");

  return {
    geracao_kwh: geracao_mensal_kwh,
    consumo_kwh: consumo_mensal_kwh,
    custo_disponibilidade_kwh: custo_disp_kwh,
    consumo_compensavel_kwh,
    energia_compensada_kwh,
    regra_aplicada: regra,
    fio_b_percent_cobrado: fioBCobranca,
    valor_credito_kwh: Math.round(valor_credito_kwh * 1000000) / 1000000,
    valor_credito_breakdown: breakdown,
    economia_mensal_rs,
    vigencia_tariff: tariff.vigencia_inicio,
    origem_tariff: tariff.origem || 'desconhecida',
    incompleto_gd3,
    alertas,
  };
}

/** Formata origem para badge de auditoria */
export function formatOrigem(origem: string): { label: string; variant: "default" | "secondary" | "outline" | "destructive" } {
  switch (origem) {
    case 'ANEEL':     return { label: 'ANEEL', variant: 'default' };
    case 'premissa':  return { label: 'Premissa', variant: 'secondary' };
    case 'manual':    return { label: 'Editado', variant: 'outline' };
    default:          return { label: origem, variant: 'outline' };
  }
}
