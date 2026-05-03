/**
 * ═══════════════════════════════════════════════════════════════
 * SNAPSHOT CANONICAL ADAPTER — SM legacy → chaves canônicas
 * ═══════════════════════════════════════════════════════════════
 *
 * Propostas migradas do SolarMarket têm snapshot legacy:
 *   { cliente, kit, financeiro, geracao, garantias, pagamento,
 *     proposta, projeto, raw_sm, sm_variables }
 *
 * O catálogo (variablesCatalog.ts) e os templates web esperam chaves
 * canônicas: sistema_solar.*, comercial.*, conta_energia.*,
 * financeiro.*, pagamento.*, etc.
 *
 * Este adapter PRESERVA o snapshot original e adiciona caminhos
 * canônicos derivados do legacy. Idempotente: se a chave canônica já
 * existe (snapshot nativo), NÃO sobrescreve.
 *
 * Plugado em `resolveProposalVariables` antes de qualquer deepGet —
 * resolvido transparentemente para qualquer template que renderize
 * sobre proposta migrada.
 *
 * NÃO é o `enrichLegacySnapshot` async em src/lib/enrichLegacySnapshot.ts
 * (esse último é para o wizard hidratar dados nativos do tenant — escopo
 * diferente). Nome distinto para evitar colisão.
 */

type AnyObj = Record<string, any>;

function isObj(v: unknown): v is AnyObj {
  return v != null && typeof v === "object" && !Array.isArray(v);
}

function setIfEmpty(obj: AnyObj, path: string, value: unknown) {
  if (value == null || value === "") return;
  const parts = path.split(".");
  let cur: AnyObj = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!isObj(cur[k])) cur[k] = {};
    cur = cur[k];
  }
  const last = parts[parts.length - 1];
  const existing = cur[last];
  if (existing == null || existing === "") cur[last] = value;
}

function firstWord(s: unknown): string | null {
  if (typeof s !== "string" || !s.trim()) return null;
  return s.trim().split(/\s+/)[0];
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^\d.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/**
 * Aplica adapter canônico em snapshot legacy. Não muta o input.
 */
export function canonicalizeSnapshot<T extends AnyObj | null | undefined>(
  snapshot: T
): T {
  if (!isObj(snapshot)) return snapshot;
  if ((snapshot as AnyObj).__canonicalized) return snapshot;

  const out: AnyObj = { ...snapshot };
  for (const k of [
    "sistema_solar",
    "comercial",
    "conta_energia",
    "financeiro",
    "entrada",
    "pagamento",
    "cliente",
    "kit",
    "geracao",
    "garantias",
    "projeto",
    "proposta",
  ]) {
    if (isObj(out[k])) out[k] = { ...out[k] };
  }

  const kit = isObj(out.kit) ? out.kit : {};
  const itens: any[] = Array.isArray(kit.itens) ? kit.itens : [];
  const geracao = isObj(out.geracao) ? out.geracao : {};
  const garantias = isObj(out.garantias) ? out.garantias : {};
  const financeiroSrc = isObj(out.financeiro) ? out.financeiro : {};
  const pagamentoSrc = isObj(out.pagamento) ? out.pagamento : {};
  const proposta = isObj(out.proposta) ? out.proposta : {};
  const projeto = isObj(out.projeto) ? out.projeto : {};
  const cliente = isObj(out.cliente) ? out.cliente : {};
  const sm: AnyObj = isObj(out.sm_variables) ? out.sm_variables : {};

  // ── sistema_solar.* ───────────────────────────────────────
  setIfEmpty(out, "sistema_solar.potencia_kwp", geracao.potencia_kwp ?? toNum(sm.potencia_sistema));
  setIfEmpty(out, "sistema_solar.geracao_mensal", geracao.geracao_mensal ?? toNum(sm.geracao_mensal));
  setIfEmpty(out, "sistema_solar.geracao_anual", geracao.geracao_anual ?? toNum(sm.geracao_anual));

  const byCat = (cat: string) =>
    itens.filter((i: any) => String(i?.category ?? "").toLowerCase() === cat.toLowerCase());
  const modulos = byCat("Módulo").concat(byCat("Modulo"));
  const inversores = byCat("Inversor");
  const baterias = byCat("Bateria");

  if (modulos.length) {
    const m = modulos[0];
    const totalQnt = modulos.reduce((s: number, x: any) => s + (toNum(x?.qnt) ?? 0), 0);
    setIfEmpty(out, "sistema_solar.modulo_quantidade", totalQnt || toNum(m?.qnt));
    setIfEmpty(out, "sistema_solar.modulo_modelo", m?.item);
    setIfEmpty(out, "sistema_solar.modulo_marca", firstWord(m?.item) ?? sm.modulo_fabricante);
  }
  if (inversores.length) {
    const inv = inversores[0];
    const totalQnt = inversores.reduce((s: number, x: any) => s + (toNum(x?.qnt) ?? 0), 0);
    setIfEmpty(out, "sistema_solar.inversor_quantidade", totalQnt || toNum(inv?.qnt));
    setIfEmpty(out, "sistema_solar.inversor_modelo", inv?.item);
    setIfEmpty(out, "sistema_solar.inversor_marca", firstWord(inv?.item) ?? sm.inversor_fabricante);
  }
  if (baterias.length) {
    const b = baterias[0];
    setIfEmpty(out, "sistema_solar.bateria_quantidade", toNum(b?.qnt));
    setIfEmpty(out, "sistema_solar.bateria_modelo", b?.item);
  }

  setIfEmpty(out, "sistema_solar.area_util", toNum(sm.area_util));
  setIfEmpty(out, "sistema_solar.topologia", sm.topologia ?? sm.Topologia);
  setIfEmpty(out, "sistema_solar.fornecedor", sm.fornecedor ?? sm.Fornecedor);
  setIfEmpty(out, "sistema_solar.inclinacao", toNum(sm.inclinacao));
  setIfEmpty(out, "sistema_solar.distancia", toNum(sm.distancia ?? sm.Distância));
  setIfEmpty(out, "sistema_solar.kit_codigo", sm.kit_codigo);
  setIfEmpty(out, "sistema_solar.kit_nome", kit.nome);
  setIfEmpty(out, "sistema_solar.tipo_kit", sm.tipo_kit ?? sm["Tipo de Kit"]);

  setIfEmpty(out, "sistema_solar.garantia_modulo", garantias.modulo_sm ?? sm.capo_m);
  setIfEmpty(out, "sistema_solar.garantia_inversor", garantias.inversor_sm ?? sm.capo_i);
  setIfEmpty(out, "sistema_solar.garantia_microinversor", garantias.microinversor_sm ?? sm.capo_mi);

  // ── financeiro.* ──────────────────────────────────────────
  setIfEmpty(out, "financeiro.valor_total", financeiroSrc.valor_total ?? pagamentoSrc.valor_total ?? toNum(sm.preco));
  setIfEmpty(out, "financeiro.valor_kit", toNum(sm.preco_kits));
  setIfEmpty(out, "financeiro.valor_a_vista", toNum(sm.vc_a_vista));
  setIfEmpty(out, "financeiro.tir", toNum(sm.tir));
  setIfEmpty(out, "financeiro.vpl", toNum(sm.vpl));
  setIfEmpty(out, "financeiro.payback", sm.payback ?? sm.Payback);
  setIfEmpty(out, "financeiro.economia_25_anos", toNum(sm.solar_25));
  setIfEmpty(out, "financeiro.renda_25_anos", toNum(sm.renda_25));
  setIfEmpty(out, "financeiro.aumento_tarifa", toNum(sm.vc_aumento));
  setIfEmpty(out, "financeiro.imposto", toNum(sm.imposto ?? sm.Imposto));

  // ── conta_energia.* ───────────────────────────────────────
  setIfEmpty(out, "conta_energia.consumo_mensal", toNum(sm.vc_consumo));
  setIfEmpty(out, "conta_energia.consumo_abatido", toNum(sm.vc_consumo));
  for (const mes of ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]) {
    setIfEmpty(out, `conta_energia.consumo_${mes}`, toNum(sm[`consumo_${mes}`]));
  }

  // ── pagamento.* (SM tem f_*_N até 28) ─────────────────────
  const opcoes: Array<{ nome: string; taxa: number | null; prazo: number | null; valor: number | null }> = [];
  for (let i = 1; i <= 28; i++) {
    const nome = sm[`f_nome_${i}`];
    if (!nome) continue;
    opcoes.push({
      nome: String(nome),
      taxa: toNum(sm[`f_taxa_${i}`]),
      prazo: toNum(sm[`f_prazo_${i}`]),
      valor: toNum(sm[`f_valor_${i}`]),
    });
  }
  if (opcoes.length) {
    setIfEmpty(out, "pagamento.opcoes_count", opcoes.length);
    opcoes.slice(0, 9).forEach((op, idx) => {
      const n = idx + 1;
      setIfEmpty(out, `pagamento.opcao_${n}_nome`, op.nome);
      setIfEmpty(out, `pagamento.opcao_${n}_taxa`, op.taxa);
      setIfEmpty(out, `pagamento.opcao_${n}_prazo`, op.prazo);
      setIfEmpty(out, `pagamento.opcao_${n}_valor`, op.valor);
    });
    setIfEmpty(out, "pagamento.valor_a_vista", toNum(sm.vc_a_vista) ?? pagamentoSrc.valor_total);
    setIfEmpty(out, "pagamento.condicao", pagamentoSrc.condicao ?? sm.vc_nome);
  }

  // ── comercial.* ───────────────────────────────────────────
  setIfEmpty(out, "comercial.titulo", proposta.titulo);
  setIfEmpty(out, "comercial.proposta_titulo", proposta.titulo);
  setIfEmpty(out, "comercial.proposta_link_pdf", proposta.link_pdf);
  setIfEmpty(out, "comercial.proposta_link", proposta.link_pdf);
  setIfEmpty(out, "comercial.proposta_data", proposta.generated_at);
  setIfEmpty(out, "comercial.proposta_data_envio", proposta.sent_at);
  setIfEmpty(out, "comercial.proposta_aceito_em", proposta.accepted_at);
  setIfEmpty(out, "comercial.proposta_aceita_at", proposta.accepted_at);
  setIfEmpty(out, "comercial.proposta_validade", proposta.expires_at);
  setIfEmpty(out, "comercial.proposta_valido_ate", proposta.expires_at);
  setIfEmpty(out, "comercial.proposta_status", proposta.status_source);
  setIfEmpty(out, "comercial.projeto_estado_instalacao", projeto.estado ?? cliente?.endereco?.estado ?? sm.estado ?? sm.Estado);
  setIfEmpty(out, "comercial.projeto_cidade_instalacao", projeto.cidade ?? cliente?.endereco?.cidade ?? sm.cidade ?? sm.Cidade);

  // ── cliente.* (achatar cliente.endereco.*) ────────────────
  if (isObj(cliente.endereco)) {
    setIfEmpty(out, "cliente.cep", cliente.endereco.cep);
    setIfEmpty(out, "cliente.rua", cliente.endereco.rua);
    setIfEmpty(out, "cliente.numero", cliente.endereco.numero);
    setIfEmpty(out, "cliente.complemento", cliente.endereco.complemento);
    setIfEmpty(out, "cliente.bairro", cliente.endereco.bairro);
    setIfEmpty(out, "cliente.cidade", cliente.endereco.cidade);
    setIfEmpty(out, "cliente.estado", cliente.endereco.estado);
  }

  out.__canonicalized = true;
  return out as T;
}
