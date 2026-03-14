/**
 * Domain resolver: sistema_solar.* variables
 * Sources: snapshot.itens[], snapshot.tecnico, ext.projeto, ext.cliente
 */
import { type AnyObj, safeArr, safeObj, str, num, fmtNum, type ResolverExternalContext } from "./types.ts";

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

export function resolveSistemaSolar(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};
  const tecnico = safeObj(snap.tecnico);
  const itens = safeArr(snap.itens);
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
    out["potencia_sistema"] = potStr.includes("kWp") ? potStr : `${fmtNum(potencia)} kWp`;
    out["potencia_kwp"] = String(potencia);
  }
  set("potencia_ideal_total", snap.potencia_ideal_total);

  // ── Geração ──
  const geracaoMensal = num(projeto.geracao_mensal_media_kwh) ?? num(snap.geracao_mensal)
    ?? num(tecnico.geracao_estimada_kwh);
  if (geracaoMensal != null) {
    out["geracao_mensal"] = `${fmtNum(geracaoMensal, 0)} kWh/mês`;
  }
  set("geracao_anual", snap.geracao_anual);
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

  // ── Módulos from itens ──
  const modulos = itens.filter(i => isModulo(i) && !isInversor(i));
  const inversores = itens.filter(i => isInversor(i));

  if (modulos[0]) {
    set("modulo_fabricante", modulos[0].fabricante);
    set("modulo_modelo", modulos[0].modelo);
    if (modulos[0].potencia_w) {
      const pw = String(modulos[0].potencia_w);
      out["modulo_potencia"] = pw.includes("Wp") ? pw : `${pw} Wp`;
    }
    set("vc_modulo_potencia", modulos[0].potencia_w);
    const totalMod = modulos.reduce((s, m) => s + Number(m.quantidade ?? 0), 0);
    if (totalMod > 0 && !out["modulo_quantidade"]) {
      out["modulo_quantidade"] = String(totalMod);
      out["vc_total_modulo"] = String(totalMod);
    }
  }

  // Fallback from snapshot direct keys
  set("modulo_modelo", projeto.modelo_modulos ?? snap.modulo_modelo);
  set("modulo_fabricante", snap.modulo_fabricante);
  if (snap.modulo_potencia && !out["modulo_potencia"]) {
    const mp = String(snap.modulo_potencia);
    out["modulo_potencia"] = mp.includes("Wp") ? mp : `${mp} Wp`;
  }

  // ── Inversores from itens ──
  if (inversores[0]) {
    set("inversor_fabricante", inversores[0].fabricante);
    set("inversor_fabricante_1", inversores[0].fabricante);
    set("inversor_modelo", inversores[0].modelo);
    if (inversores[0].potencia_w) {
      const pw = String(inversores[0].potencia_w);
      out["inversor_potencia_nominal"] = pw.includes("W") ? pw : `${pw} W`;
    }
    const invSummary = inversores
      .filter(inv => inv.modelo)
      .map(inv => `${inv.quantidade || 1}x ${inv.modelo}`)
      .join(" + ");
    if (invSummary) set("inversores_utilizados", invSummary);
    
    const invQty = inversores.reduce((s, inv) => s + Number(inv.quantidade ?? 1), 0);
    if (invQty > 0) set("inversor_quantidade", String(invQty));
  }

  // Fallback from snapshot/projeto
  set("inversor_modelo", projeto.modelo_inversor ?? cliente.modelo_inversor ?? snap.inversor_modelo);
  set("inversor_fabricante", snap.inversor_fabricante ?? snap.inversor_fabricante_1);
  set("inversor_fabricante_1", snap.inversor_fabricante ?? snap.inversor_fabricante_1);
  if ((snap.inversor_potencia || snap.inversor_potencia_nominal) && !out["inversor_potencia_nominal"]) {
    const ip = String(snap.inversor_potencia ?? snap.inversor_potencia_nominal);
    out["inversor_potencia_nominal"] = ip.includes("W") ? ip : `${ip} W`;
  }
  set("inversores_utilizados", snap.inversores_utilizados ?? (projeto.modelo_inversor ? `1x ${projeto.modelo_inversor}` : undefined));

  // ── Indexed inversores ──
  inversores.forEach((inv, idx) => {
    const i = idx + 1;
    set(`inversor_fabricante_${i}`, inv.fabricante);
    set(`inversor_modelo_${i}`, inv.modelo);
    if (inv.potencia_w) {
      const pw = String(inv.potencia_w);
      if (!out[`inversor_potencia_nominal_${i}`]) {
        out[`inversor_potencia_nominal_${i}`] = pw.includes("W") ? pw : `${pw} W`;
      }
    }
    set(`inversor_quantidade_${i}`, inv.quantidade);
  });

  // ── Extended inverter/battery/optimizer fields from snapshot ──
  const inversorFields = ["inversor_fabricante", "inversor_modelo", "inversor_quantidade", "inversor_potencia",
    "inversor_potencia_nominal", "inversor_tensao", "inversor_tipo", "inversor_corrente_saida",
    "inversor_mppts_utilizados", "inversor_strings_utilizadas", "inversor_codigo", "inversor_garantia"];
  for (const k of inversorFields) {
    set(k, snap[k]);
    for (let i = 1; i <= 5; i++) set(`${k}_${i}`, snap[`${k}_${i}`]);
  }

  for (const k of ["otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade"]) {
    set(k, snap[k]);
  }
  set("transformador_nome", snap.transformador_nome);
  set("transformador_potencia", snap.transformador_potencia);

  const bateriaFields = ["bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
    "bateria_quantidade", "bateria_comprimento", "bateria_largura", "bateria_profundidade",
    "bateria_tensao_operacao", "bateria_tensao_carga", "bateria_tensao_nominal",
    "bateria_potencia_maxima_saida", "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
    "bateria_corrente_recomendada", "bateria_capacidade"];
  for (const k of bateriaFields) {
    set(k, snap[k]);
    for (let i = 1; i <= 3; i++) set(`${k}_${i}`, snap[`${k}_${i}`]);
  }

  for (const k of ["autonomia", "energia_diaria_armazenamento", "armazenamento_necessario",
    "armazenamento_util_adicionado", "p_armazenamento_necessario"]) {
    set(k, snap[k]);
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
