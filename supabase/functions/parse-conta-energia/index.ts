// ──────────────────────────────────────────────────────────────────────────────
// parse-conta-energia — Extract tariff data from energy bill PDF text
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
  confidence: number;
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

const ESTADOS_MAP: Record<string, string> = {
  "ACRE": "AC", "ALAGOAS": "AL", "AMAPA": "AP", "AMAZONAS": "AM",
  "BAHIA": "BA", "CEARA": "CE", "DISTRITO FEDERAL": "DF", "ESPIRITO SANTO": "ES",
  "GOIAS": "GO", "MARANHAO": "MA", "MATO GROSSO": "MT", "MATO GROSSO DO SUL": "MS",
  "MINAS GERAIS": "MG", "PARA": "PA", "PARAIBA": "PB", "PARANA": "PR",
  "PERNAMBUCO": "PE", "PIAUI": "PI", "RIO DE JANEIRO": "RJ", "RIO GRANDE DO NORTE": "RN",
  "RIO GRANDE DO SUL": "RS", "RONDONIA": "RO", "RORAIMA": "RR",
  "SANTA CATARINA": "SC", "SAO PAULO": "SP", "SERGIPE": "SE", "TOCANTINS": "TO",
};

// ── Extraction logic ─────────────────────────────────────────────────────────

function extractFromText(text: string): ExtractedData {
  const raw: Record<string, string> = {};
  let confidence = 0;

  // Concessionária
  let concNome: string | null = null;
  for (const { pattern, nome } of CONC_PATTERNS) {
    if (pattern.test(text)) {
      concNome = nome;
      confidence += 15;
      break;
    }
  }

  // Consumo kWh - multiple patterns
  let consumo: number | null = null;
  const consumoPatterns = [
    /consumo\s*(?:ativo|total|mensal)?[:\s]*(\d[\d.,]*)\s*kWh/i,
    /(\d[\d.,]*)\s*kWh\s*(?:consumo|ativo)/i,
    /energia\s*el[ée]trica\s*kWh\s*(\d[\d.,]*)/i,
    /quantidade\s*kWh\s*(\d[\d.,]*)/i,
  ];
  for (const p of consumoPatterns) {
    const m = text.match(p);
    if (m) {
      consumo = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      raw['consumo_match'] = m[0];
      confidence += 10;
      break;
    }
  }

  // Tarifa de energia (TE) R$/kWh
  let tarifaEnergia: number | null = null;
  const tePatterns = [
    /tarifa\s*(?:de\s*)?energia\s*(?:TE)?[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /TE\s*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /energia\s*el[ée]trica.*?R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)/i,
  ];
  for (const p of tePatterns) {
    const m = text.match(p);
    if (m) {
      tarifaEnergia = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      raw['te_match'] = m[0];
      confidence += 15;
      break;
    }
  }

  // TUSD / Fio B
  let tarifaFioB: number | null = null;
  const tusdPatterns = [
    /TUSD[:\s]*R?\$?\s*(\d[\d.,]*)\s*(?:\/kWh)?/i,
    /uso\s*(?:do\s*)?sistema\s*(?:de\s*)?distribui[çc][ãa]o[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /fio\s*B[:\s]*R?\$?\s*(\d[\d.,]*)/i,
  ];
  for (const p of tusdPatterns) {
    const m = text.match(p);
    if (m) {
      tarifaFioB = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      raw['tusd_match'] = m[0];
      confidence += 10;
      break;
    }
  }

  // Valor total da fatura
  let valorTotal: number | null = null;
  const totalPatterns = [
    /(?:valor\s*(?:total|a\s*pagar)|total\s*(?:da\s*fatura|a\s*pagar))[:\s]*R?\$?\s*(\d[\d.,]*)/i,
    /R\$\s*(\d[\d.,]*)\s*(?:total|valor\s*total)/i,
  ];
  for (const p of totalPatterns) {
    const m = text.match(p);
    if (m) {
      valorTotal = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      raw['total_match'] = m[0];
      confidence += 10;
      break;
    }
  }

  // ICMS
  let icms: number | null = null;
  const icmsMatch = text.match(/ICMS[:\s]*(\d[\d.,]*)\s*%/i);
  if (icmsMatch) {
    icms = parseFloat(icmsMatch[1].replace(',', '.'));
    raw['icms_match'] = icmsMatch[0];
    confidence += 5;
  }

  // PIS
  let pis: number | null = null;
  const pisMatch = text.match(/PIS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (pisMatch) {
    pis = parseFloat(pisMatch[1].replace(/\./g, '').replace(',', '.'));
    raw['pis_match'] = pisMatch[0];
    confidence += 5;
  }

  // COFINS
  let cofins: number | null = null;
  const cofinsMatch = text.match(/COFINS[:\s]*R?\$?\s*(\d[\d.,]*)/i);
  if (cofinsMatch) {
    cofins = parseFloat(cofinsMatch[1].replace(/\./g, '').replace(',', '.'));
    raw['cofins_match'] = cofinsMatch[0];
    confidence += 5;
  }

  // Bandeira
  let bandeira: string | null = null;
  const bandeiraMatch = text.match(/bandeira\s*(verde|amarela|vermelha(?:\s*patamar\s*\d)?)/i);
  if (bandeiraMatch) {
    bandeira = bandeiraMatch[1];
    raw['bandeira_match'] = bandeiraMatch[0];
    confidence += 5;
  }

  // Tipo de ligação (mono/bi/tri)
  let tipoLigacao: string | null = null;
  if (/trif[áa]sic/i.test(text)) tipoLigacao = "trifasico";
  else if (/bif[áa]sic/i.test(text)) tipoLigacao = "bifasico";
  else if (/monof[áa]sic/i.test(text)) tipoLigacao = "monofasico";
  if (tipoLigacao) confidence += 5;

  // Classe (residencial, comercial, industrial)
  let classe: string | null = null;
  if (/residencial/i.test(text)) classe = "Residencial";
  else if (/comercial/i.test(text)) classe = "Comercial";
  else if (/industrial/i.test(text)) classe = "Industrial";
  else if (/rural/i.test(text)) classe = "Rural";
  if (classe) confidence += 5;

  // Mês referência
  let mesRef: string | null = null;
  const mesMatch = text.match(/(?:m[êe]s\s*(?:de\s*)?refer[êe]ncia|refer[êe]ncia)[:\s]*((?:JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[\w\/]*\d{2,4}|\d{2}\/\d{4})/i);
  if (mesMatch) {
    mesRef = mesMatch[1];
    raw['mes_match'] = mesMatch[0];
    confidence += 5;
  }

  // Demanda contratada
  let demanda: number | null = null;
  const demandaMatch = text.match(/demanda\s*contratada[:\s]*(\d[\d.,]*)\s*kW/i);
  if (demandaMatch) {
    demanda = parseFloat(demandaMatch[1].replace(/\./g, '').replace(',', '.'));
    raw['demanda_match'] = demandaMatch[0];
    confidence += 5;
  }

  // Estado - try UF codes
  let estado: string | null = null;
  const ufMatch = text.match(/\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
  if (ufMatch) {
    estado = ufMatch[1];
    confidence += 5;
  }

  // Cidade
  let cidade: string | null = null;
  const cidadeMatch = text.match(/(?:cidade|munic[íi]pio)[:\s]*([A-Za-zÀ-ú\s]+?)(?:\s*[-\/]\s*[A-Z]{2}|\n)/i);
  if (cidadeMatch) {
    cidade = cidadeMatch[1].trim();
    raw['cidade_match'] = cidadeMatch[0];
  }

  // Cap confidence at 100
  confidence = Math.min(confidence, 100);

  return {
    concessionaria_nome: concNome,
    cliente_nome: null, // Hard to extract reliably
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
    confidence,
    raw_fields: raw,
  };
}

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Auth check
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get text from request body
    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Campo "text" é obrigatório' }), 
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const extracted = extractFromText(text);

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
