// ──────────────────────────────────────────────────────────────────────────────
// Motor de Cálculo Grupo A — 2026
// Regras: Tarifa binômia (energia + demanda) para clientes MT/AT
// Solar reduz energia (ponta e fora ponta) mas NUNCA reduz demanda contratada.
// ──────────────────────────────────────────────────────────────────────────────

import { getFioBCobranca } from "./calcGrupoB.ts";

export type ModalidadeTarifaria = "verde" | "azul";

export interface CalcGrupoAInput {
  /** Geração mensal do sistema solar (kWh/mês) */
  geracao_mensal_kwh: number;
  /** Consumo mensal fora ponta (kWh) */
  consumo_fp_kwh: number;
  /** Consumo mensal ponta (kWh) */
  consumo_p_kwh: number;
  /** Demanda contratada (kW) — fixa, solar não reduz */
  demanda_contratada_kw: number;
  /** Tarifa TE ponta (R$/kWh) */
  tarifa_te_p: number;
  /** Tarifa TUSD ponta (R$/kWh) */
  tarifa_tusd_p: number;
  /** Tarifa TE fora ponta (R$/kWh) */
  tarifa_te_fp: number;
  /** Tarifa TUSD fora ponta (R$/kWh) */
  tarifa_tusd_fp: number;
  /** Tarifa de demanda consumo (R$/kW) */
  tarifa_demanda_rs: number;
  /** Tarifa Fio B ponta (R$/kWh) — usado para escalonamento GD II/III */
  tarifa_fio_b_p?: number;
  /** Tarifa Fio B fora ponta (R$/kWh) */
  tarifa_fio_b_fp?: number;
  /** Regra GD: GD1, GD2, GD3 */
  regra: "GD1" | "GD2" | "GD3";
  /** Ano para escalonamento Fio B (Lei 14.300). Default: 2026 */
  ano?: number;
}

export interface CalcGrupoAResult {
  // Custos SEM solar
  custo_energia_p_sem_solar: number;
  custo_energia_fp_sem_solar: number;
  custo_demanda_sem_solar: number;
  custo_total_sem_solar: number;
  // Redução pela solar
  energia_compensada_fp_kwh: number;
  energia_compensada_p_kwh: number;
  reducao_energia_fp_rs: number;
  reducao_energia_p_rs: number;
  desconto_fio_b_rs: number;
  // Custos COM solar
  custo_energia_p_com_solar: number;
  custo_energia_fp_com_solar: number;
  custo_demanda_com_solar: number; // igual ao sem solar
  custo_total_com_solar: number;
  // Resultado
  economia_mensal_rs: number;
  // Auditoria
  demanda_inalterada: boolean;
  fio_b_percent_cobrado: number | null;
  alertas: string[];
}

/**
 * Calcula a economia mensal de um prosumidor Grupo A (média/alta tensão).
 *
 * Regras fundamentais:
 * 1. Solar gera energia fora ponta (geração diurna = horário fora ponta)
 * 2. Excedente pode gerar créditos para compensar ponta (se aplicável)
 * 3. Demanda contratada é FIXA — solar nunca reduz demanda
 * 4. Fio B progressivo (Lei 14.300) aplica-se à energia compensada
 */
export function calcGrupoA(input: CalcGrupoAInput): CalcGrupoAResult {
  const {
    geracao_mensal_kwh,
    consumo_fp_kwh,
    consumo_p_kwh,
    demanda_contratada_kw,
    tarifa_te_p,
    tarifa_tusd_p,
    tarifa_te_fp,
    tarifa_tusd_fp,
    tarifa_demanda_rs,
    tarifa_fio_b_p = 0,
    tarifa_fio_b_fp = 0,
    regra,
    ano = 2026,
  } = input;

  const alertas: string[] = [];

  // ── 1. Custos SEM solar ──
  const custoEnergiaPSem = consumo_p_kwh * (tarifa_te_p + tarifa_tusd_p);
  const custoEnergiaFPSem = consumo_fp_kwh * (tarifa_te_fp + tarifa_tusd_fp);
  const custoDemanda = demanda_contratada_kw * tarifa_demanda_rs;
  const custoTotalSem = custoEnergiaPSem + custoEnergiaFPSem + custoDemanda;

  // ── 2. Compensação solar ──
  // Solar gera primariamente fora ponta (geração diurna)
  const compensavelFP = Math.min(geracao_mensal_kwh, consumo_fp_kwh);
  const excedenteAposFP = Math.max(0, geracao_mensal_kwh - consumo_fp_kwh);
  // Excedente pode compensar ponta via créditos
  const compensavelP = Math.min(excedenteAposFP, consumo_p_kwh);

  // ── 3. Valor do crédito por kWh compensado ──
  // Depende da regra GD e do escalonamento Fio B
  const fioBCobranca = getFioBCobranca(ano);
  const fioBCobrancaEfetivo = fioBCobranca ?? 0.90;
  const fioBCompensado = 1 - fioBCobrancaEfetivo;

  if (fioBCobranca === null) {
    alertas.push(`⚠️ Ano ${ano}: regra pós-2028 não modelada — usando 90% cobrado como fallback.`);
  }

  let creditoFP_kwh: number;
  let creditoP_kwh: number;
  let descontoFioB = 0;

  if (regra === "GD1") {
    // GD I: compensação integral (TE + TUSD)
    creditoFP_kwh = tarifa_te_fp + tarifa_tusd_fp;
    creditoP_kwh = tarifa_te_p + tarifa_tusd_p;
    alertas.push("GD I — compensação integral (sem escalonamento Fio B)");
  } else if (regra === "GD2") {
    // GD II: TE integral + Fio B parcialmente compensado
    const fioBCompFP = tarifa_fio_b_fp * fioBCompensado;
    const fioBCompP = tarifa_fio_b_p * fioBCompensado;
    creditoFP_kwh = tarifa_te_fp + (tarifa_tusd_fp - tarifa_fio_b_fp) + fioBCompFP;
    creditoP_kwh = tarifa_te_p + (tarifa_tusd_p - tarifa_fio_b_p) + fioBCompP;
    // Desconto Fio B = parte NÃO compensada
    descontoFioB = (compensavelFP * tarifa_fio_b_fp * fioBCobrancaEfetivo)
                 + (compensavelP * tarifa_fio_b_p * fioBCobrancaEfetivo);
  } else {
    // GD III: tarifa de tarifação (TE + TUSD total, Fio B integral)
    creditoFP_kwh = tarifa_te_fp + tarifa_tusd_fp;
    creditoP_kwh = tarifa_te_p + tarifa_tusd_p;
    alertas.push("GD III Grupo A: Fio A cobrado separadamente pela distribuidora.");
  }

  // ── 4. Redução de energia ──
  const reducaoFP = compensavelFP * creditoFP_kwh;
  const reducaoP = compensavelP * creditoP_kwh;

  // ── 5. Custos COM solar ──
  const custoEnergiaPCom = Math.max(0, custoEnergiaPSem - reducaoP);
  const custoEnergiaFPCom = Math.max(0, custoEnergiaFPSem - reducaoFP);
  const custoTotalCom = custoEnergiaPCom + custoEnergiaFPCom + custoDemanda;

  const economiaMensal = Math.round((custoTotalSem - custoTotalCom) * 100) / 100;

  // Alertas
  if (demanda_contratada_kw <= 0) {
    alertas.push("⚠️ Demanda contratada não informada — custo de demanda zerado.");
  }
  if (tarifa_demanda_rs <= 0) {
    alertas.push("⚠️ Tarifa de demanda não informada — custo de demanda zerado.");
  }
  if (tarifa_fio_b_fp <= 0 && regra === "GD2") {
    alertas.push("⚠️ Tarifa Fio B fora ponta não disponível — escalonamento pode estar impreciso.");
  }

  return {
    custo_energia_p_sem_solar: round2(custoEnergiaPSem),
    custo_energia_fp_sem_solar: round2(custoEnergiaFPSem),
    custo_demanda_sem_solar: round2(custoDemanda),
    custo_total_sem_solar: round2(custoTotalSem),
    energia_compensada_fp_kwh: round2(compensavelFP),
    energia_compensada_p_kwh: round2(compensavelP),
    reducao_energia_fp_rs: round2(reducaoFP),
    reducao_energia_p_rs: round2(reducaoP),
    desconto_fio_b_rs: round2(descontoFioB),
    custo_energia_p_com_solar: round2(custoEnergiaPCom),
    custo_energia_fp_com_solar: round2(custoEnergiaFPCom),
    custo_demanda_com_solar: round2(custoDemanda), // unchanged
    custo_total_com_solar: round2(custoTotalCom),
    economia_mensal_rs: economiaMensal,
    demanda_inalterada: true,
    fio_b_percent_cobrado: fioBCobranca,
    alertas,
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
