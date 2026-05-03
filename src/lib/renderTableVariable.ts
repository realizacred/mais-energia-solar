/**
 * renderTableVariable — Renderiza variáveis do grupo "tabelas.*" como HTML inline.
 *
 * Saída: string HTML com inline styles (sem dependências CSS externas).
 * Retorna null quando não há dados suficientes para a tabela solicitada.
 *
 * REGRA: leitura-only do snapshot. Nunca muta. Compatível com SM (lê
 * snapshot.sm_variables.consumo_jan..dez como fallback).
 */

const MESES_PT = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const MES_KEYS = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// ── Helpers ──────────────────────────────────────────────────

const fmtKwh = (n: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(n);

const fmtBrl = (n: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const TABLE_STYLE =
  'width:100%;border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;margin:8px 0;';
const TH_STYLE =
  'background:#f3f4f6;color:#111827;text-align:left;padding:6px 10px;border:1px solid #e5e7eb;font-weight:600;';
const TD_STYLE =
  'padding:6px 10px;border:1px solid #e5e7eb;color:#111827;';
const TD_NUM_STYLE = TD_STYLE + 'text-align:right;';

function tableHtml(headers: string[], rows: string[][]): string {
  const thead = headers
    .map((h, i) => `<th style="${TH_STYLE}${i > 0 ? 'text-align:right;' : ''}">${h}</th>`)
    .join("");
  const tbody = rows
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => `<td style="${i > 0 ? TD_NUM_STYLE : TD_STYLE}">${c}</td>`)
          .join("")}</tr>`
    )
    .join("");
  return `<table style="${TABLE_STYLE}"><thead><tr>${thead}</tr></thead><tbody>${tbody}</tbody></table>`;
}

// ── Extractors ───────────────────────────────────────────────

/** Extrai 12 valores mensais de várias fontes possíveis. Retorna null se nada disponível. */
function extractMonthlySeries(
  snapshot: Record<string, any>,
  primaryPath: any,
  smPrefix: string
): number[] | null {
  // 1. Array direto (snapshot.ucs[0].consumo_meses ou snapshot.geracao.por_mes)
  if (Array.isArray(primaryPath) && primaryPath.length === 12) {
    const arr = primaryPath.map((v) => Number(v) || 0);
    if (arr.some((v) => v > 0)) return arr;
  }
  // 2. Objeto com chaves jan..dez
  if (primaryPath && typeof primaryPath === "object" && !Array.isArray(primaryPath)) {
    const arr = MES_KEYS.map((k) => Number(primaryPath[k]) || 0);
    if (arr.some((v) => v > 0)) return arr;
  }
  // 3. SM legacy: snapshot.sm_variables.{prefix}_jan..dez ou snapshot.{prefix}_jan..dez
  const smVars = snapshot.sm_variables ?? snapshot;
  if (smVars && typeof smVars === "object") {
    const arr = MES_KEYS.map((m) => Number(smVars[`${smPrefix}_${m}`]) || 0);
    if (arr.some((v) => v > 0)) return arr;
  }
  return null;
}

// ── Renderers por chave ──────────────────────────────────────

function renderConsumoMensal(snapshot: Record<string, any>): string | null {
  const uc = snapshot?.ucs?.[0];
  const series = extractMonthlySeries(snapshot, uc?.consumo_meses, "consumo");
  if (!series) return null;
  const total = series.reduce((a, b) => a + b, 0);
  const rows = series.map((v, i) => [MESES_PT[i], `${fmtKwh(v)} kWh`]);
  rows.push(["<strong>Total</strong>", `<strong>${fmtKwh(total)} kWh</strong>`]);
  return tableHtml(["Mês", "Consumo"], rows);
}

function renderGeracaoMensal(snapshot: Record<string, any>): string | null {
  const ger = snapshot?.geracao?.por_mes;
  let series = extractMonthlySeries(snapshot, ger, "geracao");
  // Fallback: distribuir geracao_anual / 12
  if (!series) {
    const anual = Number(snapshot?.geracao?.anual ?? snapshot?.geracao_anual ?? 0);
    if (anual > 0) {
      const media = anual / 12;
      series = Array(12).fill(media);
    }
  }
  if (!series) return null;
  const total = series.reduce((a, b) => a + b, 0);
  const rows = series.map((v, i) => [MESES_PT[i], `${fmtKwh(v)} kWh`]);
  rows.push(["<strong>Total</strong>", `<strong>${fmtKwh(total)} kWh</strong>`]);
  return tableHtml(["Mês", "Geração"], rows);
}

function renderEconomiaMensal(snapshot: Record<string, any>): string | null {
  // Prioridade: série pré-calculada
  let series = extractMonthlySeries(
    snapshot,
    snapshot?.economia?.por_mes,
    "economia"
  );
  // Fallback: economia_mensal constante
  if (!series) {
    const mensal = Number(
      snapshot?.economia_mensal ?? snapshot?.financeiro?.economia_mensal ?? 0
    );
    if (mensal > 0) series = Array(12).fill(mensal);
  }
  if (!series) return null;
  const total = series.reduce((a, b) => a + b, 0);
  const rows = series.map((v, i) => [MESES_PT[i], fmtBrl(v)]);
  rows.push(["<strong>Total</strong>", `<strong>${fmtBrl(total)}</strong>`]);
  return tableHtml(["Mês", "Economia"], rows);
}

function renderEquipamentos(snapshot: Record<string, any>): string | null {
  const itens = snapshot?.kit?.itens;
  if (!Array.isArray(itens) || itens.length === 0) return null;
  const rows = itens.map((it: any) => {
    const nome = String(
      it.descricao ?? it.modelo ?? it.nome ?? it.categoria ?? "-"
    );
    const fab = String(it.fabricante ?? "-");
    const qtd = String(it.quantidade ?? "-");
    const pot = it.potencia_w ? `${fmtKwh(Number(it.potencia_w))} W` : "-";
    return [nome, fab, qtd, pot];
  });
  return tableHtml(["Equipamento", "Fabricante", "Qtd", "Potência"], rows);
}

function renderParcelas(snapshot: Record<string, any>): string | null {
  // Fontes possíveis: pagamentoOpcoes (nativo) ou venda.condicoes_pagamento.parcelas (raro)
  const opcoes = snapshot?.pagamentoOpcoes;
  if (Array.isArray(opcoes) && opcoes.length > 0) {
    const rows = opcoes.map((p: any) => [
      String(p.nome ?? p.tipo ?? "-"),
      String(p.num_parcelas ?? "1"),
      p.valor_parcela != null ? fmtBrl(Number(p.valor_parcela)) : "-",
      p.taxa_mensal != null ? `${Number(p.taxa_mensal).toFixed(2)}% a.m.` : "-",
    ]);
    return tableHtml(["Modalidade", "Parcelas", "Valor", "Taxa"], rows);
  }
  // SM legacy: parcelas explícitas
  const cp = snapshot?.venda?.condicoes_pagamento;
  if (cp && Array.isArray(cp.parcelas_lista)) {
    const rows = cp.parcelas_lista.map((p: any, i: number) => [
      String(i + 1),
      p.vencimento ?? "-",
      fmtBrl(Number(p.valor) || 0),
    ]);
    return tableHtml(["#", "Vencimento", "Valor"], rows);
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────

const RENDERERS: Record<string, (s: Record<string, any>) => string | null> = {
  "tabelas.consumo_mensal": renderConsumoMensal,
  "tabelas.geracao_mensal": renderGeracaoMensal,
  "tabelas.economia_mensal": renderEconomiaMensal,
  "tabelas.equipamentos": renderEquipamentos,
  "tabelas.parcelas": renderParcelas,
};

export function renderTableVariable(
  key: string,
  snapshot: Record<string, any> | null | undefined
): string | null {
  if (!snapshot) return null;
  const fn = RENDERERS[key];
  if (!fn) return null;
  try {
    return fn(snapshot);
  } catch {
    return null;
  }
}

export const TABLE_VARIABLE_KEYS = Object.keys(RENDERERS);
