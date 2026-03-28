/**
 * Domain resolver: pagamento / customizada.* variables
 * Sources: snapshot.pagamento_opcoes / pagamentoOpcoes arrays
 */
import { type AnyObj, safeArr, str, num, fmtCur, fmtNum, fmtVal, type ResolverExternalContext } from "./types.ts";

const INVALID_TOKENS = new Set(["", "-", "--", "n/a", "na", "null", "undefined"]);

function parseLocaleNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  if (!raw || INVALID_TOKENS.has(raw.toLowerCase())) return null;
  let normalized = raw.replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
  if (!normalized) return null;
  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

function pickText(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const txt = String(value).trim();
    if (!txt || INVALID_TOKENS.has(txt.toLowerCase())) continue;
    return txt;
  }
  return undefined;
}

interface NormalizedPagamento {
  tipo: string;
  nome: string;
  valor_financiado: number | null;
  valor_parcela: number | null;
  entrada: number | null;
  num_parcelas: number | null;
  taxa_mensal: number | null;
  carencia: number | null;
}

function normalizePagOpcoes(rawArr: AnyObj[]): NormalizedPagamento[] {
  return rawArr.map((p) => {
    const nome = pickText(p.nome, p.banco, p.banco_nome, p.label, p.descricao) || "Opção";
    const rawTipo = pickText(p.tipo, p.metodo, p.forma_pagamento)?.toLowerCase() || "";
    const nomeLower = nome.toLowerCase();
    let tipo = rawTipo;
    if (rawTipo.includes("vista")) tipo = "a_vista";
    else if (rawTipo.includes("cart")) tipo = "cartao";
    else if (rawTipo.includes("financ")) tipo = "financiamento";
    else if (rawTipo.includes("parcel")) tipo = "parcelado";
    if (!tipo) {
      if (/cart[aã]o|cr[eé]dito/i.test(nomeLower)) tipo = "cartao";
      else if (/a vista|à vista/i.test(nomeLower)) tipo = "a_vista";
      else tipo = "outro";
    }
    return {
      tipo,
      nome,
      valor_financiado: parseLocaleNumber(p.valor_financiado ?? p.valorFinanciado ?? p.valor ?? p.valor_total),
      valor_parcela: parseLocaleNumber(p.valor_parcela ?? p.valorParcela ?? p.parcela ?? p.valor_mensal),
      entrada: parseLocaleNumber(p.entrada ?? p.valor_entrada ?? p.entrada_valor),
      num_parcelas: (() => { const n = parseLocaleNumber(p.num_parcelas ?? p.numParcelas ?? p.prazo ?? p.parcelas); return n != null ? Math.round(n) : null; })(),
      taxa_mensal: parseLocaleNumber(p.taxa_mensal ?? p.taxaMensal ?? p.taxa ?? p.juros_mensal),
      carencia: (() => { const n = parseLocaleNumber(p.carencia ?? p.carencia_meses ?? p.meses_carencia); return n != null ? Math.round(n) : null; })(),
    };
  }).filter((p) =>
    p.tipo === "a_vista" || p.valor_financiado != null || p.valor_parcela != null || p.num_parcelas != null || p.taxa_mensal != null || p.entrada != null
  );
}

export function resolvePagamento(
  snapshot: AnyObj | null | undefined,
  ext?: ResolverExternalContext,
): Record<string, string> {
  const out: Record<string, string> = {};
  const snap = snapshot ?? {};

  const set = (k: string, v: unknown) => {
    const s = str(v);
    if (s && !out[k]) out[k] = s;
  };
  // AP-17: all monetary values return pure numbers without R$
  const setCur = (k: string, v: number | null) => {
    if (v != null && !isNaN(v) && !out[k]) out[k] = fmtVal(v);
  };

  // ── Legacy direct keys from snapshot ──
  set("vc_cartao_credito_parcela_1", snap.cartao_parcela_3);
  set("vc_cartao_credito_parcela_2", snap.cartao_parcela_6);
  set("vc_cartao_credito_parcela_3", snap.cartao_parcela_12);
  set("vc_cartao_credito_parcela_4", snap.cartao_parcela_24);
  set("vc_parcela_1", snap.parcela_36);
  set("vc_parcela_2", snap.parcela_48);
  set("vc_parcela_3", snap.parcela_60);

  // ── Process pagamento_opcoes / pagamentoOpcoes ──
  const rawPagOpcoes = safeArr(snap.pagamento_opcoes).length > 0
    ? safeArr(snap.pagamento_opcoes)
    : safeArr(snap.pagamentoOpcoes);

  if (rawPagOpcoes.length === 0) return out;

  const normalized = normalizePagOpcoes(rawPagOpcoes);
  if (normalized.length === 0) return out;

  // ── vc_a_vista ──
  const aVista = normalized.find(p => p.tipo === "a_vista")
    || normalized.find(p => /a vista|à vista/i.test(p.nome));
  const valorTotal = num(snap.preco_total) ?? num(snap.preco) ?? num(snap.valor_total);
  const aVistaValor = aVista?.valor_financiado ?? aVista?.valor_parcela ?? valorTotal;
  if (aVistaValor != null) setCur("vc_a_vista", aVistaValor);

  // ── Cartões ──
  const cartoes = normalized
    .filter(p => p.tipo === "cartao" || /cart[aã]o|cr[eé]dito/i.test(p.nome))
    .sort((a, b) => (a.num_parcelas ?? 999) - (b.num_parcelas ?? 999));

  cartoes.slice(0, 4).forEach((c, idx) => {
    const i = idx + 1;
    const parcela = c.valor_parcela ?? ((c.valor_financiado != null && c.num_parcelas && c.num_parcelas > 0) ? c.valor_financiado / c.num_parcelas : null);
    if (parcela != null) setCur(`vc_cartao_credito_parcela_${i}`, parcela);
  });

  // ── Financiamentos ──
  const financiamentos = normalized
    .filter(p => p.tipo === "financiamento" || p.tipo === "parcelado" || (p.tipo === "outro" && !/cart[aã]o|cr[eé]dito/i.test(p.nome)))
    .sort((a, b) => (a.num_parcelas ?? 999) - (b.num_parcelas ?? 999));

  financiamentos.slice(0, 3).forEach((f, idx) => {
    const i = idx + 1;
    const parcela = f.valor_parcela ?? ((f.valor_financiado != null && f.num_parcelas && f.num_parcelas > 0) ? f.valor_financiado / f.num_parcelas : null);
    if (parcela != null) setCur(`vc_parcela_${i}`, parcela);
    if (f.taxa_mensal != null) set(`vc_taxa_${i}`, fmtNum(f.taxa_mensal, 2));
    if (f.entrada != null) setCur(`vc_entrada_${i}`, f.entrada);
    if (f.num_parcelas != null) set(`vc_prazo_${i}`, String(f.num_parcelas));
  });

  // ── f_* indexed (all payment options) ──
  const valorTotalNum = parseLocaleNumber(snap.preco_total) ?? parseLocaleNumber(snap.preco) ?? parseLocaleNumber(snap.valor_total);
  const fOpcoes = [...financiamentos, ...cartoes].slice(0, 12);
  fOpcoes.forEach((p, idx) => {
    const i = idx + 1;
    const valorFinanciado = p.valor_financiado
      ?? ((p.valor_parcela != null && p.num_parcelas && p.num_parcelas > 0) ? (p.valor_parcela * p.num_parcelas) + (p.entrada ?? 0) : null);
    const parcela = p.valor_parcela ?? ((valorFinanciado != null && p.num_parcelas && p.num_parcelas > 0) ? valorFinanciado / p.num_parcelas : null);
    set(`f_nome_${i}`, p.nome);
    if (p.entrada != null) setCur(`f_entrada_${i}`, p.entrada);
    if (valorFinanciado != null) setCur(`f_valor_${i}`, valorFinanciado);
    if (p.num_parcelas != null) set(`f_prazo_${i}`, String(p.num_parcelas));
    if (p.taxa_mensal != null) set(`f_taxa_${i}`, fmtNum(p.taxa_mensal, 2));
    if (parcela != null) setCur(`f_parcela_${i}`, parcela);
    if (p.carencia != null) set(`f_carencia_${i}`, String(p.carencia));

    // Derivados percentuais
    if (valorTotalNum && valorTotalNum > 0) {
      if (p.entrada != null) set(`f_entrada_p_${i}`, fmtNum((p.entrada / valorTotalNum) * 100, 1));
      if (valorFinanciado != null) set(`f_valor_p_${i}`, fmtNum((valorFinanciado / valorTotalNum) * 100, 1));
    }
  });

  // ── f_ativo_* (first financiamento) ──
  const finAtiva = normalized.find(p => p.tipo === "financiamento");
  if (finAtiva) {
    set("f_ativo_nome", finAtiva.nome);
    if (finAtiva.valor_parcela != null) setCur("f_ativo_parcela", finAtiva.valor_parcela);
    if (finAtiva.taxa_mensal != null) set("f_ativo_taxa", fmtNum(finAtiva.taxa_mensal, 2));
    if (finAtiva.num_parcelas != null) set("f_ativo_prazo", String(finAtiva.num_parcelas));
    if (finAtiva.entrada != null) setCur("f_ativo_entrada", finAtiva.entrada);
    if (finAtiva.valor_financiado != null) setCur("f_ativo_valor", finAtiva.valor_financiado);
    if (finAtiva.carencia != null) set("f_ativo_carencia", String(finAtiva.carencia));
    set("vc_financeira_nome", finAtiva.nome);

    // Derivados percentuais do financiamento ativo
    if (valorTotalNum && valorTotalNum > 0) {
      if (finAtiva.entrada != null) set("f_ativo_entrada_p", fmtNum((finAtiva.entrada / valorTotalNum) * 100, 1));
      if (finAtiva.valor_financiado != null) set("f_ativo_valor_p", fmtNum((finAtiva.valor_financiado / valorTotalNum) * 100, 1));
    }
  }

  // ── vc_nome = client name (resolved in clienteComercial, but set here as fallback) ──
  // set("vc_nome", ...) is NOT done here — belongs to resolveClienteComercial

  return out;
}
