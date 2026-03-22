// ──────────────────────────────────────────────────────────────────────────────
// parse-conta-energia — Deterministic PDF invoice parser (NO AI/LLM)
// Layer 0: Concessionária-specific parsers (Energisa, etc.)
// Layer 1: Generic regex fallback
// NO AI fallback — 100% deterministic, auditable, reproducible
// Parser version: 3.0.0
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const PARSER_VERSION = "3.0.0";

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
  ai_fallback_used: false;
  ai_model_used: null;
  parser_version: string;
  parser_used: string;
  extraction_method: "deterministic";
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

// ══════════════════════════════════════════════════════════════════════════════
// ENERGISA PARSER — Deterministic, regex-only, auditable
// ══════════════════════════════════════════════════════════════════════════════

function extractEnergisa(text: string): ExtractedData | null {
  const flatText = text.replace(/\|/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/ENERGISA/i.test(flatText)) return null;

  console.log("[parse-conta-energia] Energisa detected — using strict deterministic parser v" + PARSER_VERSION);

  const raw: Record<string, string> = {};
  const fieldResults: Record<string, FieldResult> = {};
  const validations: ValidationResult[] = [];
  let confidence = 20;

  // ── 1. Identificação e Datas ──

  // Referência
  let mesRef: string | null = null;
  const refMatch = flatText.match(/REF[:\s]*MES\s*\/\s*ANO\s+([A-Za-zÀ-ú]+\s*\/\s*\d{4})/i)
    || flatText.match(/REF[:\s]*([A-Za-zÀ-ú]+\s*\/\s*\d{4})/i)
    || flatText.match(/(?:m[êe]s\s*(?:de\s*)?refer[êe]ncia)[:\s]*((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\w\s\/]*\d{2,4})/i);
  if (refMatch) {
    mesRef = refMatch[1].trim();
    raw['ref'] = refMatch[0];
    fieldResults['mes_referencia'] = makeField(mesRef, 'regex:REF_MES_ANO', true);
    confidence += 10;
  }

  // Vencimento
  let vencimento: string | null = null;
  const vencMatch = flatText.match(/VENCIMENTO[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i);
  if (vencMatch) {
    vencimento = normalizeDateLike(vencMatch[1]);
    raw['vencimento'] = vencMatch[0];
    fieldResults['vencimento'] = makeField(vencimento, 'regex:VENCIMENTO', isPlausibleDate(vencimento));
    confidence += 10;
  }

  // Valor Total
  let valorTotal: number | null = null;
  const totalPatterns = [
    /TOTAL\s+A\s+PAGAR\s+(?:[A-Za-zÀ-ú]+\s*\/\s*\d{4}\s+)?(?:\d{2}[\/.]\d{2}[\/.]\d{2,4}\s+)?R\$\s*(\d[\d.,]*)/i,
    /TOTAL\s+A\s+PAGAR[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /\(=\)\s*valor\s*do\s*documento[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /valor\s*(?:total|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
  ];
  valorTotal = firstMatchNum(flatText, totalPatterns);
  if (valorTotal != null) {
    raw['total'] = String(valorTotal);
    fieldResults['valor_total'] = makeField(valorTotal, 'regex:TOTAL_A_PAGAR', valorTotal > 0, valorTotal <= 0 ? 'Valor <= 0' : null);
    confidence += 10;
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
  if (proximaLeitura) {
    raw['prox_leitura'] = proximaLeitura;
    fieldResults['proxima_leitura_data'] = makeField(proximaLeitura, 'regex:PROXIMA_LEITURA', true);
    confidence += 10;
  }

  // Data leitura anterior e atual
  let dataLeituraAnterior: string | null = null;
  let dataLeituraAtual: string | null = null;
  const leitDatasMatch = flatText.match(/(?:per[íi]odo|leitura)[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})\s*(?:a|até|at[ée])\s*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i);
  if (leitDatasMatch) {
    const d1 = normalizeDateLike(leitDatasMatch[1]);
    const d2 = normalizeDateLike(leitDatasMatch[2]);
    if (isPlausibleDate(d1)) { dataLeituraAnterior = d1; fieldResults['data_leitura_anterior'] = makeField(d1, 'regex:PERIODO_LEITURA', true); }
    if (isPlausibleDate(d2)) { dataLeituraAtual = d2; fieldResults['data_leitura_atual'] = makeField(d2, 'regex:PERIODO_LEITURA', true); }
  }

  // Dias de leitura
  let diasLeitura: number | null = null;
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

  // ── 2. Medidor / Consumo ──

  // Código do medidor de consumo
  let medidorConsumoCodigo: string | null = null;
  const medidorMatch = flatText.match(/(?:medidor|n[°º]?\s*medidor|medi[çc][ãa]o)[:\s]*(\d{4,})/i);
  if (medidorMatch) {
    medidorConsumoCodigo = medidorMatch[1];
    raw['medidor_consumo'] = medidorMatch[1];
    fieldResults['medidor_consumo_codigo'] = makeField(medidorConsumoCodigo, 'regex:MEDIDOR', true);
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

  // Fallback consumo patterns
  if (consumoKwh == null) {
    const consumoPatterns = [
      /Consumo\s+(?:em\s+)?kWh[:\s]*(\d[\d.,]*)/i,
      /consumo\s*(?:faturado|ativo)?[:\s]*(\d[\d.,]*)\s*(?:,\s*\d+)?\s*kWh/i,
      /consumo\s*(?:ativo|total|mensal)?[:\s]*(\d[\d.,]*)\s*kWh/i,
      /(\d[\d.,]*)\s*kWh\s*(?:consumo|ativo)/i,
    ];
    consumoKwh = firstMatchNum(flatText, consumoPatterns);
    if (consumoKwh != null) {
      fieldResults['consumo_kwh'] = makeField(consumoKwh, 'regex:CONSUMO_KWH_FALLBACK', true);
      confidence += 10;
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

  // ── 3. Medidor / Injeção (registro 103) ──

  let medidorInjecaoCodigo: string | null = null;
  let leituraAnterior103: number | null = null;
  let leituraAtual103: number | null = null;
  let energiaInjetada: number | null = null;

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

  // Fallback injeção
  if (energiaInjetada == null) {
    const injPatterns = [
      /Energia\s+At[iv]+\s+Injetada\s+GDI?[:\s]*[-]?\s*(\d[\d.,]*)/i,
      /energia\s+(?:atv?\s+)?injetada\s+GDI?[:\s]*[-]?\s*(\d[\d.,]*)/i,
      /energia\s*injetada[:\s]*(\d[\d.,]*)\s*kWh/i,
    ];
    energiaInjetada = firstMatchNum(flatText, injPatterns);
    if (energiaInjetada != null) {
      fieldResults['energia_injetada_kwh'] = makeField(energiaInjetada, 'regex:ENERGIA_INJETADA_FALLBACK', true);
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

  // Second medidor code for injection
  const medidorInjMatch = flatText.match(/(?:medidor|registro)\s*(?:103|inje[çc][ãa]o)[:\s]*(\d{4,})/i);
  if (medidorInjMatch) {
    medidorInjecaoCodigo = medidorInjMatch[1];
    fieldResults['medidor_injecao_codigo'] = makeField(medidorInjecaoCodigo, 'regex:MEDIDOR_103', true);
  }

  // ── 4. GD / Créditos ──

  // Saldo Acumulado
  let saldoGdAcumulado: number | null = null;
  const saldoAcumPatterns = [
    /Saldo\s+Acumulado[:\s]*(\d[\d.,]*)/i,
    /total\s*(?:de\s*)?cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
    /cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
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

  // Energia compensada
  let energiaCompensada: number | null = null;
  const compPatterns = [
    /energia\s*compensada[:\s]*(?:-?\s*)?(\d[\d.,]*)/i,
    /compensa[çc][ãa]o\s*(?:de\s*)?energia[:\s]*(\d[\d.,]*)/i,
  ];
  energiaCompensada = firstMatchNum(flatText, compPatterns);
  if (energiaCompensada != null) {
    fieldResults['energia_compensada_kwh'] = makeField(energiaCompensada, 'regex:COMPENSADA', true);
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
  const bandeiraMatch = flatText.match(/bandeira\s*(verde|amarela|vermelha(?:\s*patamar\s*\d)?)/i);
  if (bandeiraMatch) {
    bandeira = bandeiraMatch[1];
    fieldResults['bandeira_tarifaria'] = makeField(bandeira, 'regex:BANDEIRA', true);
  }

  // ── 6. Tarifas e Tributos ──

  let tarifaEnergia: number | null = null;
  const tePatterns = [
    /tarifa\s*(?:de\s*)?energia\s*(?:TE)?[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /TE\s*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /energia\s*(?:ativa\s*)?(?:fornecida|consumida).*?kWh\s+[\d.,]+\s+(0[,.][\d]+)/i,
  ];
  for (const p of tePatterns) {
    const m = flatText.match(p);
    if (m) {
      const val = parseNum(m[1]);
      if (val > 0.05 && val < 3.0) {
        tarifaEnergia = val;
        fieldResults['tarifa_energia_kwh'] = makeField(tarifaEnergia, 'regex:TE', true);
        confidence += 10;
        break;
      }
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
  const icmsPatterns = [
    /ICMS[:\s]*(\d[\d.,]*)\s*%/i,
    /al[ií]quota\s*ICMS[:\s]*(\d[\d.,]*)/i,
    /ICMS\s+(\d{1,2}(?:[,.]\d+)?)\s*%/i,
  ];
  for (const p of icmsPatterns) {
    const m = flatText.match(p);
    if (m) { icms = parseFloat(m[1].replace(',', '.')); fieldResults['icms_percentual'] = makeField(icms, 'regex:ICMS', true); break; }
  }

  // PIS
  let pis: number | null = null;
  const pisMatch = flatText.match(/PIS[\/\s]*(?:PASEP)?[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (pisMatch) { pis = parseNum(pisMatch[1]); fieldResults['pis_valor'] = makeField(pis, 'regex:PIS', true); }

  // COFINS
  let cofins: number | null = null;
  const cofinsMatch = flatText.match(/COFINS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (cofinsMatch) { cofins = parseNum(cofinsMatch[1]); fieldResults['cofins_valor'] = makeField(cofins, 'regex:COFINS', true); }

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

  // Cidade
  let cidade: string | null = null;
  const cidadeMatch = flatText.match(/(?:cidade|munic[íi]pio)[:\s]*([A-Za-zÀ-ú\s]+?)(?:\s*[-\/]\s*[A-Z]{2}|\n)/i);
  if (cidadeMatch) cidade = cidadeMatch[1].trim();

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
  if (tarifaEnergia != null && tarifaFioB != null && tarifaEnergia > tarifaFioB && tarifaEnergia > 0.5 && tarifaFioB > 0.05) {
    const tmp = tarifaEnergia;
    tarifaEnergia = tarifaFioB;
    tarifaFioB = tmp;
    raw['tariff_swap_applied'] = `TE↔TUSD`;
    fieldResults['tarifa_energia_kwh'] = makeField(tarifaEnergia, 'regex:TE (swapped)', true, 'TE/TUSD invertidos e corrigidos');
    fieldResults['tarifa_fio_b_kwh'] = makeField(tarifaFioB, 'regex:TUSD (swapped)', true, 'TE/TUSD invertidos e corrigidos');
  }

  return {
    concessionaria_nome: "Energisa",
    cliente_nome: null,
    endereco: null,
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
    proxima_leitura_data: proximaLeitura,
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
    const { text } = body;

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

    // NO AI FALLBACK — deterministic only

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
      parser_version: PARSER_VERSION,
      extraction_method: 'deterministic',
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[parse-conta-energia] Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno', parser_version: PARSER_VERSION }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
