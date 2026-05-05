// ──────────────────────────────────────────────────────────────────────────────
// parse-conta-energia — Deterministic PDF invoice parser (NO AI/LLM)
// Layer 0: Concessionária-specific parsers (Energisa, etc.)
// Layer 1: Generic regex fallback
// NO AI fallback — 100% deterministic, auditable, reproducible
// Parser version: 3.0.2
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { callAi } from "../_shared/aiCallNoLovable.ts";

const PARSER_VERSION = "3.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// ── Types ────────────────────────────────────────────────────────────────────

interface FieldResult {
  value: any;
  source: string;
  validated: boolean;
  note: string | null;
}

interface ValidationResult {
  rule: string;
  passed: boolean;
  detail: string;
}

interface ExtractedData {
  concessionaria_nome: string | null;
  cliente_nome: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  consumo_kwh: number | null;
  tarifa_energia_kwh: number | null;
  tarifa_fio_b_kwh: number | null;
  valor_total: number | null;
  icms_percentual: number | null;
  pis_valor: number | null;
  cofins_valor: number | null;
  bandeira_tarifaria: string | null;
  classe_consumo: string | null;
  tipo_ligacao: string | null;
  mes_referencia: string | null;
  demanda_contratada_kw: number | null;
  numero_uc: string | null;
  vencimento: string | null;
  proxima_leitura_data: string | null;
  data_leitura_anterior: string | null;
  data_leitura_atual: string | null;
  dias_leitura: number | null;
  saldo_gd: number | null;
  saldo_gd_acumulado: number | null;
  leitura_anterior_03: number | null;
  leitura_atual_03: number | null;
  leitura_anterior_103: number | null;
  leitura_atual_103: number | null;
  medidor_consumo_codigo: string | null;
  medidor_injecao_codigo: string | null;
  energia_injetada_kwh: number | null;
  energia_compensada_kwh: number | null;
  categoria_gd: string | null;
  modalidade_tarifaria: string | null;
  demanda_medida_kw: number | null;
  demanda_ultrapassagem_kw: number | null;
  multa_demanda_valor: number | null;
  confidence: number;
  ai_fallback_used: boolean;
  ai_model_used: string | null;
  parser_version: string;
  parser_used: string;
  extraction_method: "deterministic" | "ai_enriched";
  field_results: Record<string, FieldResult>;
  validations: ValidationResult[];
  raw_fields: Record<string, string>;
}

// ── Known concessionária patterns ────────────────────────────────────────────
const CONC_PATTERNS: Array<{ pattern: RegExp; nome: string }> = [
  { pattern: /CEMIG/i, nome: "CEMIG" },
  { pattern: /COPEL/i, nome: "COPEL" },
  { pattern: /CPFL\s*PAULISTA/i, nome: "CPFL Paulista" },
  { pattern: /CPFL\s*PIRATININGA/i, nome: "CPFL Piratininga" },
  { pattern: /LIGHT/i, nome: "Light" },
  { pattern: /ENEL\s*(SP|S[ÃA]O\s*PAULO|ELETROPAULO)/i, nome: "Enel SP" },
  { pattern: /ENEL\s*(RJ|RIO)/i, nome: "Enel Distribuição Rio" },
  { pattern: /ENEL\s*CE/i, nome: "Enel CE" },
  { pattern: /CELESC/i, nome: "CELESC" },
  { pattern: /ENERGISA/i, nome: "Energisa" },
  { pattern: /EQUATORIAL/i, nome: "Equatorial" },
  { pattern: /NEOENERGIA/i, nome: "Neoenergia" },
  { pattern: /CELPE/i, nome: "CELPE" },
  { pattern: /COELBA/i, nome: "COELBA" },
  { pattern: /COSERN/i, nome: "COSERN" },
  { pattern: /EDP/i, nome: "EDP" },
  { pattern: /ELEKTRO/i, nome: "Neoenergia Elektro" },
  { pattern: /RGE/i, nome: "RGE" },
  { pattern: /CEB/i, nome: "CEB" },
  { pattern: /CELPA/i, nome: "CELPA" },
  { pattern: /CEMAR/i, nome: "CEMAR" },
];

// ── Utility Functions ────────────────────────────────────────────────────────

function parseNum(value: string): number {
  const normalized = value.trim().replace(/\s/g, '');
  if (!normalized) return NaN;
  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');
  if (hasComma && hasDot) {
    if (normalized.lastIndexOf(',') > normalized.lastIndexOf('.')) {
      return Number(normalized.replace(/\./g, '').replace(',', '.'));
    }
    return Number(normalized.replace(/,/g, ''));
  }
  if (hasComma) return Number(normalized.replace(/\./g, '').replace(',', '.'));
  if (hasDot) {
    const parts = normalized.split('.');
    if (parts.length > 2) return Number(parts.join(''));
    if (/^\d+\.\d{3}$/.test(normalized)) return Number(parts.join(''));
  }
  return Number(normalized);
}

function normalizeUcCode(value: string): string {
  const normalized = value.replace(/[^\d\/-]/g, '').trim();
  if (!normalized) return value.trim();
  return normalized.replace(/^0+(?=\d{6,})/, '');
}

function normalizeDateLike(value: string): string {
  const parts = value.split(/[\/\.\-]/).map((part) => part.trim());
  if (parts.length !== 3) return value;
  const [day, month, year] = parts;
  const fullYear = year.length === 2 ? `20${year}` : year;
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${fullYear}`;
}

function isPlausibleDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const normalized = normalizeDateLike(value);
  const match = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return false;
  const [, day, month, year] = match;
  return Number(year) >= 2020 && Number(year) <= 2100 && Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31;
}

function firstMatch(text: string, patterns: RegExp[], groupIdx = 1): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[groupIdx]) return m[groupIdx];
  }
  return null;
}

function firstMatchNum(text: string, patterns: RegExp[], groupIdx = 1): number | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[groupIdx]) {
      const v = parseNum(m[groupIdx]);
      if (Number.isFinite(v)) return v;
    }
  }
  return null;
}

function firstMatchDate(text: string, patterns: RegExp[], groupIdx = 1): string | null {
  for (const p of patterns) {
    const m = text.match(p);
    if (m && m[groupIdx]) {
      const candidate = normalizeDateLike(m[groupIdx]);
      if (isPlausibleDate(candidate)) return candidate;
    }
  }
  return null;
}

function makeField(value: any, source: string, validated = false, note: string | null = null): FieldResult {
  return { value, source, validated, note };
}

function extractLocalizedNumberTokens(value: string): number[] {
  const matches = value.match(/\d+(?:\.\d{3})*,\d{2}/g) ?? [];
  return matches
    .map((item) => parseNum(item))
    .filter((item) => Number.isFinite(item));
}

function dateToSortableNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = normalizeDateLike(value);
  if (!isPlausibleDate(normalized)) return null;
  const [day, month, year] = normalized.split('/').map(Number);
  return (year * 10000) + (month * 100) + day;
}

// ── Meter Row Extraction ────────────────────────────────────────────────────

function extractMeterRow(flatText: string, labelPattern: string) {
  const regex = new RegExp(
    `(?:[A-Z0-9-]{6,}\\s+)?${labelPattern}(?:\\s+(?:ponta|fora\\s+de\\s+ponta|intermedi[aá]rio))?\\s+(\\d[\\d.,]*)\\s+(\\d[\\d.,]*)\\s+(\\d[\\d.,]*)\\s+(\\d[\\d.,]*)`,
    'i'
  );
  const match = flatText.match(regex);
  if (!match) return null;
  const previous = parseNum(match[1]);
  const current = parseNum(match[2]);
  const factor = parseNum(match[3]);
  const total = parseNum(match[4]);
  if (![previous, current, total].every(Number.isFinite)) return null;
  if (previous < 0 || current < previous || total < 0) return null;
  return { previous, current, factor: Number.isFinite(factor) ? factor : null, total };
}

/**
 * Splits a concatenated meter reading number (common in Energisa PDFs via unpdf).
 * unpdf sometimes joins columns: e.g. "25219041652" = total(252) + current(1904) + previous(1652)
 * where total = current - previous.
 * Returns null if no valid split found.
 */
function splitConcatenatedMeterReading(concatenated: string): { total: number; current: number; previous: number } | null {
  const len = concatenated.length;
  if (len < 5 || len > 20) return null;

  // Try all possible 3-way splits: concatenated = total | current | previous
  for (let i = 1; i <= Math.min(6, len - 4); i++) {
    for (let j = i + 1; j <= len - 1; j++) {
      const totalStr = concatenated.substring(0, i);
      const currentStr = concatenated.substring(i, j);
      const previousStr = concatenated.substring(j);

      // Reject parts with leading zeros (except single "0")
      if ((totalStr.length > 1 && totalStr[0] === '0') ||
          (currentStr.length > 1 && currentStr[0] === '0') ||
          (previousStr.length > 1 && previousStr[0] === '0')) continue;

      const total = parseInt(totalStr);
      const current = parseInt(currentStr);
      const previous = parseInt(previousStr);

      if (isNaN(total) || isNaN(current) || isNaN(previous)) continue;
      if (total <= 0 || current < 0 || previous < 0) continue;
      if (current <= previous) continue; // current must be > previous for meter readings

      // Check if total = current - previous
      if (total === current - previous) {
        return { total, current, previous };
      }
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// ENERGISA PARSER — Deterministic, regex-only, auditable
// ══════════════════════════════════════════════════════════════════════════════

function extractEnergisa(text: string): ExtractedData | null {
  const flatText = text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/ENERGISA/i.test(flatText)) return null;

  console.log("[parse-conta-energia] Energisa detected — using strict deterministic parser v" + PARSER_VERSION);

  // ── AUDIT LOG: first 2000 chars of flat text for debugging ──
  console.log("[parse-conta-energia] AUDIT flatText sample:", flatText.slice(0, 2000));
  console.log("[parse-conta-energia] AUDIT flatText sample2:", flatText.slice(2000, 4000));

  const raw: Record<string, string> = {};
  const fieldResults: Record<string, FieldResult> = {};
  const validations: ValidationResult[] = [];
  let confidence = 20;
  let shouldSwapTariffs = true;

  // ── 1. Identificação e Datas ──

  // Referência / vencimento / valor total no cabeçalho DANF3E (layout novo Energisa)
  let mesRef: string | null = null;
  let vencimento: string | null = null;
  let valorTotal: number | null = null;

  const headerPatterns = [
    {
      regex: /([A-Za-zÀ-ú]+\s*\/\s*\d{4})\s+(\d{2}[\/.]\d{2}[\/.]\d{4})\s+R\$\s*(\d[\d.,]*)/i,
      map: (match: RegExpMatchArray) => ({ mesRef: match[1].trim(), vencimento: normalizeDateLike(match[2]), valorTotal: parseNum(match[3]) }),
    },
    {
      regex: /(\d{2}[\/.]\d{2}[\/.]\d{4})\s+R\$\s*(\d[\d.,]*)\s*([A-Za-zÀ-ú]+\s*\/\s*\d{4})/i,
      map: (match: RegExpMatchArray) => ({ mesRef: match[3].trim(), vencimento: normalizeDateLike(match[1]), valorTotal: parseNum(match[2]) }),
    },
  ];
  const headerResumoMatch = headerPatterns
    .map((item) => {
      const match = flatText.match(item.regex);
      return match ? item.map(match) : null;
    })
    .find(Boolean);
  if (headerResumoMatch) {
    mesRef = headerResumoMatch.mesRef;
    vencimento = headerResumoMatch.vencimento;
    valorTotal = headerResumoMatch.valorTotal;
    raw['ref'] = mesRef;
    raw['vencimento'] = vencimento;
    raw['total'] = String(valorTotal);
    fieldResults['mes_referencia'] = makeField(mesRef, 'regex:HEADER_RESUMO', true);
    fieldResults['vencimento'] = makeField(vencimento, 'regex:HEADER_RESUMO', isPlausibleDate(vencimento));
    fieldResults['valor_total'] = makeField(valorTotal, 'regex:HEADER_RESUMO', !!valorTotal && valorTotal > 0, !valorTotal || valorTotal <= 0 ? 'Valor <= 0' : null);
    confidence += 20;
  }

  // Data leitura anterior e atual
  let dataLeituraAnterior: string | null = null;
  let dataLeituraAtual: string | null = null;

  if (!mesRef) {
    const refMatch = flatText.match(/REF[:\s]*MES\s*\/\s*ANO\s+([A-Za-zÀ-ú]+\s*\/\s*\d{4})/i)
      || flatText.match(/REF[:\s]*([A-Za-zÀ-ú]+\s*\/\s*\d{4})/i)
      || flatText.match(/(?:m[êe]s\s*(?:de\s*)?refer[êe]ncia)[:\s]*((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\w\s\/]*\d{2,4})/i);
    if (refMatch) {
      mesRef = refMatch[1].trim();
      raw['ref'] = refMatch[0];
      fieldResults['mes_referencia'] = makeField(mesRef, 'regex:REF_MES_ANO', true);
      confidence += 10;
    }
  }

  if (!vencimento) {
    const vencMatch = flatText.match(/VENCIMENTO[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i)
      || flatText.match(/DATA\s+DO\s+PROCESSAMENTO\s+\d{2}[\/.]\d{2}[\/.]\d{4}\s+(\d{2}[\/.]\d{2}[\/.]\d{4})/i);
    if (vencMatch) {
      vencimento = normalizeDateLike(vencMatch[1]);
      raw['vencimento'] = vencMatch[0];
      fieldResults['vencimento'] = makeField(vencimento, 'regex:VENCIMENTO', isPlausibleDate(vencimento));
      confidence += 10;
    }
  }

  if (valorTotal == null) {
    const totalPatterns = [
      /\(=\)\s*VALOR\s*DO\s*DOCUMENTO\s*(\d[\d.,]*)/i,
      /\(=\)\s*valor\s*do\s*documento[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /TOTAL\s+A\s+PAGAR\s+(?:[A-Za-zÀ-ú]+\s*\/\s*\d{4}\s+)?(?:\d{2}[\/.]\d{2}[\/.]\d{2,4}\s+)?R\$\s*(\d[\d.,]*)/i,
      /TOTAL\s+A\s+PAGAR[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /VALOR\s+DO\s+DOCUMENTO\D{0,30}(\d[\d.,]*)/i,
      /valor\s*(?:total|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    ];
    valorTotal = firstMatchNum(flatText, totalPatterns);
    if (valorTotal != null) {
      raw['total'] = String(valorTotal);
      fieldResults['valor_total'] = makeField(valorTotal, 'regex:TOTAL_A_PAGAR', valorTotal > 0, valorTotal <= 0 ? 'Valor <= 0' : null);
      confidence += 10;
    }
  }

  // Próxima Leitura
  const proxPatterns = [
    /Pr[óo]xima\s+Leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /data\s*(?:da\s*)?pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /previs[ãa]o\s*(?:da\s*)?(?:pr[óo]x(?:ima)?\s*)?leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /data\s*prevista\s*(?:para\s*)?leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /leitura\s*seguinte[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
  ];
  const proximaLeitura = firstMatchDate(flatText, proxPatterns);

  // Fallback: table row "Leituras dd/mm/yyyy dd/mm/yyyy NN dd/mm/yyyy"
  let resolvedProximaLeitura = proximaLeitura;
  if (!resolvedProximaLeitura) {
    const tableProxMatch = flatText.match(/Leituras\s+(\d{2}[\/.]\d{2}[\/.]\d{4})\s+(\d{2}[\/.]\d{2}[\/.]\d{4})\s+\d+\s+(\d{2}[\/.]\d{2}[\/.]\d{4})/i);
    if (tableProxMatch) {
      const proxCandidate = normalizeDateLike(tableProxMatch[3]);
      if (isPlausibleDate(proxCandidate)) {
        resolvedProximaLeitura = proxCandidate;
        if (!dataLeituraAnterior) {
          const d1 = normalizeDateLike(tableProxMatch[1]);
          if (isPlausibleDate(d1)) { dataLeituraAnterior = d1; fieldResults['data_leitura_anterior'] = makeField(d1, 'regex:LEITURAS_TABLE_ROW', true); }
        }
        if (!dataLeituraAtual) {
          const d2 = normalizeDateLike(tableProxMatch[2]);
          if (isPlausibleDate(d2)) { dataLeituraAtual = d2; fieldResults['data_leitura_atual'] = makeField(d2, 'regex:LEITURAS_TABLE_ROW', true); }
        }
      }
    }
  }
  if (resolvedProximaLeitura) {
    raw['prox_leitura'] = resolvedProximaLeitura;
    fieldResults['proxima_leitura_data'] = makeField(resolvedProximaLeitura, resolvedProximaLeitura === proximaLeitura ? 'regex:PROXIMA_LEITURA' : 'regex:LEITURAS_TABLE_ROW', true);
    confidence += 10;
  }

  let diasLeitura: number | null = null;

  const leitDatasMatch = flatText.match(/(?:per[íi]odo|leitura)[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})\s*(?:a|até|at[ée])\s*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i);
  if (leitDatasMatch) {
    const d1 = normalizeDateLike(leitDatasMatch[1]);
    const d2 = normalizeDateLike(leitDatasMatch[2]);
    if (isPlausibleDate(d1)) { dataLeituraAnterior = d1; fieldResults['data_leitura_anterior'] = makeField(d1, 'regex:PERIODO_LEITURA', true); }
    if (isPlausibleDate(d2)) { dataLeituraAtual = d2; fieldResults['data_leitura_atual'] = makeField(d2, 'regex:PERIODO_LEITURA', true); }
  }

  const compactLeiturasMatch = flatText.match(/(\d{2}[\/.]\d{2}[\/.]\d{4})\s*Leitura\s+Atual:\s*(\d{2}[\/.]\d{2}[\/.]\d{4})\s*Leitura\s+Anterior:\s*Dias:\s*(\d{1,3})/i)
    || flatText.match(/Leitura\s+Atual:\s*(\d{2}[\/.]\d{2}[\/.]\d{4})\s*Leitura\s+Anterior:\s*(\d{2}[\/.]\d{2}[\/.]\d{4})\s*Dias:\s*(\d{1,3})/i);
  if (compactLeiturasMatch) {
    const dataAtualCompact = normalizeDateLike(compactLeiturasMatch[1]);
    const dataAnteriorCompact = normalizeDateLike(compactLeiturasMatch[2]);
    const diasCompact = parseInt(compactLeiturasMatch[3], 10);
    if (!dataLeituraAtual && isPlausibleDate(dataAtualCompact)) {
      dataLeituraAtual = dataAtualCompact;
      fieldResults['data_leitura_atual'] = makeField(dataAtualCompact, 'regex:LEITURAS_COMPACT', true);
    }
    if (!dataLeituraAnterior && isPlausibleDate(dataAnteriorCompact)) {
      dataLeituraAnterior = dataAnteriorCompact;
      fieldResults['data_leitura_anterior'] = makeField(dataAnteriorCompact, 'regex:LEITURAS_COMPACT', true);
    }
    if (Number.isFinite(diasCompact) && diasCompact > 0 && diasCompact < 90) {
      diasLeitura = diasCompact;
      fieldResults['dias_leitura'] = makeField(diasCompact, 'regex:LEITURAS_COMPACT', true);
    }
  }

  if (!resolvedProximaLeitura || !dataLeituraAnterior || !dataLeituraAtual || diasLeitura == null) {
    const cicloLeituraMatches = [...flatText.matchAll(/(\d{2}[\/.]\d{2}[\/.]\d{4})\s*(\d{2}[\/.]\d{2}[\/.]\d{4})\s*(\d{1,3})\s*(\d{2}[\/.]\d{2}[\/.]\d{4})/g)];
    for (const match of cicloLeituraMatches) {
      const proximaCandidate = normalizeDateLike(match[1]);
      const anteriorCandidate = normalizeDateLike(match[2]);
      const diasCandidate = parseInt(match[3], 10);
      const atualCandidate = normalizeDateLike(match[4]);

      const proximaOrder = dateToSortableNumber(proximaCandidate);
      const anteriorOrder = dateToSortableNumber(anteriorCandidate);
      const atualOrder = dateToSortableNumber(atualCandidate);

      if (
        !proximaOrder || !anteriorOrder || !atualOrder
        || !(anteriorOrder < atualOrder && atualOrder < proximaOrder)
        || !Number.isFinite(diasCandidate)
        || diasCandidate <= 0
        || diasCandidate > 60
      ) {
        continue;
      }

      raw['ciclo_leitura'] = `${anteriorCandidate}|${atualCandidate}|${diasCandidate}|${proximaCandidate}`;

      if (!dataLeituraAnterior) {
        dataLeituraAnterior = anteriorCandidate;
        fieldResults['data_leitura_anterior'] = makeField(anteriorCandidate, 'regex:CICLO_LEITURA_4_TOKENS', true);
      }
      if (!dataLeituraAtual) {
        dataLeituraAtual = atualCandidate;
        fieldResults['data_leitura_atual'] = makeField(atualCandidate, 'regex:CICLO_LEITURA_4_TOKENS', true);
      }
      if (diasLeitura == null) {
        diasLeitura = diasCandidate;
        fieldResults['dias_leitura'] = makeField(diasCandidate, 'regex:CICLO_LEITURA_4_TOKENS', true);
      }
      if (!resolvedProximaLeitura) {
        resolvedProximaLeitura = proximaCandidate;
        fieldResults['proxima_leitura_data'] = makeField(proximaCandidate, 'regex:CICLO_LEITURA_4_TOKENS', true);
        confidence += 10;
      }
      break;
    }
  }

  // Dias de leitura
  const diasMatch = flatText.match(/(\d{2,3})\s*dias?\s*(?:de\s*)?(?:leitura|fatura|consumo)/i)
    || flatText.match(/(?:leitura|fatura|consumo)\s*(?:em|de)?\s*(\d{2,3})\s*dias?/i);
  if (diasMatch) {
    diasLeitura = parseInt(diasMatch[1]);
    if (diasLeitura > 0 && diasLeitura < 90) {
      fieldResults['dias_leitura'] = makeField(diasLeitura, 'regex:DIAS_LEITURA', true);
    } else {
      diasLeitura = null;
    }
  }

  // ── 2. Cliente, Endereço, Nota Fiscal ──

  // Nome do cliente — geralmente logo após o cabeçalho da Energisa, antes de LIGAÇÃO
  let clienteNome: string | null = null;
  const clientePatterns = [
    /ENERGISA[^]*?S\.A\.?\s+(?:\d{2}[\/.]\d{2}[\/.]\d{4}[^]*?)?([A-ZÀ-Ú][A-ZÀ-Ú\s]{5,60}?)(?:\s*LIGA[ÇC][ÃA]O|\s*Classifica|\s*CPF|\s*CNPJ|\s*RUA|\s*AV[\s.]|\s*Endere)/i,
    /(?:CLIENTE|CONSUMIDOR|DESTINAT[ÁA]RIO)[:\s]*([A-ZÀ-Ú][A-ZÀ-Ú\s]{5,60})/i,
    /NOME[:\s]*([A-ZÀ-Ú][A-Za-zÀ-ú\s]{5,60})/i,
  ];
  for (const p of clientePatterns) {
    const m = flatText.match(p);
    if (m) {
      const candidate = m[1].trim().replace(/\s+/g, ' ');
      // Reject if it looks like an address, company name, or ligação type
      if (candidate.length >= 5
        && !/^(RUA|AV|TRAV|ROD|ESTR|BR\s|ENERGISA|DISTRIBUID)/i.test(candidate)
        && !/^(BIFASICO|TRIFASICO|MONOFASICO|BIFÁSICO|TRIFÁSICO|MONOFÁSICO)$/i.test(candidate)) {
        clienteNome = candidate;
        fieldResults['cliente_nome'] = makeField(clienteNome, 'regex:CLIENTE_NOME', true);
        break;
      }
    }
  }

  // Endereço do cliente
  let endereco: string | null = null;
  const enderecoPatterns = [
    /(?:ENDERE[ÇC]O|Endere[çc]o)[:\s]*([A-Za-zÀ-ú\d\s,.°º\-]{10,100})/i,
    /(?:RUA|AV(?:ENIDA)?|TRAV(?:ESSA)?|ROD(?:OVIA)?|ESTRADA|ALAMEDA|PRA[ÇC]A)\s+[A-Za-zÀ-ú\d\s,.°º\-]{5,80}(?:\s*[,-]\s*(?:N[°º]?\s*)?\d+)?/i,
  ];
  for (const p of enderecoPatterns) {
    const m = flatText.match(p);
    if (m) {
      endereco = (m[1] || m[0]).trim().replace(/\s+/g, ' ');
      fieldResults['endereco'] = makeField(endereco, 'regex:ENDERECO', true);
      break;
    }
  }

  // Número da nota fiscal
  let numeroNotaFiscal: string | null = null;
  const nfPatterns = [
    /NOTA\s+FISCAL\s+N[°º]?[:\s]*([\d.]+)/i,
    /NF[- ]?e?\s+N[°º]?[:\s]*([\d.]+)/i,
    /N[°º]\s*(?:da\s*)?(?:NF|Nota)[:\s]*([\d.]+)/i,
  ];
  const nfRaw = firstMatch(flatText, nfPatterns);
  if (nfRaw) {
    numeroNotaFiscal = nfRaw.replace(/\./g, '');
    fieldResults['numero_nota_fiscal'] = makeField(nfRaw, 'regex:NOTA_FISCAL', true);
  }

  // ── 3. Medidor / Consumo ──

  // Código do medidor de consumo — padrão Energisa: código alfanumérico seguido de "Energia ativa"
  let medidorConsumoCodigo: string | null = null;
  const medidorConsumoPatterns = [
    /([A-Z]\d{5,})\s+(?:Ponta)?Energia\s+ativa/i,
    /(?:medidor|n[°º]?\s*medidor|medi[çc][ãa]o)[:\s]*(\w{4,})/i,
    /(?:medidor|aparelho)\s*(?:de\s*)?(?:consumo|ativo)[:\s]*(\w{4,})/i,
  ];
  for (const p of medidorConsumoPatterns) {
    const m = flatText.match(p);
    if (m) {
      medidorConsumoCodigo = m[1];
      raw['medidor_consumo'] = m[1];
      fieldResults['medidor_consumo_codigo'] = makeField(medidorConsumoCodigo, 'regex:MEDIDOR_CONSUMO', true);
      break;
    }
  }

  // Código do medidor de injeção — padrão Energisa: código alfanumérico seguido de "Energia injetada"
  let medidorInjecaoCodigoEarly: string | null = null;
  const medidorInjPatterns = [
    /([A-Z]\d{5,})\s+(?:Ponta)?Energia\s+injetada/i,
    /(?:medidor|aparelho)\s*(?:de\s*)?(?:inje[çc][ãa]o|injetada)[:\s]*(\w{4,})/i,
  ];
  for (const p of medidorInjPatterns) {
    const m = flatText.match(p);
    if (m) {
      medidorInjecaoCodigoEarly = m[1];
      fieldResults['medidor_injecao_codigo'] = makeField(medidorInjecaoCodigoEarly, 'regex:MEDIDOR_INJECAO_EARLY', true);
      break;
    }
  }

  let leituraAnterior03: number | null = null;
  let leituraAtual03: number | null = null;
  let consumoKwh: number | null = null;

  // Structured meter row
  const activeMeterRow = extractMeterRow(flatText, 'energia\\s+ativa(?:\\s+em\\s+kwh)?');
  if (activeMeterRow) {
    leituraAnterior03 = activeMeterRow.previous;
    leituraAtual03 = activeMeterRow.current;
    consumoKwh = activeMeterRow.total;
    raw['leitura_03'] = `ant=${activeMeterRow.previous} atu=${activeMeterRow.current} cons=${activeMeterRow.total}`;
    fieldResults['leitura_anterior_03'] = makeField(leituraAnterior03, 'regex:METER_ROW_ENERGIA_ATIVA', true);
    fieldResults['leitura_atual_03'] = makeField(leituraAtual03, 'regex:METER_ROW_ENERGIA_ATIVA', true);
    fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:METER_ROW_ENERGIA_ATIVA', true);
    confidence += 15;
  }

  // ── Energisa fallback: concatenated meter readings from unpdf ──
  // unpdf sometimes joins numbers: "PontaEnergia ativa em kWh 1 25219041652"
  // where "25219041652" = consumo(252) + leitAtual(1904) + leitAnterior(1652)
  if (leituraAnterior03 == null || leituraAtual03 == null || consumoKwh == null) {
    const concatActiveMatch = flatText.match(/PontaEnergia\s+ativa\s+(?:em\s+)?kWh\s+1\s+(\d{7,})/i);
    if (concatActiveMatch) {
      const split = splitConcatenatedMeterReading(concatActiveMatch[1]);
      if (split) {
        if (leituraAnterior03 == null) { leituraAnterior03 = split.previous; fieldResults['leitura_anterior_03'] = makeField(split.previous, 'regex:ENERGISA_CONCAT_SPLIT', true, `split from ${concatActiveMatch[1]}`); }
        if (leituraAtual03 == null) { leituraAtual03 = split.current; fieldResults['leitura_atual_03'] = makeField(split.current, 'regex:ENERGISA_CONCAT_SPLIT', true); }
        if (consumoKwh == null) { consumoKwh = split.total; fieldResults['consumo_kwh'] = makeField(split.total, 'regex:ENERGISA_CONCAT_SPLIT', true); }
        raw['leitura_03_concat'] = `${concatActiveMatch[1]} → ant=${split.previous} atu=${split.current} cons=${split.total}`;
        confidence += 12;
      }
    }
  }

  if (consumoKwh == null) {
    const consumoTableMatch = flatText.match(/Consumo\s+em\s+kWh\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s+(\d[\d.,]*)/i);
    if (consumoTableMatch) {
      const quantidade = parseNum(consumoTableMatch[1]);
      const tarifa = parseNum(consumoTableMatch[2]);
      const valorLinha = parseNum(consumoTableMatch[3]);
      if (Number.isFinite(quantidade) && quantidade > 1) {
        consumoKwh = quantidade;
        fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:CONSUMO_TABLE_ROW', true, `tarifa=${tarifa}; valor=${valorLinha}`);
        confidence += 15;
      }
    }
  }

  if (consumoKwh == null) {
    const consumoPatterns = [
      /Consumo\s+(?:em\s+)?kWh[:\s]*(\d[\d.,]*)/i,
      /consumo\s*(?:faturado|ativo)?[:\s]*(\d[\d.,]*)\s*(?:,\s*\d+)?\s*kWh/i,
      /consumo\s*(?:ativo|total|mensal)?[:\s]*(\d[\d.,]*)\s*kWh/i,
      /(\d[\d.,]*)\s*kWh\s*(?:consumo|ativo)/i,
    ];
    const fallbackConsumo = firstMatchNum(flatText, consumoPatterns);
    if (fallbackConsumo != null && fallbackConsumo > 1) {
      consumoKwh = fallbackConsumo;
      fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:CONSUMO_KWH_FALLBACK', true);
      confidence += 10;
    }
  }

  let compactSummaryNumbers: number[] | null = null;
  const consumoSuspeito = consumoKwh != null && consumoKwh < 5 && leituraAnterior03 == null && leituraAtual03 == null;
  if (consumoKwh == null || consumoSuspeito) {
    const resumoConsumoMatch = flatText.match(/portalnf3e\s+(\d[\d.,]*)\s+Protocolo\s+de\s+Autoriza[çc][ãa]o/i);
    const resumoConsumo = resumoConsumoMatch ? parseNum(resumoConsumoMatch[1]) : null;
    if (resumoConsumo != null && resumoConsumo >= 5) {
      consumoKwh = resumoConsumo;
      fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:CONSUMO_RESUMO_PORTAL', true, consumoSuspeito ? 'Substituiu captura suspeita do fallback genérico' : null);
      confidence += consumoSuspeito ? 8 : 12;
    }
  }

  if (consumoKwh == null || consumoSuspeito) {
    const compactSummaryMatch = flatText.match(/DIC\s+KWH\s+INJ\s+Ponta\s+Ponta\s+((?:\d+(?:\.\d{3})*,\d{2}\s*){2,12})/i);
    if (compactSummaryMatch) {
      const numbers = extractLocalizedNumberTokens(compactSummaryMatch[1]);
      compactSummaryNumbers = numbers;
      raw['dic_kwh_inj_tokens'] = numbers.join('|');
      const compactConsumo = numbers[0] ?? null;
      if (compactConsumo != null && compactConsumo >= 5) {
        consumoKwh = compactConsumo;
        fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:CONSUMO_DIC_KWH_INJ', true, consumoSuspeito ? 'Substituiu captura suspeita do fallback genérico' : null);
        confidence += consumoSuspeito ? 8 : 12;
      }
      const leituraAtual03Compact = numbers[1] ?? null;
      const leituraAnterior03Compact = numbers[5] ?? null;
      if (
        leituraAtual03Compact != null
        && leituraAnterior03Compact != null
        && leituraAtual03Compact >= leituraAnterior03Compact
        && consumoKwh != null
        && Math.abs((leituraAtual03Compact - leituraAnterior03Compact) - consumoKwh) <= 1
      ) {
        leituraAtual03 = leituraAtual03Compact;
        leituraAnterior03 = leituraAnterior03Compact;
        fieldResults['leitura_atual_03'] = makeField(leituraAtual03, 'regex:DIC_KWH_INJ_COMPACT', true);
        fieldResults['leitura_anterior_03'] = makeField(leituraAnterior03, 'regex:DIC_KWH_INJ_COMPACT', true);
      }
    }
  }

  // Fallback: structured table "KWH Ponta anterior atual K consumo"
  if (leituraAnterior03 == null || leituraAtual03 == null || consumoKwh == null) {
    const structuredTableMatch = flatText.match(/KWH\s+(?:Ponta|Fora\s+de\s+Ponta)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+[\d.,]*)*?\s+([\d.,]+)\s+([\d.,]+)/i);
    if (structuredTableMatch) {
      const atu = parseNum(structuredTableMatch[1]);
      const ant = parseNum(structuredTableMatch[2]);
      const medido = parseNum(structuredTableMatch[4]);
      if (Number.isFinite(atu) && Number.isFinite(ant)) {
        if (leituraAtual03 == null) { leituraAtual03 = atu; fieldResults['leitura_atual_03'] = makeField(atu, 'regex:ESTRUTURA_CONSUMO_TABLE', true); }
        if (leituraAnterior03 == null) { leituraAnterior03 = ant; fieldResults['leitura_anterior_03'] = makeField(ant, 'regex:ESTRUTURA_CONSUMO_TABLE', true); }
        if (consumoKwh == null && Number.isFinite(medido)) {
          consumoKwh = medido;
          fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:ESTRUTURA_CONSUMO_TABLE', true);
          confidence += 10;
        }
      }
    }
  }



  // Fallback leitura patterns
  if (leituraAnterior03 == null || leituraAtual03 == null) {
    const leitPatterns = [
      /(?:energia\s*(?:ativa|el[ée]trica)?\s*(?:consumida)?|registro\s*03).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
      /(?:leitura|medidor).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ];
    for (const p of leitPatterns) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior03 = leituraAnterior03 ?? parseNum(m[1]);
        leituraAtual03 = leituraAtual03 ?? parseNum(m[2]);
        if (leituraAnterior03 != null) fieldResults['leitura_anterior_03'] = makeField(leituraAnterior03, 'regex:LEITURA_FALLBACK', true);
        if (leituraAtual03 != null) fieldResults['leitura_atual_03'] = makeField(leituraAtual03, 'regex:LEITURA_FALLBACK', true);
        confidence += 5;
        break;
      }
    }
  }

  // ── 4. Medidor / Injeção (registro 103) ──


  let leituraAnterior103: number | null = null;
  let leituraAtual103: number | null = null;
  let energiaInjetada: number | null = null;
  let energiaCompensada: number | null = null;

  const injectedMeterRow = extractMeterRow(flatText, 'energia\\s+(?:atv\\s+)?injetada(?:\\s+gdi?)?');
  if (injectedMeterRow) {
    leituraAnterior103 = injectedMeterRow.previous;
    leituraAtual103 = injectedMeterRow.current;
    energiaInjetada = injectedMeterRow.total;
    raw['leitura_103'] = `ant=${injectedMeterRow.previous} atu=${injectedMeterRow.current} inj=${injectedMeterRow.total}`;
    fieldResults['leitura_anterior_103'] = makeField(leituraAnterior103, 'regex:METER_ROW_INJETADA', true);
    fieldResults['leitura_atual_103'] = makeField(leituraAtual103, 'regex:METER_ROW_INJETADA', true);
    fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:METER_ROW_INJETADA', true);
    confidence += 10;
  }

  // ── Energisa fallback: concatenated injection meter readings from unpdf ──
  // e.g. "PontaEnergia injetada 1 1323101158792" = inj(1323) + atu(10115) + ant(8792)
  if (leituraAnterior103 == null || leituraAtual103 == null || energiaInjetada == null) {
    const concatInjMatch = flatText.match(/PontaEnergia\s+injetada\s+1\s+(\d{7,})/i);
    if (concatInjMatch) {
      const split = splitConcatenatedMeterReading(concatInjMatch[1]);
      if (split) {
        if (leituraAnterior103 == null) { leituraAnterior103 = split.previous; fieldResults['leitura_anterior_103'] = makeField(split.previous, 'regex:ENERGISA_CONCAT_SPLIT_103', true, `split from ${concatInjMatch[1]}`); }
        if (leituraAtual103 == null) { leituraAtual103 = split.current; fieldResults['leitura_atual_103'] = makeField(split.current, 'regex:ENERGISA_CONCAT_SPLIT_103', true); }
        if (energiaInjetada == null) { energiaInjetada = split.total; fieldResults['energia_injetada_kwh'] = makeField(split.total, 'regex:ENERGISA_CONCAT_SPLIT_103', true); }
        raw['leitura_103_concat'] = `${concatInjMatch[1]} → ant=${split.previous} atu=${split.current} inj=${split.total}`;
        confidence += 10;
      }
    }
  }

  // Fallback injeção
  if (energiaInjetada == null) {
    const injTableRowMatch = flatText.match(/Energia\s+Atv\s+Injetada\s+GDI\s+(\d[\d.,]*)\s+(\d[\d.,]*)\s+(-?\d[\d.,]*)/i);
    if (injTableRowMatch) {
      const quantidadeInjetada = parseNum(injTableRowMatch[1]);
      const tarifaInjetada = parseNum(injTableRowMatch[2]);
      const valorInjetado = parseNum(injTableRowMatch[3]);
      if (Number.isFinite(quantidadeInjetada) && quantidadeInjetada > 0) {
        energiaInjetada = quantidadeInjetada;
        fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:INJETADA_TABLE_ROW', true, `tarifa=${tarifaInjetada}; valor=${valorInjetado}`);
        confidence += 15;
      }
    }
  }

  if (energiaInjetada == null) {
    const injPatterns = [
      /Energia\s+At[iv]+\s+Injetada\s+GDI?[:\s]*[-]?\s*(\d[\d.,]*)/i,
      /energia\s+(?:atv?\s+)?injetada\s+GDI?[:\s]*[-]?\s*(\d[\d.,]*)/i,
      /energia\s*injetada[:\s]*(\d[\d.,]*)\s*kWh/i,
    ];
    const fallbackInjecao = firstMatchNum(flatText, injPatterns);
    if (fallbackInjecao != null && fallbackInjecao > 0) {
      energiaInjetada = fallbackInjecao;
      fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:ENERGIA_INJETADA_FALLBACK', true);
    }
  }

  if (compactSummaryNumbers && (energiaInjetada == null || leituraAnterior103 == null || leituraAtual103 == null)) {
    const energiaInjetadaCompact = compactSummaryNumbers[2] ?? null;
    const leituraAtual103Compact = compactSummaryNumbers[6] ?? null;
    const leituraAnterior103Compact = compactSummaryNumbers[7] ?? null;
    if (
      energiaInjetadaCompact != null
      && leituraAtual103Compact != null
      && leituraAnterior103Compact != null
      && leituraAtual103Compact >= leituraAnterior103Compact
      && Math.abs((leituraAtual103Compact - leituraAnterior103Compact) - energiaInjetadaCompact) <= 1
    ) {
      energiaInjetada = energiaInjetadaCompact;
      leituraAtual103 = leituraAtual103Compact;
      leituraAnterior103 = leituraAnterior103Compact;
      fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:DIC_KWH_INJ_COMPACT', true);
      fieldResults['leitura_atual_103'] = makeField(leituraAtual103, 'regex:DIC_KWH_INJ_COMPACT', true);
      fieldResults['leitura_anterior_103'] = makeField(leituraAnterior103, 'regex:DIC_KWH_INJ_COMPACT', true);
      confidence += 12;
    }
  }

  // Calculate from meter readings if not found
  if (energiaInjetada == null && leituraAtual103 != null && leituraAnterior103 != null) {
    energiaInjetada = Math.max(leituraAtual103 - leituraAnterior103, 0);
    fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'calc:LEITURA_103_DIFF', true, `${leituraAtual103} - ${leituraAnterior103} = ${energiaInjetada}`);
  }

  // Fallback leitura 103
  if (leituraAnterior103 == null || leituraAtual103 == null) {
    const leit103Patterns = [
      /(?:energia\s*injetada|registro\s*103).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
      /injetada.*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ];
    for (const p of leit103Patterns) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior103 = leituraAnterior103 ?? parseNum(m[1]);
        leituraAtual103 = leituraAtual103 ?? parseNum(m[2]);
        break;
      }
    }
  }

  // Fallback: INJ row for injection from structured table
  if (leituraAnterior103 == null || leituraAtual103 == null || energiaCompensada == null) {
    const injTableMatch = flatText.match(/INJ\s+(?:Ponta|Fora\s+de\s+Ponta)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+([\d.,]+))?/i)
      || flatText.match(/INJ\s+(?:Ponta|Fora\s+de\s+Ponta)\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)(?:\s+[\d.,]*)*?\s+([\d.,]+)(?:\s+([\d.,]+))?/i);
    if (injTableMatch) {
      const atu103 = parseNum(injTableMatch[1]);
      const ant103 = parseNum(injTableMatch[2]);
      const medido103 = parseNum(injTableMatch[4]);
      const compensado103 = injTableMatch[5] ? parseNum(injTableMatch[5]) : null;
      if (Number.isFinite(atu103) && Number.isFinite(ant103)) {
        if (leituraAtual103 == null) { leituraAtual103 = atu103; fieldResults['leitura_atual_103'] = makeField(atu103, 'regex:ESTRUTURA_INJ_TABLE', true); }
        if (leituraAnterior103 == null) { leituraAnterior103 = ant103; fieldResults['leitura_anterior_103'] = makeField(ant103, 'regex:ESTRUTURA_INJ_TABLE', true); }
        if (energiaInjetada == null && Number.isFinite(medido103)) {
          energiaInjetada = medido103;
          fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:ESTRUTURA_INJ_TABLE', true);
          confidence += 10;
        }
        if (energiaCompensada == null && Number.isFinite(compensado103) && compensado103 >= 0) {
          energiaCompensada = compensado103;
          fieldResults['energia_compensada_kwh'] = makeField(energiaCompensada, 'regex:ESTRUTURA_INJ_TABLE', true);
          confidence += 8;
        }
      }
    }
  }

  // Second medidor code for injection (fallback if early detection missed it)
  let medidorInjecaoCodigo: string | null = medidorInjecaoCodigoEarly;
  if (!medidorInjecaoCodigo) {
    const medidorInjMatch = flatText.match(/(?:medidor|registro)\s*(?:103|inje[çc][ãa]o)[:\s]*(\w{4,})/i);
    if (medidorInjMatch) {
      medidorInjecaoCodigo = medidorInjMatch[1];
      fieldResults['medidor_injecao_codigo'] = makeField(medidorInjecaoCodigo, 'regex:MEDIDOR_103', true);
    }
  }

  // ── 4. GD / Créditos ──

  // Saldo Acumulado
  let saldoGdAcumulado: number | null = null;
  const saldoAcumPatterns = [
    /Saldo\s+Acumulado[:\s]*(\d[\d.,]*)/i,
    // Energisa: "Saldo atual de geração: 1.234,56 kWh"
    /Saldo\s+atual\s+(?:de\s+)?gera[çc][ãa]o[:\s]*(\d[\d.,]*)/i,
    // Energisa: "ENERGIA A COMPENSAR  SALDO  1234"
    /ENERGIA\s+A\s+COMPENSAR\s+SALDO\s+(\d[\d.,]*)/i,
    // Energisa: "Saldo Mês Anterior 1.234" or "Saldo mês anterior kWh 1234"
    /Saldo\s+(?:do\s+)?M[eê]s\s+Anterior[:\s]*(?:kWh\s*)?(\d[\d.,]*)/i,
    // Energisa compact: "Saldo Anterior 1.234,56"
    /Saldo\s+Anterior[:\s]*(\d[\d.,]*)/i,
    /total\s*(?:de\s*)?cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
    /cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
    // Energisa: "Saldo Geração 1234"
    /Saldo\s+(?:de\s+)?Gera[çc][ãa]o[:\s]*(\d[\d.,]*)/i,
  ];
  saldoGdAcumulado = firstMatchNum(flatText, saldoAcumPatterns);
  if (saldoGdAcumulado != null) {
    raw['saldo_acumulado'] = String(saldoGdAcumulado);
    fieldResults['saldo_gd_acumulado'] = makeField(saldoGdAcumulado, 'regex:SALDO_ACUMULADO', true);
    confidence += 10;
  }

  // Saldo GD mensal
  let saldoGd: number | null = null;
  const saldoPatterns = [
    /saldo\s*(?:de\s*)?(?:gera[çc][ãa]o|GD|cr[ée]ditos?\s*(?:de\s*)?energia)[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*kWh/i,
    /cr[ée]ditos?\s*(?:de\s*)?energia[:\s]*(\d[\d.,]*)\s*kWh/i,
  ];
  saldoGd = firstMatchNum(flatText, saldoPatterns);
  if (saldoGd != null) {
    fieldResults['saldo_gd'] = makeField(saldoGd, 'regex:SALDO_GD', true);
  }

  // Energia compensada — expanded patterns for Energisa
  if (energiaCompensada == null) {
    const compensadaItemMatch = flatText.match(/Energia\s+Atv\s+Injetada\s+GDI\s+(\d[\d.,]*)\s+\d[\d.,]*\s+-?\d[\d.,]*/i);
    if (compensadaItemMatch) {
      const compensadaItem = parseNum(compensadaItemMatch[1]);
      if (Number.isFinite(compensadaItem) && compensadaItem >= 0) {
        energiaCompensada = compensadaItem;
        fieldResults['energia_compensada_kwh'] = makeField(energiaCompensada, 'regex:ENERGISA_ITEM_INJETADA', true);
        confidence += 6;
      }
    }
  }

  if (energiaCompensada == null) {
    const compPatterns = [
      // Energisa: "En Comp s/ICMS GDI 182,00" or "En Comp c/ICMS GDII 150,00"
      /En\s+Comp\s+[sc]\/ICMS\s+GDI{0,3}\s+(\d[\d.,]*)/i,
      // Energisa: "Energia Compensada GD I 182,00" or "Energia Compensada GDII 150"
      /Energia\s+Compensada\s+GD\s*I{0,3}\s+(\d[\d.,]*)/i,
      // Energisa: "ENERGIA A COMPENSAR kWh 182,00"
      /ENERGIA\s+A\s+COMPENSAR\s*(?:kWh)?\s*(\d[\d.,]*)/i,
      // Generic patterns
      /energia\s*compensada[:\s]*(?:-?\s*)?(\d[\d.,]*)/i,
      /compensa[çc][ãa]o\s*(?:de\s*)?energia[:\s]*(\d[\d.,]*)/i,
      // Energisa item row: "Energia Compensada GDI  182,00  0,72  -131,04"
      /Energia\s+Compensada\s+GDI?\s+(\d[\d.,]*)\s+\d[\d.,]*\s+-?\d[\d.,]*/i,
    ];
    energiaCompensada = firstMatchNum(flatText, compPatterns);
  }
  if (energiaCompensada != null && !fieldResults['energia_compensada_kwh']) {
    fieldResults['energia_compensada_kwh'] = makeField(energiaCompensada, 'regex:COMPENSADA', true);
  }

  // ── Fallback: calcular energia compensada a partir do custo de disponibilidade ──
  // Em contas Energisa DANF3E, o texto do item "En Comp s/ICMS" frequentemente fica
  // ilegível na extração nativa. Quando temos consumo, injeção e tipo de ligação,
  // compensada = consumo - custo_disponibilidade (30/50/100 kWh por tipo).
  if (energiaCompensada == null && consumoKwh != null && consumoKwh > 0) {
    // Determinar tipo de ligação sem depender da variável declarada mais abaixo
    let tipoLigacaoPreview: string | null = null;
    const tipoLigacaoDetectado = fieldResults['tipo_ligacao']?.value;
    if (typeof tipoLigacaoDetectado === 'string' && tipoLigacaoDetectado.length > 0) {
      tipoLigacaoPreview = tipoLigacaoDetectado;
    }

    if (!tipoLigacaoPreview) {
      if (/trif[áa]sic/i.test(flatText)) tipoLigacaoPreview = 'trifasico';
      else if (/bif[áa]sic/i.test(flatText)) tipoLigacaoPreview = 'bifasico';
      else if (/monof[áa]sic/i.test(flatText)) tipoLigacaoPreview = 'monofasico';
    }

    if (tipoLigacaoPreview && energiaInjetada != null && energiaInjetada > 0) {
      const custoDisp = tipoLigacaoPreview === 'monofasico' ? 30
        : tipoLigacaoPreview === 'bifasico' ? 50
        : tipoLigacaoPreview === 'trifasico' ? 100
        : null;
      if (custoDisp != null && consumoKwh > custoDisp) {
        energiaCompensada = consumoKwh - custoDisp;
        fieldResults['energia_compensada_kwh'] = makeField(
          energiaCompensada,
          'calc:CONSUMO_MINUS_CUSTO_DISP',
          true,
          `${consumoKwh} - ${custoDisp} (${tipoLigacaoPreview}) = ${energiaCompensada}`
        );
        confidence += 4;
      }
    }
  }

  // Categoria GD
  let categoriaGd: string | null = null;
  const gdMatch = flatText.match(/GD[\s_-]*(I{1,3}|1|2|3)\b/i);
  if (gdMatch) {
    const num = gdMatch[1]?.toUpperCase();
    if (num === 'I' || num === '1') categoriaGd = 'GD_I';
    else if (num === 'II' || num === '2') categoriaGd = 'GD_II';
    else if (num === 'III' || num === '3') categoriaGd = 'GD_III';
    raw['gd'] = gdMatch[0];
    fieldResults['categoria_gd'] = makeField(categoriaGd, 'regex:GD_CLASSIFICACAO', true);
  }

  // ── 5. Configuração Técnica ──

  // Tipo de Ligação
  let tipoLigacao: string | null = null;
  const ligacaoMatch = flatText.match(/LIGA[ÇC][ÃA]O[:\s]*(MONOF[ÁA]SIC[AO]|BIF[ÁA]SIC[AO]|TRIF[ÁA]SIC[AO])/i);
  if (ligacaoMatch) {
    const val = ligacaoMatch[1].toLowerCase();
    if (val.includes('mono')) tipoLigacao = 'monofasico';
    else if (val.includes('bi')) tipoLigacao = 'bifasico';
    else if (val.includes('tri')) tipoLigacao = 'trifasico';
    fieldResults['tipo_ligacao'] = makeField(tipoLigacao, 'regex:LIGACAO', true);
    confidence += 5;
  } else {
    if (/trif[áa]sic/i.test(flatText)) tipoLigacao = 'trifasico';
    else if (/bif[áa]sic/i.test(flatText)) tipoLigacao = 'bifasico';
    else if (/monof[áa]sic/i.test(flatText)) tipoLigacao = 'monofasico';
    if (tipoLigacao) {
      fieldResults['tipo_ligacao'] = makeField(tipoLigacao, 'regex:TIPO_LIGACAO_GENERICO', true);
      confidence += 3;
    }
  }

  // Nº UC
  let numeroUc: string | null = null;
  const ucPatterns = [
    /C[ÓO]DIGO\s+DA\s+INSTALA[ÇC][ÃA]O[:\s]*([\d\/-]{5,20})/i,
    /C[ÓO]DIGO\s+DO\s+CLIENTE[:\s]*([\d\/-]{5,20})/i,
    /utilize\s+o\s+c[óo]digo[:\s]*([\d\/-]{6,20})/i,
    /\b(\d+\/\d{6,}-\d)\b/,
    /\b(\d{6,}-\d)\b/,
  ];
  const ucRaw = firstMatch(flatText, ucPatterns);
  if (ucRaw) {
    numeroUc = normalizeUcCode(ucRaw);
    raw['uc'] = ucRaw;
    fieldResults['numero_uc'] = makeField(numeroUc, 'regex:CODIGO_INSTALACAO', true);
    confidence += 10;
  }

  // Classe consumo
  let classe: string | null = null;
  if (/residencial/i.test(flatText)) classe = 'Residencial';
  else if (/comercial/i.test(flatText)) classe = 'Comercial';
  else if (/industrial/i.test(flatText)) classe = 'Industrial';
  else if (/rural/i.test(flatText)) classe = 'Rural';
  if (classe) fieldResults['classe_consumo'] = makeField(classe, 'regex:CLASSE', true);

  // Bandeira tarifária
  let bandeira: string | null = null;
  const bandeiraPatterns = [
    /bandeira\s*(verde|amarela|vermelha(?:\s*patamar\s*\d)?)/i,
    /band(?:eira)?[\s.:]*\s*(verde|amarela|vermelha)/i,
    /(verde|amarela|vermelha)\s*(?:patamar\s*\d)?\s*(?:bandeira|band\.?)/i,
  ];
  for (const p of bandeiraPatterns) {
    const m = flatText.match(p);
    if (m) {
      bandeira = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
      fieldResults['bandeira_tarifaria'] = makeField(bandeira, 'regex:BANDEIRA', true);
      break;
    }
  }

  // ── 6. Tarifas e Tributos ──

  let tarifaEnergia: number | null = null;
  let tarifaFioB: number | null = null;
  const energisaTariffTokens = Array.from(new Set(
    (flatText.match(/\b\d,\d{6}\b/g) ?? [])
      .map((token) => parseNum(token))
      .filter((value) => Number.isFinite(value) && value > 0.1 && value < 2)
      .map((value) => Number(value.toFixed(6)))
  )).sort((a, b) => a - b);

  if (energisaTariffTokens.length >= 2) {
    tarifaFioB = energisaTariffTokens[0];
    tarifaEnergia = energisaTariffTokens[energisaTariffTokens.length - 1];
    shouldSwapTariffs = false;
    raw['energisa_tarifas'] = energisaTariffTokens.join('|');
    fieldResults['tarifa_fio_b_kwh'] = makeField(tarifaFioB, 'regex:ENERGISA_TARIFAS_6_DECIMAIS', true);
    fieldResults['tarifa_energia_kwh'] = makeField(tarifaEnergia, 'regex:ENERGISA_TARIFAS_6_DECIMAIS', true);
    confidence += 10;
  }

  const tePatterns = [
    /tarifa\s*(?:de\s*)?energia\s*(?:TE)?[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /TE\s*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /energia\s*(?:ativa\s*)?(?:fornecida|consumida).*?kWh\s+[\d.,]+\s+(0[,.][\d]+)/i,
  ];
  for (const p of tePatterns) {
    const m = flatText.match(p);
    if (m && tarifaEnergia == null) {
      const val = parseNum(m[1]);
      if (val > 0.05 && val < 3.0) {
        tarifaEnergia = val;
        fieldResults['tarifa_energia_kwh'] = makeField(tarifaEnergia, 'regex:TE', true);
        confidence += 10;
        break;
      }
    }
  }

  const tusdPatterns = [
    /TUSD[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /uso\s*(?:do\s*)?sistema\s*(?:de\s*)?distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /fio\s*B[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
  ];
  for (const p of tusdPatterns) {
    const m = flatText.match(p);
    if (m && tarifaFioB == null) {
      const val = parseNum(m[1]);
      if (val > 0.01 && val < 2.0) {
        tarifaFioB = val;
        fieldResults['tarifa_fio_b_kwh'] = makeField(tarifaFioB, 'regex:TUSD', true);
        confidence += 5;
        break;
      }
    }
  }

  // ICMS
  let icms: number | null = null;
  const tributosResumoMatch = flatText.match(/PIS\/\s*COFINS\s*\(R\$\)\s*(\d[\d.,]*)\s*(\d[\d.,]*)\s*(\d[\d.,]*)\s*(\d[\d.,]*)\s*(\d[\d.,]*)\s*(\d[\d.,]*)\s*TOTAL:\s*(\d[\d.,]*)/i);
  let pis: number | null = null;
  let cofins: number | null = null;

  if (tributosResumoMatch) {
    const pisValue = parseNum(tributosResumoMatch[1]);
    const cofinsValue = parseNum(tributosResumoMatch[2]);
    const icmsAliquota = parseNum(tributosResumoMatch[6]);

    raw['tributos_resumo'] = [
      tributosResumoMatch[1], tributosResumoMatch[2], tributosResumoMatch[3], tributosResumoMatch[4], tributosResumoMatch[5], tributosResumoMatch[6], tributosResumoMatch[7],
    ].join('|');

    if (Number.isFinite(pisValue)) {
      pis = pisValue;
      fieldResults['pis_valor'] = makeField(pis, 'regex:TRIBUTOS_RESUMO', true);
    }
    if (Number.isFinite(cofinsValue)) {
      cofins = cofinsValue;
      fieldResults['cofins_valor'] = makeField(cofins, 'regex:TRIBUTOS_RESUMO', true);
    }
    if (Number.isFinite(icmsAliquota)) {
      icms = icmsAliquota;
      fieldResults['icms_percentual'] = makeField(icms, 'regex:TRIBUTOS_RESUMO', true);
    }
    confidence += 10;
  }

  // ── Energisa tributo fallback: garbled table from unpdf ──
  // In garbled Energisa PDFs: "PIS ICMS COFINS 18 18 0 ... 0,09 0,40 ... 7,02 7,02 8,56 1,54"
  if (icms == null || pis == null || cofins == null) {
    // Direct PIS/COFINS values: small decimals like 0,09 and 0,40
    if (pis == null) {
      const pisDirectMatch = flatText.match(/\bPIS\b[^]*?(\d,\d{2,5})\s+(\d,\d{2,5})\s+(\d{1,2},\d{2,5})\s+(\d[\d.,]+)\s+(\d[\d.,]+)\s+(\d[\d.,]+)\s+(\d[\d.,]+)/i);
      if (pisDirectMatch) {
        const p1 = parseNum(pisDirectMatch[1]);
        const p2 = parseNum(pisDirectMatch[2]);
        // p1=PIS value, p2=COFINS value (small R$ amounts)
        if (Number.isFinite(p1) && p1 < 10 && pis == null) { pis = p1; fieldResults['pis_valor'] = makeField(pis, 'regex:ENERGISA_TRIBUTO_GARBLED', true); }
        if (Number.isFinite(p2) && p2 < 10 && cofins == null) { cofins = p2; fieldResults['cofins_valor'] = makeField(cofins, 'regex:ENERGISA_TRIBUTO_GARBLED', true); }
      }
    }

    // ICMS: look for pattern "ICMS base aliq valor" or "18,00 base valor"
    if (icms == null) {
      const icmsValMatch = flatText.match(/ICMS\s+([\d.,]+)\s+([\d.,]+)\s+([\d.,]+)/i);
      if (icmsValMatch) {
        const v1 = parseNum(icmsValMatch[1]);
        const v2 = parseNum(icmsValMatch[2]);
        const v3 = parseNum(icmsValMatch[3]);
        // Detect which is the aliquota (should be 12-35%)
        if (v2 > 5 && v2 <= 35) {
          icms = v2;
          fieldResults['icms_percentual'] = makeField(icms, 'regex:ENERGISA_ICMS_GARBLED', true, `base=R$${v1}, aliq=${v2}%, valor=R$${v3}`);
          raw['icms_valor'] = String(v3);
        } else if (v1 > 5 && v1 <= 35) {
          icms = v1;
          fieldResults['icms_percentual'] = makeField(icms, 'regex:ENERGISA_ICMS_GARBLED', true);
        }
      }
    }
  }

  // ── Energisa line-table fallback: preserve row structure from OCR/layout parsers ──
  if (icms == null) {
    const energisaTableLinePatterns = [
      /Consumo\s+em\s+kWh[^\n]*?\b(\d{1,2}(?:[,.]\d+)?)\b\s+(\d[\d.,]*)\s*$/im,
      /Energia\s+Atv\s+Injetada[^\n]*?\b(\d{1,2}(?:[,.]\d+)?)\b\s+[-−]?(\d[\d.,]*)\s*$/im,
      /Subs[ií]dio\s+SCEE[^\n]*?\b(\d{1,2}(?:[,.]\d+)?)\b\s+(\d[\d.,]*)\s*$/im,
    ];

    for (const pattern of energisaTableLinePatterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const aliquota = parseNum(match[1]);
      const valor = parseNum(match[2]);
      if (Number.isFinite(aliquota) && aliquota > 0 && aliquota <= 35) {
        icms = aliquota;
        fieldResults['icms_percentual'] = makeField(icms, 'regex:ENERGISA_ICMS_TABLE_ROW', true, `valor=R$${valor}`);
        if (Number.isFinite(valor)) {
          raw['icms_valor'] = String(valor);
        }
        break;
      }
    }
  }

  const icmsPatterns = [
    /ICMS[:\s]*(\d[\d.,]*)\s*%/i,
    /al[ií]quota\s*ICMS[:\s]*(\d[\d.,]*)/i,
    /ICMS\s+(\d{1,2}(?:[,.]\d+)?)\s*%/i,
  ];
  for (const p of icmsPatterns) {
    const m = flatText.match(p);
    if (m && icms == null) { icms = parseFloat(m[1].replace(',', '.')); fieldResults['icms_percentual'] = makeField(icms, 'regex:ICMS', true); break; }
  }

  // PIS
  const pisMatch = flatText.match(/PIS[\/\s]*(?:PASEP)?[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (pisMatch && pis == null) { pis = parseNum(pisMatch[1]); fieldResults['pis_valor'] = makeField(pis, 'regex:PIS', true); }

  // COFINS
  const cofinsMatch = flatText.match(/COFINS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (cofinsMatch && cofins == null) { cofins = parseNum(cofinsMatch[1]); fieldResults['cofins_valor'] = makeField(cofins, 'regex:COFINS', true); }

  // ── 7. Demanda (Grupo A) ──

  let demandaContratada: number | null = null;
  const demandaCMatch = flatText.match(/demanda\s*contratada[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demandaCMatch) {
    demandaContratada = parseNum(demandaCMatch[1]);
    fieldResults['demanda_contratada_kw'] = makeField(demandaContratada, 'regex:DEMANDA_CONTRATADA', true);
  }

  let demandaMedida: number | null = null;
  const demandaMMatch = flatText.match(/demanda\s*medida[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demandaMMatch) {
    demandaMedida = parseNum(demandaMMatch[1]);
    fieldResults['demanda_medida_kw'] = makeField(demandaMedida, 'regex:DEMANDA_MEDIDA', true);
  }

  let demandaUltrapassagem: number | null = null;
  const demandaUMatch = flatText.match(/ultrapassagem[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demandaUMatch) {
    demandaUltrapassagem = parseNum(demandaUMatch[1]);
    fieldResults['demanda_ultrapassagem_kw'] = makeField(demandaUltrapassagem, 'regex:ULTRAPASSAGEM', true);
  }

  let multaDemanda: number | null = null;
  const multaMatch = flatText.match(/multa\s*(?:de\s*)?(?:demanda|ultrapassagem)[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (multaMatch) {
    multaDemanda = parseNum(multaMatch[1]);
    fieldResults['multa_demanda_valor'] = makeField(multaDemanda, 'regex:MULTA_DEMANDA', true);
  }

  // Modalidade tarifária
  let modalidade: string | null = null;
  const modPatterns = [
    /modalidade\s*(?:tarif[aá]ria)?\s*[:=]?\s*(convencional|hora[- ]?sazonal\s*(?:verde|azul)|branca)/i,
    /tarifa[çc][ãa]o\s*[:=]?\s*(convencional|hora[- ]?sazonal\s*(?:verde|azul)|branca)/i,
  ];
  const modRaw = firstMatch(flatText, modPatterns);
  if (modRaw) {
    const v = modRaw.toLowerCase();
    if (v.includes('convencional')) modalidade = 'Convencional';
    else if (v.includes('branca') || v.includes('branco')) modalidade = 'Branca';
    else if (v.includes('verde')) modalidade = 'Horosazonal Verde';
    else if (v.includes('azul')) modalidade = 'Horosazonal Azul';
    fieldResults['modalidade_tarifaria'] = makeField(modalidade, 'regex:MODALIDADE', true);
  }

  // Estado
  let estado: string | null = null;
  const ufMatch = flatText.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) estado = ufMatch[1];

  // Cidade — Energisa: "Cataguases / MG" ou "Cidade - UF"
  let cidade: string | null = null;
  const cidadePatterns = [
    /(?:cidade|munic[íi]pio)[:\s]*([A-Za-zÀ-ú\s]+?)(?:\s*[-\/]\s*[A-Z]{2}|\n)/i,
    /([A-Za-zÀ-ú\s]{3,30})\s*\/\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s*[-–]\s*CEP/i,
    /([A-Za-zÀ-ú\s]{3,30})\s*[-–]\s*(?:AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\s*[-–]?\s*CEP/i,
  ];
  for (const p of cidadePatterns) {
    const m = flatText.match(p);
    if (m) {
      cidade = m[1].trim();
      fieldResults['cidade'] = makeField(cidade, 'regex:CIDADE', true);
      break;
    }
  }

  // ── VALIDAÇÕES CRUZADAS ──

  // Validação 1: Leitura consumo
  if (leituraAnterior03 != null && leituraAtual03 != null && consumoKwh != null) {
    const diff = leituraAtual03 - leituraAnterior03;
    const passed = Math.abs(diff - consumoKwh) <= 1;
    validations.push({
      rule: 'consumo_vs_leitura_03',
      passed,
      detail: `Leitura(${leituraAtual03}-${leituraAnterior03}=${diff}) ${passed ? '==' : '≠'} Consumo(${consumoKwh})`,
    });
    if (!passed) {
      raw['validation_warning_consumo'] = `Divergência: ${diff} ≠ ${consumoKwh}`;
    }
  }

  // Validação 2: Leitura injeção
  if (leituraAnterior103 != null && leituraAtual103 != null && energiaInjetada != null) {
    const diff = leituraAtual103 - leituraAnterior103;
    const passed = Math.abs(diff - energiaInjetada) <= 1;
    validations.push({
      rule: 'injecao_vs_leitura_103',
      passed,
      detail: `Leitura(${leituraAtual103}-${leituraAnterior103}=${diff}) ${passed ? '==' : '≠'} Injeção(${energiaInjetada})`,
    });
  }

  // Validação 3: Vencimento é data válida
  if (vencimento) {
    validations.push({ rule: 'vencimento_valido', passed: isPlausibleDate(vencimento), detail: vencimento });
  }

  // Validação 4: UC padrão esperado (6+ dígitos)
  if (numeroUc) {
    const ucValid = /^\d{5,}/.test(numeroUc.replace(/[\/\-]/g, ''));
    validations.push({ rule: 'uc_formato_valido', passed: ucValid, detail: numeroUc });
  }

  // Validação 5: Valor total > 0
  if (valorTotal != null) {
    validations.push({ rule: 'valor_total_positivo', passed: valorTotal > 0, detail: `R$ ${valorTotal}` });
  }

  confidence = Math.min(confidence, 100);

  // Require at least UC or valor or consumo
  if (!numeroUc && valorTotal == null && consumoKwh == null) {
    console.warn("[parse-conta-energia] Energisa detected but extraction too sparse — falling back to generic");
    return null;
  }

  // Heuristic: swap TE/TUSD if inverted
  if (shouldSwapTariffs && tarifaEnergia != null && tarifaFioB != null && tarifaEnergia > tarifaFioB && tarifaEnergia > 0.5 && tarifaFioB > 0.05) {
    const tmp = tarifaEnergia;
    tarifaEnergia = tarifaFioB;
    tarifaFioB = tmp;
    raw['tariff_swap_applied'] = `TE↔TUSD`;
    fieldResults['tarifa_energia_kwh'] = makeField(tarifaEnergia, 'regex:TE (swapped)', true, 'TE/TUSD invertidos e corrigidos');
    fieldResults['tarifa_fio_b_kwh'] = makeField(tarifaFioB, 'regex:TUSD (swapped)', true, 'TE/TUSD invertidos e corrigidos');
  }

  return {
    concessionaria_nome: "Energisa",
    cliente_nome: clienteNome,
    endereco,
    cidade,
    estado,
    consumo_kwh: consumoKwh,
    tarifa_energia_kwh: tarifaEnergia,
    tarifa_fio_b_kwh: tarifaFioB,
    valor_total: valorTotal,
    icms_percentual: icms,
    pis_valor: pis,
    cofins_valor: cofins,
    bandeira_tarifaria: bandeira,
    classe_consumo: classe,
    tipo_ligacao: tipoLigacao,
    mes_referencia: mesRef,
    demanda_contratada_kw: demandaContratada,
    numero_uc: numeroUc,
    vencimento,
    proxima_leitura_data: resolvedProximaLeitura,
    data_leitura_anterior: dataLeituraAnterior,
    data_leitura_atual: dataLeituraAtual,
    dias_leitura: diasLeitura,
    saldo_gd: saldoGd,
    saldo_gd_acumulado: saldoGdAcumulado,
    leitura_anterior_03: leituraAnterior03,
    leitura_atual_03: leituraAtual03,
    leitura_anterior_103: leituraAnterior103,
    leitura_atual_103: leituraAtual103,
    medidor_consumo_codigo: medidorConsumoCodigo,
    medidor_injecao_codigo: medidorInjecaoCodigo,
    energia_injetada_kwh: energiaInjetada,
    energia_compensada_kwh: energiaCompensada,
    categoria_gd: categoriaGd,
    modalidade_tarifaria: modalidade,
    demanda_medida_kw: demandaMedida,
    demanda_ultrapassagem_kw: demandaUltrapassagem,
    multa_demanda_valor: multaDemanda,
    numero_nota_fiscal: numeroNotaFiscal,
    confidence,
    ai_fallback_used: false,
    ai_model_used: null,
    parser_version: PARSER_VERSION,
    parser_used: "energisa",
    extraction_method: "deterministic",
    field_results: fieldResults,
    validations,
    raw_fields: raw,
  };
}

// ══════════════════════════════════════════════════════════════════════════════
// GENERIC PARSER — Regex fallback for unknown concessionárias
// ══════════════════════════════════════════════════════════════════════════════

function extractFromText(text: string): ExtractedData {
  const raw: Record<string, string> = {};
  const fieldResults: Record<string, FieldResult> = {};
  const validations: ValidationResult[] = [];
  let confidence = 0;
  const flatText = text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();

  let concNome: string | null = null;
  for (const { pattern, nome } of CONC_PATTERNS) {
    if (pattern.test(text)) {
      concNome = nome;
      confidence += 15;
      break;
    }
  }

  const activeMeterRow = extractMeterRow(flatText, 'energia\\s+ativa(?:\\s+em\\s+kwh)?');
  const injectedMeterRow = extractMeterRow(flatText, 'energia\\s+(?:atv\\s+)?injetada(?:\\s+gdi)?');

  let leituraAnterior03: number | null = activeMeterRow?.previous ?? null;
  let leituraAtual03: number | null = activeMeterRow?.current ?? null;
  let leituraAnterior103: number | null = injectedMeterRow?.previous ?? null;
  let leituraAtual103: number | null = injectedMeterRow?.current ?? null;

  if (activeMeterRow) { confidence += 15; }
  if (injectedMeterRow) { confidence += 15; }

  let consumo: number | null = activeMeterRow?.total ?? null;
  if (consumo == null) {
    const consumoPatterns = [
      /consumo\s*(?:ativo|total|mensal)?[:\s]*(\d[\d.,]*)\s*kWh/i,
      /consumo\s*em\s*kwh[:\s]*(\d[\d.,]*)/i,
      /(\d[\d.,]*)\s*kWh\s*(?:consumo|ativo)/i,
      /energia\s*el[ée]trica\s*kWh\s*(\d[\d.,]*)/i,
    ];
    consumo = firstMatchNum(flatText, consumoPatterns);
    if (consumo != null) confidence += 10;
  }

  let tarifaEnergia: number | null = null;
  const tePatterns = [
    /tarifa\s*(?:de\s*)?energia\s*(?:TE)?[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /TE\s*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /energia\s*(?:ativa\s*)?(?:fornecida|consumida).*?kWh\s+[\d.,]+\s+(0[,.][\d]+)/i,
    /tarifa\s*convencional[:\s]*R?\$?\s*(\d[\d.,]*)/i,
  ];
  for (const p of tePatterns) {
    const m = flatText.match(p);
    if (m) {
      const val = parseNum(m[1]);
      if (val > 0.05 && val < 3.0) { tarifaEnergia = val; confidence += 15; break; }
    }
  }

  let tarifaFioB: number | null = null;
  const tusdPatterns = [
    /TUSD[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /uso\s*(?:do\s*)?sistema\s*(?:de\s*)?distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /fio\s*B[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
  ];
  for (const p of tusdPatterns) {
    const m = flatText.match(p);
    if (m) {
      const val = parseNum(m[1]);
      if (val > 0.01 && val < 2.0) { tarifaFioB = val; confidence += 10; break; }
    }
  }

  let valorTotal: number | null = null;
  let vencimento: string | null = null;
  const resumoMatch = flatText.match(/total\s+a\s+pagar\s+(?:[A-Za-zÀ-ú]+\s*\/\s*\d{4}\s+)?(\d{2}[\/.]\d{2}[\/.]\d{2,4})\s+R\$\s*(\d[\d.,]*)/i);
  if (resumoMatch) {
    vencimento = normalizeDateLike(resumoMatch[1]);
    valorTotal = parseNum(resumoMatch[2]);
    confidence += 15;
  }

  if (valorTotal === null) {
    const valPatterns = [
      /\(=\)\s*valor\s*do\s*documento[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /valor\s*(?:total|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /total\s*(?:da\s*fatura|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    ];
    valorTotal = firstMatchNum(flatText, valPatterns);
    if (valorTotal != null) confidence += 10;
  }

  if (!vencimento) {
    vencimento = firstMatchDate(flatText, [
      /\bvencimento\b[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
      /data\s*(?:de\s*)?vencimento[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    ]);
    if (vencimento) confidence += 5;
  }

  let icms: number | null = null;
  for (const p of [/ICMS[:\s]*(\d[\d.,]*)\s*%/i, /ICMS\s+(\d{1,2}(?:[,.]\d+)?)\s*%/i]) {
    const m = flatText.match(p);
    if (m) { icms = parseFloat(m[1].replace(',', '.')); confidence += 5; break; }
  }

  let pis: number | null = firstMatchNum(flatText, [/PIS[\/\s]*(?:PASEP)?[:\s]*R?\$?\s*(\d[\d.,]*)/i]);
  let cofins: number | null = firstMatchNum(flatText, [/COFINS[:\s]*R?\$?\s*(\d[\d.,]*)/i]);

  let bandeira: string | null = null;
  const bMatch = flatText.match(/bandeira\s*(verde|amarela|vermelha(?:\s*patamar\s*\d)?)/i);
  if (bMatch) bandeira = bMatch[1];

  let tipoLigacao: string | null = null;
  if (/trif[áa]sic/i.test(flatText)) tipoLigacao = 'trifasico';
  else if (/bif[áa]sic/i.test(flatText)) tipoLigacao = 'bifasico';
  else if (/monof[áa]sic/i.test(flatText)) tipoLigacao = 'monofasico';

  let classe: string | null = null;
  if (/residencial/i.test(flatText)) classe = 'Residencial';
  else if (/comercial/i.test(flatText)) classe = 'Comercial';
  else if (/industrial/i.test(flatText)) classe = 'Industrial';
  else if (/rural/i.test(flatText)) classe = 'Rural';

  let mesRef: string | null = null;
  const mesMatch = flatText.match(/(?:m[êe]s\s*(?:de\s*)?refer[êe]ncia|refer[êe]ncia|ref[:\s]*mes\/ano)[:\s]*((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\w\s\/]*\d{2,4}|\d{2}\/\d{4}|[A-Za-zÀ-ú]+\s*\/\s*\d{4})/i);
  if (mesMatch) mesRef = mesMatch[1].trim();

  let demanda: number | null = null;
  const demMatch = flatText.match(/demanda\s*contratada[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demMatch) demanda = parseNum(demMatch[1]);

  let estado: string | null = null;
  const ufMatch = flatText.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) estado = ufMatch[1];

  let cidade: string | null = null;
  const cidMatch = flatText.match(/(?:cidade|munic[íi]pio)[:\s]*([A-Za-zÀ-ú\s]+?)(?:\s*[-\/]\s*[A-Z]{2}|\n)/i);
  if (cidMatch) cidade = cidMatch[1].trim();

  let numeroUc: string | null = null;
  const ucRaw = firstMatch(flatText, [
    /utilize\s+o\s+c[óo]digo[:\s]*([\d\/-]{6,20})/i,
    /c[óo]digo\s+do\s+cliente[:\s]*([\d\/-]{6,20})/i,
    /c[óo]digo\s+da\s+instala[çc][ãa]o[:\s]*([\d\/-]{6,20})/i,
    /\b(\d+\/\d{6,}-\d)\b/,
    /\b(\d{6,}-\d)\b/,
  ]);
  if (ucRaw) { numeroUc = normalizeUcCode(ucRaw); confidence += 8; }

  const proximaLeitura = firstMatchDate(flatText, [
    /pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /data\s*(?:da\s*)?pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /previs[ãa]o\s*(?:da\s*)?(?:pr[óo]x(?:ima)?\s*)?leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /leitura\s*seguinte[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
  ]);

  let saldoGd: number | null = firstMatchNum(flatText, [
    /saldo\s*(?:de\s*)?(?:gera[çc][ãa]o|GD|cr[ée]ditos?\s*(?:de\s*)?energia)[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*kWh/i,
  ]);
  let saldoGdAcumulado: number | null = firstMatchNum(flatText, [
    /saldo\s*acumulado[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*(?:kWh)?/i,
    /cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
  ]);

  if (leituraAnterior03 == null || leituraAtual03 == null) {
    for (const p of [
      /(?:energia\s*(?:ativa|el[ée]trica)?\s*(?:consumida)?|registro\s*03).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
      /(?:leitura|medidor).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior03 = leituraAnterior03 ?? parseNum(m[1]);
        leituraAtual03 = leituraAtual03 ?? parseNum(m[2]);
        break;
      }
    }
  }

  if (leituraAnterior103 == null || leituraAtual103 == null) {
    for (const p of [
      /(?:energia\s*injetada|registro\s*103).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior103 = leituraAnterior103 ?? parseNum(m[1]);
        leituraAtual103 = leituraAtual103 ?? parseNum(m[2]);
        break;
      }
    }
  }

  let energiaInjetada: number | null = injectedMeterRow?.total ?? null;
  if (energiaInjetada === null) {
    energiaInjetada = firstMatchNum(flatText, [
      /energia\s*injetada[:\s]*(\d[\d.,]*)\s*kWh/i,
      /inje[çc][ãa]o[:\s]*(\d[\d.,]*)\s*kWh/i,
    ]);
  }
  if (energiaInjetada === null && leituraAtual103 != null && leituraAnterior103 != null) {
    energiaInjetada = Math.max(leituraAtual103 - leituraAnterior103, 0);
  }

  let energiaCompensada: number | null = firstMatchNum(flatText, [
    /energia\s*compensada[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*kWh/i,
    /compensa[çc][ãa]o\s*(?:de\s*)?energia[:\s]*(\d[\d.,]*)/i,
  ]);

  let categoriaGd: string | null = null;
  const gdMatch = flatText.match(/GD[\s_-]*(I{1,3}|1|2|3)\b/i);
  if (gdMatch) {
    const num = gdMatch[1]?.toUpperCase();
    if (num === 'I' || num === '1') categoriaGd = 'GD_I';
    else if (num === 'II' || num === '2') categoriaGd = 'GD_II';
    else if (num === 'III' || num === '3') categoriaGd = 'GD_III';
  }

  let modalidade: string | null = null;
  const modMatch = flatText.match(/modalidade\s*(?:tarif[aá]ria)?\s*[:=]?\s*(convencional|hora[- ]?sazonal\s*(?:verde|azul)|branca)/i);
  if (modMatch) {
    const v = modMatch[1].toLowerCase();
    if (v.includes('convencional')) modalidade = 'Convencional';
    else if (v.includes('branca') || v.includes('branco')) modalidade = 'Branca';
    else if (v.includes('verde')) modalidade = 'Horosazonal Verde';
    else if (v.includes('azul')) modalidade = 'Horosazonal Azul';
  }

  // Heuristic: swap TE/TUSD if inverted
  if (tarifaEnergia != null && tarifaFioB != null && tarifaEnergia > tarifaFioB && tarifaEnergia > 0.5 && tarifaFioB > 0.05) {
    const tmp = tarifaEnergia; tarifaEnergia = tarifaFioB; tarifaFioB = tmp;
    raw['tariff_swap_applied'] = `TE↔TUSD`;
  }

  // Validations
  if (leituraAnterior03 != null && leituraAtual03 != null && consumo != null) {
    const diff = leituraAtual03 - leituraAnterior03;
    validations.push({ rule: 'consumo_vs_leitura_03', passed: Math.abs(diff - consumo) <= 1, detail: `${leituraAtual03}-${leituraAnterior03}=${diff} vs ${consumo}` });
  }

  confidence = Math.min(confidence, 100);

  return {
    concessionaria_nome: concNome,
    cliente_nome: null,
    endereco: null,
    cidade,
    estado,
    consumo_kwh: consumo,
    tarifa_energia_kwh: tarifaEnergia,
    tarifa_fio_b_kwh: tarifaFioB,
    valor_total: valorTotal,
    icms_percentual: icms,
    pis_valor: pis,
    cofins_valor: cofins,
    bandeira_tarifaria: bandeira,
    classe_consumo: classe,
    tipo_ligacao: tipoLigacao,
    mes_referencia: mesRef,
    demanda_contratada_kw: demanda,
    numero_uc: numeroUc,
    vencimento,
    proxima_leitura_data: proximaLeitura,
    data_leitura_anterior: null,
    data_leitura_atual: null,
    dias_leitura: null,
    saldo_gd: saldoGd,
    saldo_gd_acumulado: saldoGdAcumulado,
    leitura_anterior_03: leituraAnterior03,
    leitura_atual_03: leituraAtual03,
    leitura_anterior_103: leituraAnterior103,
    leitura_atual_103: leituraAtual103,
    medidor_consumo_codigo: null,
    medidor_injecao_codigo: null,
    energia_injetada_kwh: energiaInjetada,
    energia_compensada_kwh: energiaCompensada,
    categoria_gd: categoriaGd,
    modalidade_tarifaria: modalidade,
    demanda_medida_kw: null,
    demanda_ultrapassagem_kw: null,
    multa_demanda_valor: null,
    confidence,
    ai_fallback_used: false,
    ai_model_used: null,
    parser_version: PARSER_VERSION,
    parser_used: "generic",
    extraction_method: "deterministic",
    field_results: fieldResults,
    validations,
    raw_fields: raw,
  };
}

// ── AI Fallback: Gemini enrichment for missing critical fields ──────────────

const AI_CRITICAL_FIELDS = [
  'icms_percentual', 'proxima_leitura_data', 'dias_leitura',
  'data_leitura_anterior', 'data_leitura_atual',
] as const;

const AI_ENRICHABLE_FIELDS = [
  'icms_percentual', 'pis_valor', 'cofins_valor',
  'proxima_leitura_data', 'dias_leitura',
  'data_leitura_anterior', 'data_leitura_atual',
  'demanda_contratada_kw', 'demanda_medida_kw',
  'modalidade_tarifaria', 'bandeira_tarifaria',
] as const;

function needsAiFallback(data: ExtractedData): boolean {
  return AI_CRITICAL_FIELDS.some(f => (data as any)[f] == null);
}

function getMissingFields(data: ExtractedData): string[] {
  return AI_ENRICHABLE_FIELDS.filter(f => (data as any)[f] == null);
}

async function tryAiEnrichment(
  data: ExtractedData,
  text: string,
  tenantId: string | null,
): Promise<ExtractedData> {
  if (!tenantId) {
    console.log('[parse-conta-energia] AI fallback skipped: no tenant_id');
    return data;
  }

  const missing = getMissingFields(data);
  if (missing.length === 0) return data;

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  // Try Gemini key from tenant
  const { data: keyRow } = await admin
    .from('integration_configs')
    .select('api_key')
    .eq('tenant_id', tenantId)
    .eq('service_key', 'google_gemini')
    .eq('is_active', true)
    .maybeSingle();

  // Tenant key opcional (Gemini direto). Caso ausente, callAi() usa GEMINI_API_KEY/OPENAI_API_KEY do ambiente.
  const tenantGeminiKey = keyRow?.api_key || null;
  const hasEnvAi = !!Deno.env.get('GEMINI_API_KEY') || !!Deno.env.get('OPENAI_API_KEY');

  if (!tenantGeminiKey && !hasEnvAi) {
    console.log('[parse-conta-energia] AI fallback skipped: no API key available');
    return data;
  }

  console.log(`[parse-conta-energia] AI fallback: enriching ${missing.length} fields (tenant_gemini=${!!tenantGeminiKey})`);

  const truncatedText = text.length > 4000 ? text.substring(0, 4000) : text;

  const systemPrompt = `Você é um extrator de dados de faturas de energia elétrica brasileiras.
Analise o texto da fatura e extraia APENAS os campos solicitados.
Retorne um JSON com os campos encontrados. Use null para campos não encontrados.
Regras:
- icms_percentual: alíquota em %, número (ex: 18, 25, 12)
- pis_valor: valor em R$, número decimal
- cofins_valor: valor em R$, número decimal
- proxima_leitura_data: formato dd/mm/aaaa
- dias_leitura: número inteiro de dias entre leituras
- data_leitura_anterior: formato dd/mm/aaaa
- data_leitura_atual: formato dd/mm/aaaa
- demanda_contratada_kw: número em kW
- demanda_medida_kw: número em kW
- modalidade_tarifaria: string (ex: "Convencional", "Horosazonal")
- bandeira_tarifaria: "verde", "amarela", "vermelha_1" ou "vermelha_2"
NÃO invente dados. Se não encontrar, retorne null.`;

  const userPrompt = `Extraia APENAS estes campos faltantes: ${missing.join(', ')}

Texto da fatura:
${truncatedText}

Responda APENAS com JSON válido, sem explicações.`;

  try {
    let aiResult: Record<string, unknown> | null = null;
    let modelUsed = '';

    const parseAiJson = (content: string): Record<string, unknown> | null => {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      if (!cleaned) return null;
      const parsed = JSON.parse(cleaned);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null;
    };

    // 1) Tentar Gemini com chave do tenant (preferencial)
    if (tenantGeminiKey) {
      modelUsed = 'gemini-2.5-flash';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelUsed}:generateContent?key=${tenantGeminiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 500,
              responseMimeType: 'application/json',
            },
          }),
          signal: controller.signal,
        });
        if (response.ok) {
          const geminiData = await response.json();
          const content = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (content) aiResult = parseAiJson(content);
          console.log("[ai] provider: gemini-tenant model:", modelUsed);
        } else {
          const errBody = await response.text();
          console.error(`[parse-conta-energia] Gemini tenant error ${response.status}: ${errBody.substring(0, 200)}`);
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    // 2) Fallback: helper compartilhado (Gemini env → OpenAI env)
    if (!aiResult && hasEnvAi) {
      try {
        const ai = await callAi({
          tier: "flash",
          jsonMode: true,
          temperature: 0.1,
          maxTokens: 500,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        });
        console.log("[ai] provider:", ai.provider, "model:", ai.model);
        modelUsed = ai.model;
        const content = ai.choices?.[0]?.message?.content;
        if (content) aiResult = parseAiJson(content);
      } catch (err: any) {
        console.error('[parse-conta-energia] callAi fallback error:', err?.message);
      }
    }

    if (!aiResult) return data;

    if (!aiResult || typeof aiResult !== 'object') {
      console.log('[parse-conta-energia] AI fallback: no valid result');
      return data;
    }

    // Merge only missing fields from AI result
    let enrichedCount = 0;
    const enrichedData = { ...data } as any;

    for (const field of missing) {
      const aiValue = aiResult[field];
      if (aiValue != null && aiValue !== '') {
        enrichedData[field] = typeof aiValue === 'string' && !isNaN(Number(aiValue)) ? Number(aiValue) : aiValue;
        enrichedData.field_results[field] = {
          value: enrichedData[field],
          source: `ai:${modelUsed}`,
          validated: false,
          note: 'Preenchido por IA como fallback',
        };
        enrichedCount++;
      }
    }

    if (enrichedCount > 0) {
      enrichedData.ai_fallback_used = true;
      enrichedData.ai_model_used = modelUsed;
      enrichedData.extraction_method = 'ai_enriched';
      console.log(`[parse-conta-energia] AI fallback: enriched ${enrichedCount} fields via ${modelUsed}`);
    }

    return enrichedData as ExtractedData;
  } catch (err: any) {
    console.error(`[parse-conta-energia] AI fallback error: ${err.message}`);
    return data; // Graceful degradation: return deterministic result
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceRole = authHeader === `Bearer ${serviceRoleKey}`;

    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    const body = await req.json();
    const { text, tenant_id } = body;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Campo "text" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let extracted: ExtractedData | null = null;

    // Strategy 0: Concessionária-specific parsers (strict, deterministic)
    if (text && typeof text === 'string' && text.length >= 50) {
      extracted = extractEnergisa(text);
      if (extracted) {
        console.log(`[parse-conta-energia] Energisa parser v${PARSER_VERSION} — confidence: ${extracted.confidence}, validations: ${extracted.validations.length}`);
      }
    }

    // Strategy 1: Generic regex (also deterministic)
    if (!extracted && text && typeof text === 'string' && text.length >= 50) {
      extracted = extractFromText(text);
      console.log(`[parse-conta-energia] Generic parser v${PARSER_VERSION} — confidence: ${extracted.confidence}`);
    }

    // Strategy 2: AI enrichment for missing critical fields
    if (extracted && needsAiFallback(extracted)) {
      const resolvedTenantId = tenant_id || null;
      extracted = await tryAiEnrichment(extracted, text, resolvedTenantId);
    }

    if (!extracted) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Não foi possível extrair dados da fatura. O PDF pode estar escaneado ou protegido.',
        parser_version: PARSER_VERSION,
        extraction_method: 'deterministic',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      data: extracted,
      parser_version: extracted.parser_version,
      extraction_method: extracted.extraction_method,
      ai_fallback_used: extracted.ai_fallback_used,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[parse-conta-energia] Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno', parser_version: PARSER_VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
