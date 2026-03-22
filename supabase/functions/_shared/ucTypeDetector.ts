/**
 * ucTypeDetector — Auto-detecção determinística do tipo de UC a partir de dados extraídos da fatura.
 * Produz tipo detectado, confiança e sinais utilizados.
 * Regras 100% auditáveis, sem IA.
 */

export type TipoUcDetectado = "consumo" | "geradora" | "beneficiaria" | "mista" | "indefinida";

export interface SinaisDetectados {
  tem_injecao: boolean;
  tem_compensacao: boolean;
  tem_saldo_gd: boolean;
  tem_medidor_103: boolean;
  tem_categoria_gd: boolean;
  tem_creditos_recebidos: boolean;
  tem_texto_microgeracao: boolean;
  tem_texto_beneficiaria: boolean;
}

export interface UcDetectionResult {
  tipo_uc_detectado: TipoUcDetectado;
  confianca_tipo_uc: number;
  regras_disparadas: string[];
  sinais_detectados: SinaisDetectados;
  divergencia_cadastro: boolean;
}

/**
 * Detect UC type from extracted invoice data + optional raw text.
 * @param parsed - Parsed fields from the invoice
 * @param rawText - Optional raw text for keyword detection
 * @param cadastroTipoUc - Current UC type from DB (for divergence check)
 * @param cadastroPapelGd - Current papel_gd from DB
 */
export function detectUcType(
  parsed: Record<string, any>,
  rawText?: string | null,
  cadastroTipoUc?: string | null,
  cadastroPapelGd?: string | null,
): UcDetectionResult {
  const rules: string[] = [];

  // ── Collect signals ──
  const temInjecao = (parsed.energia_injetada_kwh != null && parsed.energia_injetada_kwh > 0);
  const temCompensacao = (parsed.energia_compensada_kwh != null && parsed.energia_compensada_kwh > 0);
  const temSaldoGd = (parsed.saldo_gd_acumulado != null && parsed.saldo_gd_acumulado >= 0);
  const temMedidor103 = (parsed.leitura_atual_103 != null || parsed.leitura_anterior_103 != null);
  const temCategoriaGd = !!(parsed.categoria_gd);
  const temCreditosRecebidos = (parsed.creditos_recebidos_kwh != null && parsed.creditos_recebidos_kwh > 0);

  const upper = (rawText || "").toUpperCase();
  const temTextoMicrogeracao = /MICROGER|GD[\s_-]?I|GD[\s_-]?II|GD[\s_-]?III|GERADORA|GERA[ÇC][AÃ]O\s+DISTRIBU[IÍ]DA/.test(upper);
  const temTextoBeneficiaria = /BENEFICI[AÁ]RIA|CR[EÉ]DITOS?\s+RECEBIDOS|COMPENSA[ÇC][AÃ]O\s+DE\s+ENERGIA/.test(upper);

  const sinais: SinaisDetectados = {
    tem_injecao: temInjecao,
    tem_compensacao: temCompensacao,
    tem_saldo_gd: temSaldoGd,
    tem_medidor_103: temMedidor103,
    tem_categoria_gd: temCategoriaGd,
    tem_creditos_recebidos: temCreditosRecebidos,
    tem_texto_microgeracao: temTextoMicrogeracao,
    tem_texto_beneficiaria: temTextoBeneficiaria,
  };

  // ── Score-based detection ──
  let scoreGeradora = 0;
  let scoreBeneficiaria = 0;
  let scoreConsumo = 0;

  // Strong geradora signals
  if (temInjecao) { scoreGeradora += 30; rules.push("Energia injetada presente → geradora (+30)"); }
  if (temMedidor103) { scoreGeradora += 25; rules.push("Medidor 103 (injeção) presente → geradora (+25)"); }
  if (temCategoriaGd) { scoreGeradora += 15; rules.push("Categoria GD declarada → geradora (+15)"); }
  if (temTextoMicrogeracao && !temTextoBeneficiaria) { scoreGeradora += 10; rules.push("Texto microgeração detectado → geradora (+10)"); }

  // Beneficiária signals
  if (temCompensacao && !temInjecao) { scoreBeneficiaria += 35; rules.push("Compensação sem injeção → beneficiária (+35)"); }
  if (temCreditosRecebidos) { scoreBeneficiaria += 30; rules.push("Créditos recebidos presentes → beneficiária (+30)"); }
  if (temTextoBeneficiaria && !temInjecao) { scoreBeneficiaria += 15; rules.push("Texto beneficiária detectado → beneficiária (+15)"); }
  if (temSaldoGd && !temInjecao && !temMedidor103) { scoreBeneficiaria += 10; rules.push("Saldo GD sem injeção/medidor 103 → beneficiária (+10)"); }

  // Mista: both injeção and créditos recebidos
  if (temInjecao && temCreditosRecebidos) {
    rules.push("Injeção + créditos recebidos → possível mista");
  }

  // Consumo puro: no GD signals at all
  if (!temInjecao && !temCompensacao && !temSaldoGd && !temMedidor103 && !temCategoriaGd && !temCreditosRecebidos && !temTextoMicrogeracao && !temTextoBeneficiaria) {
    scoreConsumo = 80;
    rules.push("Nenhum sinal GD detectado → consumo puro (+80)");
  }

  // ── Determine type ──
  let tipo: TipoUcDetectado = "indefinida";
  let confianca = 0;

  if (temInjecao && temCreditosRecebidos) {
    tipo = "mista";
    confianca = Math.min(scoreGeradora + scoreBeneficiaria, 95);
    rules.push(`Resultado: mista (confiança ${confianca}%)`);
  } else if (scoreGeradora >= 30 && scoreGeradora > scoreBeneficiaria) {
    tipo = "geradora";
    confianca = Math.min(scoreGeradora, 95);
    rules.push(`Resultado: geradora (confiança ${confianca}%)`);
  } else if (scoreBeneficiaria >= 30 && scoreBeneficiaria > scoreGeradora) {
    tipo = "beneficiaria";
    confianca = Math.min(scoreBeneficiaria, 95);
    rules.push(`Resultado: beneficiária (confiança ${confianca}%)`);
  } else if (scoreConsumo >= 60) {
    tipo = "consumo";
    confianca = scoreConsumo;
    rules.push(`Resultado: consumo (confiança ${confianca}%)`);
  } else {
    confianca = Math.max(scoreGeradora, scoreBeneficiaria, scoreConsumo, 10);
    rules.push(`Resultado: indefinida — sinais insuficientes (máx score: ${confianca})`);
  }

  // ── Divergence check ──
  let divergencia = false;
  if (cadastroTipoUc || cadastroPapelGd) {
    const cadastroEhGeradora = cadastroTipoUc === "gd_geradora" || cadastroPapelGd === "geradora";
    const cadastroEhBeneficiaria = cadastroTipoUc === "beneficiaria" || cadastroPapelGd === "beneficiaria";
    const cadastroEhConsumo = cadastroTipoUc === "consumo" && cadastroPapelGd !== "geradora" && cadastroPapelGd !== "beneficiaria";

    if (tipo === "geradora" && !cadastroEhGeradora && confianca >= 50) {
      divergencia = true;
      rules.push("⚠️ Divergência: fatura indica geradora, cadastro não");
    } else if (tipo === "beneficiaria" && !cadastroEhBeneficiaria && confianca >= 50) {
      divergencia = true;
      rules.push("⚠️ Divergência: fatura indica beneficiária, cadastro não");
    } else if (tipo === "consumo" && !cadastroEhConsumo && confianca >= 60) {
      divergencia = true;
      rules.push("⚠️ Divergência: fatura indica consumo puro, cadastro indica GD");
    }
  }

  return {
    tipo_uc_detectado: tipo,
    confianca_tipo_uc: confianca,
    regras_disparadas: rules,
    sinais_detectados: sinais,
    divergencia_cadastro: divergencia,
  };
}
