/**
 * Domain resolver: sistema_solar.* variables
 * Sources: snapshot.itens[], snapshot.tecnico, ext.projeto, ext.cliente
 */
import { type AnyObj, safeArr, safeObj, str, num, fmtNum, fmtVal, type ResolverExternalContext } from "./types.ts";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function isModulo(i: AnyObj): boolean {
  const cat = String(i.categoria ?? "").toLowerCase();
  const tipo = String(i.tipo ?? "").toLowerCase();
  if (cat.includes("modulo") || cat.includes("módulo") || cat === "module") return true;
  if (tipo.includes("modulo") || tipo.includes("módulo")) return true;
  if (!cat && !tipo && Number(i.potencia_w ?? 0) >= 200) return true;
  return false;
}

function isInversor(i: AnyObj): boolean {
  const cat = String(i.categoria ?? "").toLowerCase();
  const tipo = String(i.tipo ?? "").toLowerCase();
  if (cat.includes("inversor") || cat === "inverter") return true;
  if (tipo.includes("inversor")) return true;
  return false;
}

function isBateria(i: AnyObj): boolean {
  const cat = String(i.categoria ?? "").toLowerCase();
  const tipo = String(i.tipo ?? "").toLowerCase();
  if (cat.includes("bateria") || cat === "battery") return true;
  if (tipo.includes("bateria")) return true;
  return false;
}

/**
 * Parses "2279 x 1134 x 35" → { comprimento_mm, largura_mm, profundidade_mm }
 */
function parseDimensoes(dim: unknown): { comprimento_mm?: number; largura_mm?: number; profundidade_mm?: number } {
  if (!dim || typeof dim !== "string") return {};
  const parts = dim.split(/\s*[x×X]\s*/).map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
  if (parts.length >= 3) return { comprimento_mm: parts[0], largura_mm: parts[1], profundidade_mm: parts[2] };
  if (parts.length === 2) return { comprimento_mm: parts[0], largura_mm: parts[1] };
  return {};
}

/**
 * Parses coef_temp string like "-0.34%/°C Pmax, -0.28%/°C Voc, +0.05%/°C Isc"
 * Returns individual coefficients.
 */
function parseCoefTemp(coef: unknown): { coef_temp_pmax?: string; coef_temp_voc?: string; coef_temp_isc?: string } {
  if (!coef || typeof coef !== "string") return {};
  const result: Record<string, string> = {};
  const parts = coef.split(",").map(s => s.trim());
  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower.includes("pmax") || lower.includes("pmáx")) {
      result.coef_temp_pmax = part.replace(/pmax|pmáx/i, "").trim().replace(/\s+/g, "");
    } else if (lower.includes("voc")) {
      result.coef_temp_voc = part.replace(/voc/i, "").trim().replace(/\s+/g, "");
    } else if (lower.includes("isc")) {
      result.coef_temp_isc = part.replace(/isc/i, "").trim().replace(/\s+/g, "");
    }
  }
  return result;
}

export function resolveSistemaSolar(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};
  const tecnico = safeObj(snap.tecnico);
  
  // ── Items: merge itens[] + manualKits[selectedKitIndex].itens ──
  let itens = safeArr(snap.itens);
  if (itens.length === 0) {
    const kits = safeArr(snap.manualKits);
    const selectedIdx = Number(snap.selectedKitIndex ?? 0);
    const selectedKit = kits[selectedIdx] ? safeObj(kits[selectedIdx]) : {};
    itens = safeArr(selectedKit.itens);
  }
  
  const projeto = ext?.projeto ?? {};
  const cliente = ext?.cliente ?? {};
  const versao = ext?.versaoData ?? {};

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s && !out[k]) out[k] = s;
  };

  // ── Potência ──
  const potencia = num(versao.potencia_kwp) ?? num(projeto.potencia_kwp) ?? num(cliente.potencia_kwp)
    ?? num(tecnico.potencia_kwp) ?? num(snap.potencia_kwp) ?? num(snap.potencia_sistema);
  if (potencia != null) {
    const potStr = String(potencia);
    out["potencia_sistema"] = potStr.includes("kWp") ? potStr.replace(/\s*kWp\s*/, "") : fmtNum(potencia);
    out["potencia_sistema_numero"] = fmtNum(potencia);
    out["potencia_kwp"] = String(potencia);
  }
  set("potencia_ideal_total", snap.potencia_ideal_total);

  // ── Geração ──
  // QW10 — add fallback for geracaoMensalEstimada and geracao_mensal_kwh
  const geracaoMensal = num(projeto.geracao_mensal_media_kwh) ?? num(snap.geracao_mensal)
    ?? num(snap.geracaoMensalEstimada) ?? num(snap.geracao_mensal_kwh)
    ?? num(tecnico.geracao_estimada_kwh);
  if (geracaoMensal != null) {
    out["geracao_mensal"] = fmtNum(geracaoMensal, 0);
    out["geracao_mensal_numero"] = String(Math.round(geracaoMensal));
    // Geração anual
    const geracaoAnual = num(snap.geracao_anual_kwh) ?? geracaoMensal * 12;
    if (!out["geracao_anual"]) out["geracao_anual"] = fmtNum(geracaoAnual, 0);
    out["geracao_anual_numero"] = String(Math.round(geracaoAnual));
  }
  for (const m of MESES) set(`geracao_${m}`, snap[`geracao_${m}`]);
  for (let i = 0; i <= 25; i++) set(`geracao_anual_${i}`, snap[`geracao_anual_${i}`]);

  // ── Número de módulos ──
  const numModulos = num(projeto.numero_modulos) ?? num(cliente.numero_placas) ?? num(tecnico.numero_modulos)
    ?? num(snap.numero_modulos) ?? num(snap.modulo_quantidade);
  if (numModulos != null) {
    out["numero_modulos"] = String(numModulos);
    out["modulo_quantidade"] = String(numModulos);
    out["vc_total_modulo"] = String(numModulos);
  }

  // ── Classify items ──
  const modulos = itens.filter(i => isModulo(i) && !isInversor(i));
  const inversores = itens.filter(i => isInversor(i));
  const baterias = itens.filter(i => isBateria(i));

  // ══════════════════════════════════════════════════════════
  // ── MÓDULOS — enriched catalog fields ──
  // ══════════════════════════════════════════════════════════
  if (modulos[0]) {
    const m0 = modulos[0];
    set("modulo_fabricante", m0.fabricante);
    set("modulo_modelo", m0.modelo);
    if (m0.potencia_w) {
      const pw = String(m0.potencia_w);
      out["modulo_potencia"] = pw.replace(/\s*Wp\s*/, "");
      out["modulo_potencia_numero"] = String(m0.potencia_w);
    }
    set("vc_modulo_potencia", m0.potencia_w);
    const totalMod = modulos.reduce((s, m) => s + Number(m.quantidade ?? 0), 0);
    if (totalMod > 0 && !out["modulo_quantidade"]) {
      out["modulo_quantidade"] = String(totalMod);
      out["vc_total_modulo"] = String(totalMod);
    }

    // ── Catalog-enriched module specs ──
    set("modulo_tipo_celula", m0.tipo_celula);
    set("modulo_celulas", m0.numero_celulas);
    set("modulo_eficiencia", m0.eficiencia_percent);
    set("modulo_tensao_maxima", m0.tensao_sistema_v);
    set("modulo_vmp", m0.vmp);
    set("modulo_voc", m0.voc);
    set("modulo_imp", m0.imp);
    set("modulo_isc", m0.isc);
    // NOTE: modulo_codigo — no 'codigo' column in modulos_fotovoltaicos yet. Passthrough only.

    // Dimensions — from pre-parsed fields or from dimensoes_mm string
    const dims = (m0.comprimento_mm != null) ? m0 : parseDimensoes(m0.dimensoes_mm);
    if (num(dims.comprimento_mm) != null) {
      out["modulo_comprimento"] = String(dims.comprimento_mm);
      out["modulo_comprimento_numero"] = String(dims.comprimento_mm);
    }
    if (num(dims.largura_mm) != null) {
      out["modulo_largura"] = String(dims.largura_mm);
      out["modulo_largura_numero"] = String(dims.largura_mm);
    }
    if (num(dims.profundidade_mm) != null) {
      out["modulo_profundidade"] = String(dims.profundidade_mm);
      out["modulo_profundidade_numero"] = String(dims.profundidade_mm);
    }

    // Derived: modulo_area (m²)
    const compMm = num(dims.comprimento_mm);
    const largMm = num(dims.largura_mm);
    if (compMm != null && largMm != null) {
      const areaM2 = (compMm * largMm) / 1_000_000;
      out["modulo_area"] = fmtNum(areaM2, 2);
      out["modulo_area_numero"] = fmtNum(areaM2, 2);
    }

    // Temperature coefficients
    const coefs = parseCoefTemp(m0.coef_temp);
    if (coefs.coef_temp_pmax) set("modulo_coef_temp_pmax", coefs.coef_temp_pmax);
    if (coefs.coef_temp_voc) set("modulo_coef_temp_voc", coefs.coef_temp_voc);
    if (coefs.coef_temp_isc) set("modulo_coef_temp_isc", coefs.coef_temp_isc);
    // Snapshot fallbacks for coef_temp (if parseCoefTemp didn't find them)
    set("modulo_coef_temp_pmax", snap.modulo_coef_temp_pmax);
    set("modulo_coef_temp_voc", snap.modulo_coef_temp_voc);
    set("modulo_coef_temp_isc", snap.modulo_coef_temp_isc);

    // ── Module warranty from catalog enrichment ──
    set("modulo_garantia", m0.garantia_produto_anos);
    set("modulo_garantia_performance", m0.garantia_performance_anos);
  }

  // Fallback from snapshot direct keys
  set("modulo_modelo", projeto.modelo_modulos ?? snap.modulo_modelo);
  set("modulo_fabricante", snap.modulo_fabricante);
  if (snap.modulo_potencia && !out["modulo_potencia"]) {
    const mp = String(snap.modulo_potencia);
    out["modulo_potencia"] = mp.replace(/\s*Wp\s*/, "");
  }

  // Module snapshot fallbacks for catalog fields
  set("modulo_tipo_celula", snap.modulo_tipo_celula);
  set("modulo_celulas", snap.modulo_celulas);
  set("modulo_eficiencia", snap.modulo_eficiencia);
  set("modulo_tensao_maxima", snap.modulo_tensao_maxima);
  set("modulo_vmp", snap.modulo_vmp);
  set("modulo_voc", snap.modulo_voc);
  set("modulo_imp", snap.modulo_imp);
  set("modulo_isc", snap.modulo_isc);
  set("modulo_codigo", snap.modulo_codigo);
  set("modulo_comprimento", snap.modulo_comprimento);
  set("modulo_largura", snap.modulo_largura);
  set("modulo_profundidade", snap.modulo_profundidade);
  set("modulo_area", snap.modulo_area);
  set("modulo_garantia", snap.modulo_garantia);

  // ══════════════════════════════════════════════════════════
  // ── INVERSORES — enriched catalog fields ──
  // ══════════════════════════════════════════════════════════
  if (inversores[0]) {
    set("inversor_fabricante", inversores[0].fabricante);
    set("inversor_fabricante_1", inversores[0].fabricante);
    set("inversor_modelo", inversores[0].modelo);
    if (inversores[0].potencia_w) {
      const pw = String(inversores[0].potencia_w);
      out["inversor_potencia_nominal"] = pw.replace(/\s*W\s*$/, "");
      out["inversor_potencia_nominal_numero"] = String(inversores[0].potencia_w);
    }
    const invSummary = inversores
      .filter(inv => inv.modelo)
      .map(inv => `${inv.quantidade || 1}x ${inv.modelo}`)
      .join(" + ");
    if (invSummary) set("inversores_utilizados", invSummary);
    
    const invQty = inversores.reduce((s, inv) => s + Number(inv.quantidade ?? 1), 0);
    if (invQty > 0) set("inversor_quantidade", String(invQty));

    // ── Catalog-enriched inverter specs (aggregated from first inverter) ──
    // NOTE: tensao_max_v is DC-side (max PV string voltage), tensao_linha_v is AC-side.
    // inversor_tensao is ambiguous — we use tensao_linha_v (AC) as it's more commonly expected in proposals.
    set("inversor_tensao", inversores[0].tensao_linha_v);
    set("inversor_tipo", inversores[0].tipo_sistema);
    // NOTE: inversor_corrente_saida is AC output current — REQUIRES a dedicated DB column.
    // corrente_max_mppt_a is DC input current — NEVER use here.
    // No AC output current column exists yet → will remain empty (fallback in PDF).
    set("inversor_mppts_utilizados", inversores[0].mppts);
    // ── Inverter warranty from catalog ──
    set("inversor_garantia", inversores[0].garantia_anos);

    // Derived: inversores_potencia_maxima_total
    const totalPotMax = inversores.reduce((s, inv) => {
      const potMax = Number(inv.potencia_maxima_w ?? inv.potencia_w ?? 0);
      const qty = Number(inv.quantidade ?? 1);
      return s + (potMax * qty);
    }, 0);
    if (totalPotMax > 0) {
      out["inversores_potencia_maxima_total"] = fmtNum(totalPotMax, 0);
    }
  }

  // Fallback from snapshot/projeto
  set("inversor_modelo", projeto.modelo_inversor ?? cliente.modelo_inversor ?? snap.inversor_modelo);
  set("inversor_fabricante", snap.inversor_fabricante ?? snap.inversor_fabricante_1);
  set("inversor_fabricante_1", snap.inversor_fabricante ?? snap.inversor_fabricante_1);
  if ((snap.inversor_potencia || snap.inversor_potencia_nominal) && !out["inversor_potencia_nominal"]) {
    const ip = String(snap.inversor_potencia ?? snap.inversor_potencia_nominal);
    out["inversor_potencia_nominal"] = ip.replace(/\s*W\s*$/, "");
  }
  set("inversores_utilizados", snap.inversores_utilizados ?? (projeto.modelo_inversor ? `1x ${projeto.modelo_inversor}` : undefined));

  // Inverter snapshot fallbacks
  set("inversor_tensao", snap.inversor_tensao);
  set("inversor_tipo", snap.inversor_tipo);
  set("inversor_corrente_saida", snap.inversor_corrente_saida);
  set("inversor_mppts_utilizados", snap.inversor_mppts_utilizados);
  set("inversor_codigo", snap.inversor_codigo);
  set("inversor_garantia", snap.inversor_garantia);
  // capo_i = alias for inverter warranty in years (bug fix: was incorrectly mapped to valor_total)
  set("capo_i", out["inversor_garantia"] ?? snap.inversor_garantia ?? snap.capo_i);
  set("inversores_potencia_maxima_total", snap.inversores_potencia_maxima_total);

  // ── Indexed inversores (with catalog enrichment) ──
  inversores.forEach((inv, idx) => {
    const i = idx + 1;
    set(`inversor_fabricante_${i}`, inv.fabricante);
    set(`inversor_modelo_${i}`, inv.modelo);
    if (inv.potencia_w) {
      const pw = String(inv.potencia_w);
      if (!out[`inversor_potencia_nominal_${i}`]) {
        out[`inversor_potencia_nominal_${i}`] = pw.replace(/\s*W\s*$/, "");
      }
    }
    set(`inversor_quantidade_${i}`, inv.quantidade);
    // Enriched catalog fields per inverter
    set(`inversor_potencia_${i}`, inv.potencia_maxima_w ?? inv.potencia_w);
    // Use AC-side voltage for indexed inverters too
    set(`inversor_tensao_${i}`, inv.tensao_linha_v);
    set(`inversor_tipo_${i}`, inv.tipo_sistema);
    // inversor_corrente_saida: no AC output column in DB yet — skip (fallback via snapshot passthrough)
    set(`inversor_mppts_utilizados_${i}`, inv.mppts);
    // Hybrid/off-grid fields
    set(`inversor_sistema_${i}`, inv.tipo_sistema);
    // corrente_max_mppt_a is DC input current per MPPT — correct for these fields
    set(`inversor_corrente_max_entrada_mppt1_${i}`, inv.corrente_max_mppt_a);
    set(`inversor_corrente_max_entrada_${i}`, inv.corrente_max_mppt_a);
  });

  // ── Extended inverter/battery/optimizer fields from snapshot ──
  const inversorFields = ["inversor_fabricante", "inversor_modelo", "inversor_quantidade", "inversor_potencia",
    "inversor_potencia_nominal", "inversor_tensao", "inversor_tipo", "inversor_corrente_saida",
    "inversor_mppts_utilizados", "inversor_strings_utilizadas", "inversor_codigo", "inversor_garantia",
    "inversor_sistema", "inversor_corrente_max_entrada_mppt1", "inversor_corrente_max_entrada",
    "inversor_corrente_max_carga_cc", "inversor_corrente_max_descarga_cc",
    "inversor_tipo_bateria", "inversor_tensao_bateria_min", "inversor_tensao_bateria_max"];
  for (const k of inversorFields) {
    set(k, snap[k]);
    for (let i = 1; i <= 5; i++) set(`${k}_${i}`, snap[`${k}_${i}`]);
  }

  for (const k of ["otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade"]) {
    set(k, snap[k]);
  }
  set("transformador_nome", snap.transformador_nome);
  set("transformador_potencia", snap.transformador_potencia);

  // ══════════════════════════════════════════════════════════
  // ── BATERIAS — enriched catalog fields ──
  // ══════════════════════════════════════════════════════════
  if (baterias[0]) {
    const b0 = baterias[0];
    set("bateria_fabricante", b0.fabricante);
    set("bateria_modelo", b0.modelo);
    set("bateria_tipo", b0.tipo_bateria);
    set("bateria_energia", b0.energia_kwh);
    const batQty = baterias.reduce((s, b) => s + Number(b.quantidade ?? 1), 0);
    if (batQty > 0) set("bateria_quantidade", String(batQty));
    set("bateria_tensao_operacao", b0.tensao_operacao_v);
    set("bateria_tensao_nominal", b0.tensao_nominal_v);
    set("bateria_tensao_carga", b0.tensao_carga_v);
    set("bateria_potencia_maxima_saida", b0.potencia_max_saida_kw);
    set("bateria_corrente_maxima_descarga", b0.corrente_max_descarga_a);
    set("bateria_corrente_maxima_carga", b0.corrente_max_carga_a);
    set("bateria_corrente_recomendada", b0.correntes_recomendadas_a);
    set("bateria_capacidade", b0.capacidade ?? b0.energia_kwh);

    // Dimensions from pre-parsed or dimensoes_mm
    const bDims = (b0.comprimento_mm != null) ? b0 : parseDimensoes(b0.dimensoes_mm);
    if (num(bDims.comprimento_mm) != null) out["bateria_comprimento"] = String(bDims.comprimento_mm);
    if (num(bDims.largura_mm) != null) out["bateria_largura"] = String(bDims.largura_mm);
    if (num(bDims.profundidade_mm) != null) out["bateria_profundidade"] = String(bDims.profundidade_mm);
  }

  // ── Indexed baterias (with catalog enrichment) ──
  baterias.forEach((bat, idx) => {
    const i = idx + 1;
    set(`bateria_fabricante_${i}`, bat.fabricante);
    set(`bateria_modelo_${i}`, bat.modelo);
    set(`bateria_tipo_${i}`, bat.tipo_bateria);
    set(`bateria_energia_${i}`, bat.energia_kwh);
    set(`bateria_quantidade_${i}`, bat.quantidade);
    set(`bateria_tensao_operacao_${i}`, bat.tensao_operacao_v);
    set(`bateria_tensao_nominal_${i}`, bat.tensao_nominal_v);
    set(`bateria_tensao_carga_${i}`, bat.tensao_carga_v);
    set(`bateria_potencia_maxima_saida_${i}`, bat.potencia_max_saida_kw);
    set(`bateria_corrente_maxima_descarga_${i}`, bat.corrente_max_descarga_a);
    set(`bateria_corrente_maxima_carga_${i}`, bat.corrente_max_carga_a);
    set(`bateria_corrente_recomendada_${i}`, bat.correntes_recomendadas_a);
    set(`bateria_capacidade_${i}`, bat.capacidade ?? bat.energia_kwh);

    const bDims = (bat.comprimento_mm != null) ? bat : parseDimensoes(bat.dimensoes_mm);
    if (num(bDims.comprimento_mm) != null && !out[`bateria_comprimento_${i}`]) out[`bateria_comprimento_${i}`] = String(bDims.comprimento_mm);
    if (num(bDims.largura_mm) != null && !out[`bateria_largura_${i}`]) out[`bateria_largura_${i}`] = String(bDims.largura_mm);
    if (num(bDims.profundidade_mm) != null && !out[`bateria_profundidade_${i}`]) out[`bateria_profundidade_${i}`] = String(bDims.profundidade_mm);
  });

  const bateriaFields = ["bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
    "bateria_quantidade", "bateria_comprimento", "bateria_largura", "bateria_profundidade",
    "bateria_tensao_operacao", "bateria_tensao_carga", "bateria_tensao_nominal",
    "bateria_potencia_maxima_saida", "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
    "bateria_corrente_recomendada", "bateria_capacidade",
    "bateria_temperatura_descarga_min", "bateria_temperatura_descarga_max",
    "bateria_temperatura_carga_min", "bateria_temperatura_carga_max",
    "bateria_temperatura_armazenamento_min", "bateria_temperatura_armazenamento_max"];
  for (const k of bateriaFields) {
    set(k, snap[k]);
    for (let i = 1; i <= 3; i++) set(`${k}_${i}`, snap[`${k}_${i}`]);
  }

  // ── Storage / armazenamento ──
  for (const k of ["autonomia", "energia_diaria_armazenamento", "armazenamento_necessario",
    "armazenamento_util_adicionado", "p_armazenamento_necessario"]) {
    set(k, snap[k]);
  }

  // Derived: p_armazenamento_necessario
  if (!out["p_armazenamento_necessario"]) {
    const armUtil = num(snap.armazenamento_util_adicionado);
    const armNec = num(snap.armazenamento_necessario);
    if (armUtil != null && armNec != null && armNec > 0) {
      out["p_armazenamento_necessario"] = `${fmtNum((armUtil / armNec) * 100, 1)}%`;
    }
  }

  // Layout
  for (const k of ["layout_arranjo_linhas", "layout_arranjo_modulos", "layout_arranjo_orientacao",
    "layout_linhas_total", "layout_arranjos_total", "layout_arranjos_total_horizontal",
    "layout_arranjos_total_vertical", "layout_orientacao"]) {
    set(k, snap[k]);
  }

  // Misc
  set("qtd_ucs", snap.qtd_ucs);
  set("creditos_gerados", snap.creditos_gerados);
  set("kit_fechado_quantidade", snap.kit_fechado_quantidade);
  set("segmentos_utilizados", snap.segmentos_utilizados);
  set("area_necessaria", snap.area_necessaria);
  set("peso_total", snap.peso_total);
  set("estrutura_tipo", snap.estrutura_tipo);
  set("kit_codigo", snap.kit_codigo);

  return out;
}
