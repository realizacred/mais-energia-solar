/**
 * Domain resolver: entrada.* variables
 * Sources: snapshot.ucs[], snapshot top-level, ext.lead, ext.cliente
 */
import { type AnyObj, safeArr, safeObj, str, num, fmtNum, type ResolverExternalContext } from "./types.ts";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function resolveEntrada(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};
  const ucs = safeArr(snap.ucs);
  const uc1 = ucs[0] ? safeObj(ucs[0]) : {};
  const tecnico = safeObj(snap.tecnico);
  const pd = safeObj(snap.preDimensionamento);
  const lead = ext?.lead ?? {};
  const cliente = ext?.cliente ?? {};

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s && !out[k]) out[k] = s;
  };

  // ── Tipo ──
  set("tipo", snap.tipo ?? snap.tipo_dimensionamento);
  set("tipo_uc1", uc1.tipo ?? uc1.tipo_dimensionamento ?? snap.tipo);

  // ── Consumo ──
  const consumoMensal = num(uc1.consumo_mensal) ?? num(tecnico.consumo_total_kwh) ?? num(snap.consumo_mensal) ?? num(lead.media_consumo);
  if (consumoMensal != null) {
    out["consumo_mensal"] = fmtNum(consumoMensal, 0);
  }
  set("consumo_mensal_uc1", uc1.consumo_mensal);

  // MT consumo ponta/fora ponta
  set("consumo_mensal_p", snap.consumo_mensal_p ?? uc1.consumo_mensal_p);
  set("consumo_mensal_p_uc1", uc1.consumo_mensal_p);
  set("consumo_mensal_fp", snap.consumo_mensal_fp ?? uc1.consumo_mensal_fp);
  set("consumo_mensal_fp_uc1", uc1.consumo_mensal_fp);

  // ── Distribuidora e Subgrupo ──
  set("dis_energia", snap.locDistribuidoraNome ?? snap.concessionaria_nome ?? snap.dis_energia ?? uc1.concessionaria ?? uc1.distribuidora ?? lead.distribuidora);
  set("concessionaria_id", snap.concessionaria_id ?? snap.locDistribuidoraId);
  set("subgrupo", uc1.subgrupo ?? snap.subgrupo ?? uc1.grupo_tarifario ?? snap.grupo_tarifario ?? uc1.grupo);
  set("subgrupo_uc1", uc1.subgrupo ?? snap.subgrupo ?? uc1.grupo_tarifario ?? snap.grupo_tarifario ?? uc1.grupo);
  set("grupo_tarifario", uc1.grupo_tarifario ?? snap.grupo_tarifario ?? uc1.subgrupo ?? snap.subgrupo);

  // ── Consumo mensal por mês ──
  // consumo_meses is an object { jan: 500, fev: 480, ... } saved by the wizard
  const consumoMeses = safeObj(uc1.consumo_meses);
  const consumoMesesP = safeObj(uc1.consumo_meses_p);
  const consumoMesesFP = safeObj(uc1.consumo_meses_fp);

  // Check if consumo_meses has real values
  const hasConsumoMeses = Object.values(consumoMeses).some(v => num(v) != null && num(v)! > 0);

  for (const m of MESES) {
    // BT: snap flat key → uc1 flat key → consumo_meses object → uniform fallback from consumo_mensal
    const consumoMesVal = snap[`consumo_${m}`] ?? uc1[`consumo_${m}`] ?? consumoMeses[m];
    if (consumoMesVal != null && consumoMesVal !== "" && consumoMesVal !== 0) {
      set(`consumo_${m}`, consumoMesVal);
    } else if (!hasConsumoMeses && consumoMensal != null && consumoMensal > 0) {
      // Fallback: distribute consumo_mensal uniformly when no monthly data exists
      out[`consumo_${m}`] = fmtNum(consumoMensal, 0);
    }
    set(`consumo_${m}_uc1`, uc1[`consumo_${m}`] ?? consumoMeses[m]);

    // MT Ponta por mês
    set(`consumo_mensal_p_${m}`, snap[`consumo_mensal_p_${m}`] ?? uc1[`consumo_mensal_p_${m}`] ?? consumoMesesP[m]);
    set(`consumo_mensal_p_${m}_uc1`, uc1[`consumo_mensal_p_${m}`] ?? consumoMesesP[m]);
    // MT Fora Ponta por mês
    set(`consumo_mensal_fp_${m}`, snap[`consumo_mensal_fp_${m}`] ?? uc1[`consumo_mensal_fp_${m}`] ?? consumoMesesFP[m]);
    set(`consumo_mensal_fp_${m}_uc1`, uc1[`consumo_mensal_fp_${m}`] ?? consumoMesesFP[m]);
  }

  // ── Tarifas BT ──
  set("tarifa_distribuidora", snap.tarifa_distribuidora ?? snap.tarifa_kwh ?? uc1.tarifa_kwh ?? uc1.tarifa);
  set("tarifa_distribuidora_uc1", uc1.tarifa_kwh ?? uc1.tarifa ?? snap.tarifa_distribuidora);

  // ── Tarifas MT ──
  set("tarifa_te_p", snap.tarifa_te_p ?? uc1.tarifa_te_p);
  set("tarifa_te_p_uc1", uc1.tarifa_te_p);
  set("tarifa_tusd_p", snap.tarifa_tusd_p ?? uc1.tarifa_tusd_p);
  set("tarifa_tusd_p_uc1", uc1.tarifa_tusd_p);
  set("tarifa_te_fp", snap.tarifa_te_fp ?? uc1.tarifa_te_fp);
  set("tarifa_te_fp_uc1", uc1.tarifa_te_fp);
  set("tarifa_tusd_fp", snap.tarifa_tusd_fp ?? uc1.tarifa_tusd_fp);
  set("tarifa_tusd_fp_uc1", uc1.tarifa_tusd_fp);

  // ── Demanda MT ──
  set("demanda_preco", snap.demanda_preco ?? uc1.demanda_preco ?? uc1.demanda_consumo_kw);
  set("demanda_preco_uc1", uc1.demanda_preco ?? uc1.demanda_consumo_kw);
  set("demanda_contratada", snap.demanda_contratada ?? uc1.demanda_contratada ?? uc1.demanda_geracao_kw);
  set("demanda_contratada_uc1", uc1.demanda_contratada ?? uc1.demanda_geracao_kw);
  set("demanda_adicional", snap.demanda_adicional);

  // ── Outros Encargos ──
  set("outros_encargos_atual", snap.outros_encargos_atual ?? uc1.outros_encargos_atual);
  set("outros_encargos_atual_uc1", uc1.outros_encargos_atual);
  set("outros_encargos_novo", snap.outros_encargos_novo ?? uc1.outros_encargos_novo);
  set("outros_encargos_novo_uc1", uc1.outros_encargos_novo);

  // ── Localização e Parâmetros ──
  set("estado", snap.locEstado ?? cliente.estado ?? lead.estado ?? uc1.estado ?? snap.estado);
  set("cidade", snap.locCidade ?? cliente.cidade ?? lead.cidade ?? uc1.cidade ?? snap.cidade);
  set("distancia", snap.distancia ?? snap.distanciaKm);
  set("taxa_desempenho", snap.taxa_desempenho ?? pd.desempenho ?? tecnico.taxa_desempenho);
  set("desvio_azimutal", snap.desvio_azimutal ?? pd.desvio_azimutal ?? tecnico.desvio_azimutal);
  set("inclinacao", snap.inclinacao ?? pd.inclinacao ?? tecnico.inclinacao);
  set("fator_geracao",
    snap.fator_geracao
    ?? pd.fator_geracao
    ?? snap.locIrradiacao
    ?? snap.loc_irradiacao
    ?? tecnico.irradiacao_media_kwp_mes
  );
  for (const m of MESES) {
    const pdMeses = safeObj(pd.fator_geracao_meses);
    set(`fator_geracao_${m}`, snap[`fator_geracao_${m}`] ?? pdMeses[m]);
  }

  // ── Instalação ──
  set("tipo_telhado", uc1.tipo_telhado ?? snap.locTipoTelhado ?? lead.tipo_telhado ?? snap.tipo_telhado ?? tecnico.tipo_telhado ?? uc1.estrutura);
  set("cape_telhado", uc1.tipo_telhado ?? snap.locTipoTelhado ?? lead.tipo_telhado ?? snap.tipo_telhado ?? tecnico.tipo_telhado ?? uc1.estrutura);
  set("estrutura", uc1.tipo_telhado ?? snap.locTipoTelhado ?? snap.tipo_telhado ?? tecnico.tipo_telhado ?? uc1.estrutura);
  set("fase", lead.rede_atendimento ?? snap.fase ?? uc1.fase);
  set("fase_uc1", uc1.fase ?? snap.fase);
  set("tensao_rede", uc1.tensao_rede ?? snap.tensao_rede ?? lead.rede_atendimento);
  set("tensao", uc1.tensao_rede ?? snap.tensao_rede);

  // ── Custo de Disponibilidade ──
  set("custo_disponibilidade_kwh", snap.custo_disponibilidade_kwh ?? uc1.custo_disponibilidade_kwh);
  set("custo_disponibilidade_kwh_uc1", uc1.custo_disponibilidade_kwh);

  // ── Área útil ──
  set("area_util", snap.area_util ?? uc1.area_util ?? tecnico.area_util ?? snap.area_util_m2 ?? uc1.area_util_m2);

  // ── Topologia ──
  set("topologia", snap.topologia);
  set("fator_simultaneidade", snap.fator_simultaneidade);
  set("tipo_sistema", snap.tipo_sistema);

  // ── Rateio de Créditos ──
  set("rateio_sugerido_creditos", snap.rateio_sugerido_creditos);
  set("rateio_sugerido_creditos_uc1", uc1.rateio_sugerido_creditos);
  set("rateio_creditos", snap.rateio_creditos);
  set("rateio_creditos_uc1", uc1.rateio_creditos);

  // ── Impostos ──
  set("imposto_energia", snap.imposto_energia);
  set("imposto_energia_uc1", uc1.imposto_energia);

  // ── UC ──
  set("nome_uc1", uc1.nome ?? uc1.nome_uc);

  // ── Demanda Geração (MT) ──
  set("demanda_g_uc1", uc1.demanda_g ?? uc1.demanda_geracao);
  set("demanda_g_preco_uc1", uc1.demanda_g_preco ?? uc1.demanda_geracao_preco);

  // ── Tarifa Fio B / Energia Compensada ──
  set("t_e_comp_fp_1_uc1", uc1.t_e_comp_fp_1);
  set("t_e_comp_fp_2_uc1", uc1.t_e_comp_fp_2);
  set("t_e_comp_p_1_uc1", uc1.t_e_comp_p_1);
  set("t_e_comp_p_2_uc1", uc1.t_e_comp_p_2);
  set("t_e_comp_bt_1_uc1", uc1.t_e_comp_bt_1);
  set("t_e_comp_bt_2_uc1", uc1.t_e_comp_bt_2);

  // ── Regra de Compensação ──
  set("regra_comp_uc1", uc1.regra_comp ?? uc1.regra);

  // ── DoD ──
  set("dod", snap.dod);

  // ── Cidade/Estado combined ──
  const c = out["cidade"];
  const e = out["estado"];
  if (c && e) set("cidade_estado", `${c} - ${e}`);

  // ── QTD UCs ──
  if (ucs.length > 0) set("qtd_ucs", String(ucs.length));

  return out;
}
