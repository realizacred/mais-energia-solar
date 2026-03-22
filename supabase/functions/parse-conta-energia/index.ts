// ──────────────────────────────────────────────────────────────────────────────
// parse-conta-energia — Extract tariff data from energy bill PDF text
// Layer 1: Regex (fast) + Layer 2: OpenAI fallback (for missing fields)
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

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
  saldo_gd: number | null;
  saldo_gd_acumulado: number | null;
  leitura_anterior_03: number | null;
  leitura_atual_03: number | null;
  leitura_anterior_103: number | null;
  leitura_atual_103: number | null;
  energia_injetada_kwh: number | null;
  energia_compensada_kwh: number | null;
  categoria_gd: string | null;
  confidence: number;
  ai_fallback_used: boolean;
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

  if (hasComma) {
    return Number(normalized.replace(/\./g, '').replace(',', '.'));
  }

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
  const dayNum = Number(day);
  const monthNum = Number(month);
  const yearNum = Number(year);

  return yearNum >= 2020 && yearNum <= 2100 && monthNum >= 1 && monthNum <= 12 && dayNum >= 1 && dayNum <= 31;
}

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

  return {
    previous,
    current,
    factor: Number.isFinite(factor) ? factor : null,
    total,
  };
}

// ── LAYER 1: Regex extraction ───────────────────────────────────────────────

function extractFromText(text: string): ExtractedData {
  const raw: Record<string, string> = {};
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

  if (activeMeterRow) {
    raw['leitura_03_match'] = `${activeMeterRow.previous} ${activeMeterRow.current} ${activeMeterRow.total}`;
    confidence += 15;
  }
  if (injectedMeterRow) {
    raw['leitura_103_match'] = `${injectedMeterRow.previous} ${injectedMeterRow.current} ${injectedMeterRow.total}`;
    confidence += 15;
  }

  let consumo: number | null = activeMeterRow?.total ?? null;
  if (consumo != null) raw['consumo_match'] = String(consumo);
  if (consumo == null) {
    const consumoPatterns = [
      /consumo\s*(?:ativo|total|mensal)?[:\s]*(\d[\d.,]*)\s*kWh/i,
      /consumo\s*em\s*kwh[:\s]*(\d[\d.,]*)/i,
      /(\d[\d.,]*)\s*kWh\s*(?:consumo|ativo)/i,
      /energia\s*el[ée]trica\s*kWh\s*(\d[\d.,]*)/i,
      /quantidade\s*kWh\s*(\d[\d.,]*)/i,
    ];
    for (const p of consumoPatterns) {
      const m = flatText.match(p);
      if (m) {
        consumo = parseNum(m[1]);
        raw['consumo_match'] = m[0];
        confidence += 10;
        break;
      }
    }
  }

  let tarifaEnergia: number | null = null;
  for (const p of [
    /tarifa\s*(?:de\s*)?energia\s*(?:TE)?[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /TE\s*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /energia\s*el[ée]trica.*?R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      tarifaEnergia = parseNum(m[1]);
      raw['te_match'] = m[0];
      confidence += 15;
      break;
    }
  }

  let tarifaFioB: number | null = null;
  for (const p of [
    /TUSD[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /uso\s*(?:do\s*)?sistema\s*(?:de\s*)?distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /fio\s*B[:\s]*R?\$?\s*(\d[\d.,]*)/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      tarifaFioB = parseNum(m[1]);
      raw['tusd_match'] = m[0];
      confidence += 10;
      break;
    }
  }

  let valorTotal: number | null = null;
  let vencimento: string | null = null;
  const resumoFaturaMatch = flatText.match(/total\s+a\s+pagar\s+(?:[A-Za-zÀ-ú]+\s*\/\s*\d{4}\s+)?(\d{2}[\/.]\d{2}[\/.]\d{2,4})\s+R\$\s*(\d[\d.,]*)/i);
  if (resumoFaturaMatch) {
    vencimento = normalizeDateLike(resumoFaturaMatch[1]);
    valorTotal = parseNum(resumoFaturaMatch[2]);
    raw['resumo_fatura_match'] = resumoFaturaMatch[0];
    confidence += 15;
  }

  if (valorTotal === null) {
    for (const p of [
      /\(=\)\s*valor\s*do\s*documento[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /valor\s*(?:total|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /total\s*(?:da\s*fatura|a\s*pagar)[:\s]*R?\$?\s*(\d[\d.,]*)/i,
      /\btotal[:\s]*R?\$?\s*(\d[\d.,]*)\b/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        valorTotal = parseNum(m[1]);
        raw['total_match'] = m[0];
        confidence += 10;
        break;
      }
    }
  }

  if (!vencimento) {
    for (const p of [
      /\bvencimento\b[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
      /data\s*(?:de\s*)?vencimento[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        const candidate = normalizeDateLike(m[1]);
        if (isPlausibleDate(candidate)) {
          vencimento = candidate;
          raw['venc_match'] = m[0];
          confidence += 5;
          break;
        }
      }
    }
  }

  let icms: number | null = null;
  const icmsMatch = flatText.match(/ICMS[:\s]*(\d[\d.,]*)\s*%/i);
  if (icmsMatch) {
    icms = parseFloat(icmsMatch[1].replace(',', '.'));
    raw['icms_match'] = icmsMatch[0];
    confidence += 5;
  }

  let pis: number | null = null;
  const pisMatch = flatText.match(/PIS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (pisMatch) {
    pis = parseNum(pisMatch[1]);
    raw['pis_match'] = pisMatch[0];
    confidence += 5;
  }

  let cofins: number | null = null;
  const cofinsMatch = flatText.match(/COFINS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (cofinsMatch) {
    cofins = parseNum(cofinsMatch[1]);
    raw['cofins_match'] = cofinsMatch[0];
    confidence += 5;
  }

  let bandeira: string | null = null;
  const bandeiraMatch = flatText.match(/bandeira\s*(verde|amarela|vermelha(?:\s*patamar\s*\d)?)/i);
  if (bandeiraMatch) {
    bandeira = bandeiraMatch[1];
    raw['bandeira_match'] = bandeiraMatch[0];
    confidence += 5;
  }

  let tipoLigacao: string | null = null;
  if (/trif[áa]sic/i.test(flatText)) tipoLigacao = 'trifasico';
  else if (/bif[áa]sic/i.test(flatText)) tipoLigacao = 'bifasico';
  else if (/monof[áa]sic/i.test(flatText)) tipoLigacao = 'monofasico';
  if (tipoLigacao) confidence += 5;

  let classe: string | null = null;
  if (/residencial/i.test(flatText)) classe = 'Residencial';
  else if (/comercial/i.test(flatText)) classe = 'Comercial';
  else if (/industrial/i.test(flatText)) classe = 'Industrial';
  else if (/rural/i.test(flatText)) classe = 'Rural';
  if (classe) confidence += 5;

  let mesRef: string | null = null;
  const mesMatch = flatText.match(/(?:m[êe]s\s*(?:de\s*)?refer[êe]ncia|refer[êe]ncia|ref[:\s]*mes\/ano)[:\s]*((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\w\s\/]*\d{2,4}|\d{2}\/\d{4}|[A-Za-zÀ-ú]+\s*\/\s*\d{4})/i);
  if (mesMatch) {
    mesRef = mesMatch[1].trim();
    raw['mes_match'] = mesMatch[0];
    confidence += 5;
  }

  let demanda: number | null = null;
  const demandaMatch = flatText.match(/demanda\s*contratada[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demandaMatch) {
    demanda = parseNum(demandaMatch[1]);
    raw['demanda_match'] = demandaMatch[0];
    confidence += 5;
  }

  let estado: string | null = null;
  const ufMatch = flatText.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) {
    estado = ufMatch[1];
    confidence += 5;
  }

  let cidade: string | null = null;
  const cidadeMatch = flatText.match(/(?:cidade|munic[íi]pio)[:\s]*([A-Za-zÀ-ú\s]+?)(?:\s*[-\/]\s*[A-Z]{2}|\n)/i);
  if (cidadeMatch) {
    cidade = cidadeMatch[1].trim();
    raw['cidade_match'] = cidadeMatch[0];
  }

  let numeroUc: string | null = null;
  for (const p of [
    /utilize\s+o\s+c[óo]digo[:\s]*([\d\/-]{6,20})/i,
    /c[óo]digo\s+do\s+cliente[:\s]*([\d\/-]{6,20})/i,
    /c[óo]digo\s+da\s+instala[çc][ãa]o[:\s]*([\d\/-]{6,20})/i,
    /\b(\d+\/\d{6,}-\d)\b/,
    /\b(\d{6,}-\d)\b/,
  ]) {
    const m = flatText.match(p);
    if (m) {
      numeroUc = normalizeUcCode(m[1]);
      raw['uc_match'] = m[0];
      confidence += 8;
      break;
    }
  }

  let proximaLeitura: string | null = null;
  for (const p of [
    /pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /data\s*(?:da\s*)?pr[óo]x(?:ima)?\s*leitura[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
    /leitura\s*pr[óo]x(?:ima)?[:\s]*(\d{2}[\/.]\d{2}[\/.]\d{2,4})/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      const candidate = normalizeDateLike(m[1]);
      if (isPlausibleDate(candidate)) {
        proximaLeitura = candidate;
        raw['prox_leitura_match'] = m[0];
        confidence += 5;
        break;
      }
    }
  }

  let saldoGd: number | null = null;
  for (const p of [
    /saldo\s*(?:de\s*)?(?:gera[çc][ãa]o|GD|cr[ée]ditos?\s*(?:de\s*)?energia)[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*kWh/i,
    /cr[ée]ditos?\s*(?:acumulados?|de\s*energia)[:\s]*(\d[\d.,]*)\s*kWh/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      saldoGd = parseNum(m[1]);
      raw['saldo_gd_match'] = m[0];
      confidence += 5;
      break;
    }
  }

  let saldoGdAcumulado: number | null = null;
  for (const p of [
    /saldo\s*acumulado[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*(?:kWh)?/i,
    /total\s*(?:de\s*)?cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
    /cr[ée]ditos?\s*acumulados?[:\s]*(\d[\d.,]*)/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      saldoGdAcumulado = parseNum(m[1]);
      raw['saldo_acum_match'] = m[0];
      confidence += 5;
      break;
    }
  }

  if (leituraAnterior03 == null || leituraAtual03 == null) {
    for (const p of [
      /(?:energia\s*(?:ativa|el[ée]trica)?\s*(?:consumida)?|registro\s*03).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
      /(?:leitura|medidor).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior03 = parseNum(m[1]);
        leituraAtual03 = parseNum(m[2]);
        raw['leitura_03_match'] = m[0].substring(0, 200);
        confidence += 5;
        break;
      }
    }
  }

  if (leituraAnterior103 == null || leituraAtual103 == null) {
    for (const p of [
      /(?:energia\s*injetada|registro\s*103).*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
      /injetada.*?(?:anterior|ant\.?)[:\s]*(\d[\d.,]*).*?(?:atual|atu\.?)[:\s]*(\d[\d.,]*)/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        leituraAnterior103 = parseNum(m[1]);
        leituraAtual103 = parseNum(m[2]);
        raw['leitura_103_match'] = m[0].substring(0, 200);
        confidence += 5;
        break;
      }
    }
  }

  let energiaInjetada: number | null = injectedMeterRow?.total ?? null;
  if (energiaInjetada != null) raw['injetada_match'] = String(energiaInjetada);
  if (energiaInjetada === null) {
    for (const p of [
      /energia\s*injetada[:\s]*(\d[\d.,]*)\s*kWh/i,
      /inje[çc][ãa]o[:\s]*(\d[\d.,]*)\s*kWh/i,
      /energia\s*ativa\s*inje[çc][ãa]o[:\s]*(\d[\d.,]*)/i,
    ]) {
      const m = flatText.match(p);
      if (m) {
        energiaInjetada = parseNum(m[1]);
        raw['injetada_match'] = m[0];
        confidence += 5;
        break;
      }
    }
  }
  if (energiaInjetada === null && leituraAtual103 != null && leituraAnterior103 != null) {
    energiaInjetada = Math.max(leituraAtual103 - leituraAnterior103, 0);
  }

  let energiaCompensada: number | null = null;
  for (const p of [
    /energia\s*compensada[:\s]*(?:-?\s*)?(\d[\d.,]*)\s*kWh/i,
    /compensa[çc][ãa]o\s*(?:de\s*)?energia[:\s]*(\d[\d.,]*)/i,
    /energia\s*atv\s*injetada\s*gdi[:\s]*(\d[\d.,]*)/i,
    /cr[ée]dito\s*(?:de\s*)?energia\s*compensad[ao][:\s]*(\d[\d.,]*)/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      energiaCompensada = parseNum(m[1]);
      raw['compensada_match'] = m[0];
      confidence += 5;
      break;
    }
  }

  let categoriaGd: string | null = null;
  for (const p of [
    /GD[\s_-]*(I{1,3}|1|2|3)\b/i,
    /microgera[cç][ãa]o/i,
    /minigera[cç][ãa]o/i,
  ]) {
    const m = flatText.match(p);
    if (m) {
      if (/microgera[cç][ãa]o/i.test(m[0])) categoriaGd = 'GD_I';
      else if (/minigera[cç][ãa]o/i.test(m[0])) categoriaGd = 'GD_II';
      else {
        const num = m[1]?.toUpperCase();
        if (num === 'I' || num === '1') categoriaGd = 'GD_I';
        else if (num === 'II' || num === '2') categoriaGd = 'GD_II';
        else if (num === 'III' || num === '3') categoriaGd = 'GD_III';
      }
      raw['categoria_gd_match'] = m[0];
      confidence += 5;
      break;
    }
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
    saldo_gd: saldoGd,
    saldo_gd_acumulado: saldoGdAcumulado,
    leitura_anterior_03: leituraAnterior03,
    leitura_atual_03: leituraAtual03,
    leitura_anterior_103: leituraAnterior103,
    leitura_atual_103: leituraAtual103,
    energia_injetada_kwh: energiaInjetada,
    energia_compensada_kwh: energiaCompensada,
    categoria_gd: categoriaGd,
    confidence,
    ai_fallback_used: false,
    raw_fields: raw,
  };
}

// ── LAYER 2: AI full extraction from PDF base64 (multimodal) ─────────────────

async function aiFullExtractFromPdf(
  pdfBase64: string,
): Promise<ExtractedData | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[parse-conta-energia] LOVABLE_API_KEY not available, skipping AI full extraction");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um extrator especializado de dados de faturas de energia elétrica brasileiras. 
Analise o PDF da fatura e extraia TODOS os campos usando a tool fornecida.
Números decimais: use ponto como separador (ex: 1234.56).
Datas: formato DD/MM/YYYY.
Se não encontrar um campo, retorne null.
Seja preciso — nunca invente dados.`
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${pdfBase64}`,
                },
              },
              {
                type: "text",
                text: "Extraia todos os dados desta fatura de energia elétrica brasileira.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_data",
              description: "Extract all fields from a Brazilian energy bill PDF",
              parameters: {
                type: "object",
                properties: {
                  concessionaria_nome: { type: "string", description: "Nome da concessionária (CEMIG, CPFL, Enel, etc.)" },
                  cliente_nome: { type: "string", description: "Nome do titular da conta" },
                  endereco: { type: "string", description: "Endereço completo do imóvel" },
                  cidade: { type: "string", description: "Cidade" },
                  estado: { type: "string", description: "UF (sigla de 2 letras)" },
                  numero_uc: { type: "string", description: "Número/código da unidade consumidora" },
                  consumo_kwh: { type: "number", description: "Consumo em kWh" },
                  tarifa_energia_kwh: { type: "number", description: "Tarifa de energia (TE) em R$/kWh" },
                  tarifa_fio_b_kwh: { type: "number", description: "TUSD/Fio B em R$/kWh" },
                  valor_total: { type: "number", description: "Valor total da fatura em R$" },
                  icms_percentual: { type: "number", description: "ICMS em %" },
                  pis_valor: { type: "number", description: "PIS em R$" },
                  cofins_valor: { type: "number", description: "COFINS em R$" },
                  bandeira_tarifaria: { type: "string", description: "Bandeira: verde, amarela, vermelha patamar 1, vermelha patamar 2" },
                  classe_consumo: { type: "string", description: "Classe: Residencial, Comercial, Industrial, Rural" },
                  tipo_ligacao: { type: "string", description: "monofasico, bifasico ou trifasico" },
                  mes_referencia: { type: "string", description: "Mês de referência (ex: MAR/2026, 03/2026)" },
                  demanda_contratada_kw: { type: "number", description: "Demanda contratada em kW" },
                  vencimento: { type: "string", description: "Data de vencimento DD/MM/YYYY" },
                  proxima_leitura_data: { type: "string", description: "Data da próxima leitura DD/MM/YYYY" },
                  saldo_gd: { type: "number", description: "Saldo de geração distribuída em kWh" },
                  saldo_gd_acumulado: { type: "number", description: "Saldo GD acumulado em kWh" },
                  leitura_anterior_03: { type: "number", description: "Leitura anterior registro 03 (energia ativa)" },
                  leitura_atual_03: { type: "number", description: "Leitura atual registro 03 (energia ativa)" },
                  leitura_anterior_103: { type: "number", description: "Leitura anterior registro 103 (energia injetada)" },
                  leitura_atual_103: { type: "number", description: "Leitura atual registro 103 (energia injetada)" },
                  energia_injetada_kwh: { type: "number", description: "Energia injetada total no período em kWh" },
                  energia_compensada_kwh: { type: "number", description: "Energia compensada (créditos utilizados) em kWh" },
                  categoria_gd: { type: "string", description: "Categoria de geração distribuída: GD_I (microgeração), GD_II (minigeração), GD_III" },
                },
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_data" } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text();
      console.warn(`[parse-conta-energia] AI full extraction failed: ${response.status} ${errText}`);
      return null;
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return null;

    const fields = JSON.parse(toolCall.function.arguments);

    return {
      concessionaria_nome: fields.concessionaria_nome || null,
      cliente_nome: fields.cliente_nome || null,
      endereco: fields.endereco || null,
      cidade: fields.cidade || null,
      estado: fields.estado || null,
      consumo_kwh: fields.consumo_kwh ?? null,
      tarifa_energia_kwh: fields.tarifa_energia_kwh ?? null,
      tarifa_fio_b_kwh: fields.tarifa_fio_b_kwh ?? null,
      valor_total: fields.valor_total ?? null,
      icms_percentual: fields.icms_percentual ?? null,
      pis_valor: fields.pis_valor ?? null,
      cofins_valor: fields.cofins_valor ?? null,
      bandeira_tarifaria: fields.bandeira_tarifaria || null,
      classe_consumo: fields.classe_consumo || null,
      tipo_ligacao: fields.tipo_ligacao || null,
      mes_referencia: fields.mes_referencia || null,
      demanda_contratada_kw: fields.demanda_contratada_kw ?? null,
      numero_uc: fields.numero_uc || null,
      vencimento: fields.vencimento || null,
      proxima_leitura_data: fields.proxima_leitura_data || null,
      saldo_gd: fields.saldo_gd ?? null,
      saldo_gd_acumulado: fields.saldo_gd_acumulado ?? null,
      leitura_anterior_03: fields.leitura_anterior_03 ?? null,
      leitura_atual_03: fields.leitura_atual_03 ?? null,
      leitura_anterior_103: fields.leitura_anterior_103 ?? null,
      leitura_atual_103: fields.leitura_atual_103 ?? null,
      energia_injetada_kwh: fields.energia_injetada_kwh ?? null,
      energia_compensada_kwh: fields.energia_compensada_kwh ?? null,
      categoria_gd: fields.categoria_gd || null,
      confidence: 85,
      ai_fallback_used: true,
      raw_fields: { ai_full_extraction: "true" },
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[parse-conta-energia] AI full extraction timeout");
    } else {
      console.error("[parse-conta-energia] AI full extraction error:", err);
    }
    return null;
  }
}

// ── LAYER 3: AI text-based fallback for missing fields ───────────────────────

async function aiExtractMissingFields(
  text: string,
  regexResult: ExtractedData
): Promise<ExtractedData> {
  const missingFields: string[] = [];
  if (!regexResult.proxima_leitura_data) missingFields.push("proxima_leitura_data (formato DD/MM/YYYY)");
  if (regexResult.saldo_gd === null) missingFields.push("saldo_gd (em kWh, número)");
  if (!regexResult.numero_uc) missingFields.push("numero_uc (código da unidade consumidora)");
  if (!regexResult.vencimento) missingFields.push("vencimento (formato DD/MM/YYYY)");
  if (regexResult.valor_total === null) missingFields.push("valor_total (em R$, número)");

  if (missingFields.length === 0) return regexResult;

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    console.warn("[parse-conta-energia] LOVABLE_API_KEY not available, skipping AI fallback");
    return regexResult;
  }

  try {
    const truncatedText = text.substring(0, 4000);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          {
            role: "system",
            content: "Você é um extrator de dados de faturas de energia elétrica brasileiras. Retorne APENAS os campos solicitados em formato JSON. Se não encontrar um campo, retorne null. Números devem ser sem formatação (use ponto como decimal). Datas no formato DD/MM/YYYY."
          },
          {
            role: "user",
            content: `Extraia APENAS estes campos da fatura abaixo:\n${missingFields.join("\n")}\n\nTexto da fatura:\n${truncatedText}`
          }
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_invoice_fields",
              description: "Extract specific fields from a Brazilian energy bill",
              parameters: {
                type: "object",
                properties: {
                  proxima_leitura_data: { type: "string", description: "Next reading date DD/MM/YYYY" },
                  saldo_gd: { type: "number", description: "GD balance in kWh" },
                  numero_uc: { type: "string", description: "Consumer unit code" },
                  vencimento: { type: "string", description: "Due date DD/MM/YYYY" },
                  valor_total: { type: "number", description: "Total amount in BRL" },
                },
                additionalProperties: false,
              }
            }
          }
        ],
        tool_choice: { type: "function", function: { name: "extract_invoice_fields" } },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[parse-conta-energia] AI fallback failed: ${response.status}`);
      return regexResult;
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) return regexResult;

    const aiFields = JSON.parse(toolCall.function.arguments);
    const result = { ...regexResult, ai_fallback_used: true };

    if (!result.proxima_leitura_data && aiFields.proxima_leitura_data) {
      result.proxima_leitura_data = aiFields.proxima_leitura_data;
      result.raw_fields['ai_proxima_leitura'] = aiFields.proxima_leitura_data;
    }
    if (result.saldo_gd === null && aiFields.saldo_gd != null) {
      result.saldo_gd = aiFields.saldo_gd;
      result.raw_fields['ai_saldo_gd'] = String(aiFields.saldo_gd);
    }
    if (!result.numero_uc && aiFields.numero_uc) {
      result.numero_uc = aiFields.numero_uc;
      result.raw_fields['ai_numero_uc'] = aiFields.numero_uc;
    }
    if (!result.vencimento && aiFields.vencimento) {
      result.vencimento = aiFields.vencimento;
      result.raw_fields['ai_vencimento'] = aiFields.vencimento;
    }
    if (result.valor_total === null && aiFields.valor_total != null) {
      result.valor_total = aiFields.valor_total;
      result.raw_fields['ai_valor_total'] = String(aiFields.valor_total);
    }

    result.confidence = Math.min(result.confidence + 10, 100);
    return result;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      console.warn("[parse-conta-energia] AI fallback timeout, usando regex apenas");
      return regexResult;
    }
    console.error("[parse-conta-energia] AI fallback error:", err);
    return regexResult;
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');

    // Allow service_role calls (from process-fatura-pdf) without user auth
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
    const { text, pdf_base64, use_ai_fallback = true } = body;

    if (!text && !pdf_base64) {
      return new Response(JSON.stringify({ error: 'Campo "text" ou "pdf_base64" é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let extracted: ExtractedData | null = null;

    // Strategy 1: If we have text, try regex first
    if (text && typeof text === 'string' && text.length >= 50) {
      extracted = extractFromText(text);
      console.log(`[parse-conta-energia] Regex confidence: ${extracted.confidence}`);
    }

    // Strategy 2: If regex confidence is low (< 30) or no text, use AI multimodal on PDF
    if (pdf_base64 && (!extracted || extracted.confidence < 30)) {
      console.log("[parse-conta-energia] Low regex confidence or no text, using AI multimodal extraction");
      const aiResult = await aiFullExtractFromPdf(pdf_base64);
      if (aiResult) {
        // If we had partial regex, merge (AI takes precedence for nulls)
        if (extracted) {
          for (const key of Object.keys(aiResult) as Array<keyof ExtractedData>) {
            if (key === 'raw_fields' || key === 'confidence' || key === 'ai_fallback_used') continue;
            if ((extracted[key] === null || extracted[key] === undefined) && aiResult[key] !== null) {
              (extracted as any)[key] = aiResult[key];
            }
          }
          extracted.ai_fallback_used = true;
          extracted.confidence = Math.max(extracted.confidence, aiResult.confidence);
          extracted.raw_fields = { ...extracted.raw_fields, ...aiResult.raw_fields };
        } else {
          extracted = aiResult;
        }
      }
    }

    // Strategy 3: If still no good result but we have text, try text-based AI fallback
    if (extracted && use_ai_fallback && text) {
      extracted = await aiExtractMissingFields(text, extracted);
    }

    // If nothing worked at all
    if (!extracted) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Não foi possível extrair dados da fatura. O PDF pode estar escaneado ou protegido.',
      }), { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      success: true,
      data: extracted,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: any) {
    console.error("[parse-conta-energia] Error:", err);
    return new Response(JSON.stringify({ error: err.message || 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
