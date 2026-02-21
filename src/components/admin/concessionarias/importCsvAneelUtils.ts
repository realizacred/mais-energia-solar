import * as XLSX from "xlsx";

export interface ParsedTarifa {
  sigAgente: string;
  nomAgente: string;
  subgrupo: string;
  modalidade: string;
  posto: string;
  vlrTUSD: number;
  vlrTE: number;
  vlrFioB?: number;
  unidade: string;
  baseTarifaria: string;
  detalhe: string;
  vigencia: string;
}

export interface ImportResult {
  matched: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type FileType = "homologadas" | "componentes";

// Normalise string for fuzzy matching
export function norm(s: string): string {
  return s.trim().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

/** Normalize for matching: also strips hyphens, slashes, dots, parentheses */
export function normMatch(s: string): string {
  return norm(s).replace(/[-\/\.\(\)]/g, " ").replace(/\s+/g, " ").trim();
}

export function stripSuffixes(s: string): string {
  return s.replace(/\b(s\.?a\.?|s\/a|ltda|cia|distribui[cç][aã]o|energia|el[eé]trica|distribuidora|de)\b/gi, "").trim().replace(/\s+/g, " ");
}

/**
 * Comprehensive ANEEL agent name → DB concessionária alias map.
 * Keys are normMatch'd ANEEL names, values are normMatch'd DB names or siglas.
 * This handles cases where ANEEL uses completely different names than the DB.
 */
export const ANEEL_AGENT_ALIASES: Record<string, string[]> = {
  // Neoenergia group — ANEEL uses state names, DB uses brand names
  "neoenergia pernambuco": ["neoenergia celpe", "celpe"],
  "neoenergia bahia": ["neoenergia coelba", "coelba"],
  "neoenergia rio grande do norte": ["neoenergia cosern", "cosern"],
  "neoenergia rn": ["neoenergia cosern", "cosern"],
  "neoenergia brasilia": ["neoenergia brasilia ceb", "ceb"],
  "neoenergia distrito federal": ["neoenergia brasilia ceb", "ceb"],
  "neoenergia df": ["neoenergia brasilia ceb", "ceb"],
  "ceb dis": ["neoenergia brasilia ceb", "ceb"],
  "ceb d": ["neoenergia brasilia ceb", "ceb"],
  "celpe": ["neoenergia celpe", "celpe"],
  "coelba": ["neoenergia coelba", "coelba"],
  "cosern": ["neoenergia cosern", "cosern"],

  // Equatorial group
  "equatorial al": ["equatorial alagoas ceal", "ceal"],
  "equatorial alagoas": ["equatorial alagoas ceal", "ceal"],
  "equatorial go": ["equatorial goias celg", "celg"],
  "equatorial goias": ["equatorial goias celg", "celg"],
  "equatorial ma": ["equatorial maranhao cemar", "cemar"],
  "equatorial maranhao": ["equatorial maranhao cemar", "cemar"],
  "equatorial pa": ["equatorial para celpa", "celpa"],
  "equatorial para": ["equatorial para celpa", "celpa"],
  "equatorial pi": ["equatorial piaui cepisa", "cepisa"],
  "equatorial piaui": ["equatorial piaui cepisa", "cepisa"],
  "equatorial amapa": ["cea equatorial", "cea"],
  "cea equatorial": ["cea equatorial", "cea"],
  "ceee d": ["ceee equatorial", "ceee"],
  "ceee dis": ["ceee equatorial", "ceee"],

  // Enel group
  "enel ce": ["enel ceara coelce", "enel ce"],
  "enel ceara": ["enel ceara coelce", "enel ce"],
  "coelce": ["enel ceara coelce", "enel ce"],
  "enel rj": ["enel distribuicao rio", "enel rj"],
  "enel rio": ["enel distribuicao rio", "enel rj"],
  "enel go": ["enel goias", "enel go", "enel distribuicao goias"],
  "enel distribuicao goias": ["enel goias", "enel go"],
  "enel sp": ["enel sao paulo eletropaulo", "enel sp"],
  "eletropaulo": ["enel sao paulo eletropaulo", "enel sp"],
  "light": ["enel rio light", "light"],
  "light s a": ["enel rio light", "light"],
  "light ses": ["enel rio light", "light"],

  // EDP group — ANEEL uses "EDP ES", DB has "EDP-ES" sigla
  "edp es": ["edp espirito santo escelsa", "edp es"],
  "escelsa": ["edp espirito santo escelsa", "edp es"],
  "edp sp": ["edp sao paulo bandeirante", "edp sp"],
  "bandeirante": ["edp sao paulo bandeirante", "edp sp"],

  // Energisa group — ANEEL uses state abbreviations
  "energisa ac": ["energisa acre", "eac"],
  "energisa mg": ["energisa minas gerais", "emg", "energisa nova friburgo", "enf"],
  "energisa minas gerais": ["energisa minas gerais", "emg", "energisa nova friburgo"],
  "energisa nova friburgo": ["energisa minas gerais", "emg"],
  "energisa ms": ["energisa ms", "ems"],
  "energisa mt": ["energisa mt", "emt"],
  "energisa pb": ["energisa paraiba", "epb"],
  "energisa paraiba": ["energisa paraiba", "epb"],
  "energisa pr": ["energisa parana", "epr"],
  "energisa parana": ["energisa parana", "epr"],
  "energisa ro": ["energisa rondonia", "ero"],
  "energisa rondonia": ["energisa rondonia", "ero"],
  "energisa se": ["energisa sergipe", "ese"],
  "energisa sergipe": ["energisa sergipe", "ese"],
  "energisa to": ["energisa tocantins", "eto"],
  "energisa tocantins": ["energisa tocantins", "eto"],

  // CPFL group
  "cpfl paulista": ["cpfl paulista", "cpfl"],
  "cpfl piratininga": ["cpfl piratininga", "cpfl pir"],

  // CEMIG
  "cemig d": ["cemig distribuicao", "cemig"],
  "cemig dis": ["cemig distribuicao", "cemig"],
  "cemig distribuicao": ["cemig distribuicao", "cemig"],

  // Copel
  "copel dis": ["copel distribuicao", "copel"],
  "copel distribuicao": ["copel distribuicao", "copel"],
  "copel d": ["copel distribuicao", "copel"],

  // Celesc
  "celesc dis": ["celesc distribuicao", "celesc"],
  "celesc d": ["celesc distribuicao", "celesc"],

  // Elektro
  "elektro": ["elektro", "elektro"],
  "neoenergia elektro": ["neoenergia elektro", "neo elk"],
  "elektro redes": ["neoenergia elektro", "neo elk"],

  // RGE
  "rge sul": ["rge sul", "rge"],
  "rge": ["rge sul", "rge"],

  // Roraima
  "roraima energia": ["roraima energia", "rre"],

  // Amazonas
  "amazonas energia": ["amazonas energia", "ame"],
  "ame": ["amazonas energia", "ame"],
};

export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === ";" || char === ",") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

export function parseNumber(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(",", ".")) || 0;
}

/**
 * Detect file type based on headers.
 * "Componentes" files have columns like "Componente" or "TUSD FIO B".
 * "Homologadas" files have TE/TUSD total columns.
 */
export function detectFileType(headers: string[]): FileType {
  const joined = headers.map(h => norm(h)).join("|");
  if (joined.includes("componente") || joined.includes("componer") || joined.includes("fio b") || joined.includes("fio_b") || joined.includes("dsctipcomponente") || joined.includes("tipo componente")) {
    return "componentes";
  }
  return "homologadas";
}

interface ColumnMap {
  [key: string]: number;
}

/**
 * Flexible column detection with accent-normalized matching.
 * Uses a three-tier strategy: exact → starts-with → contains.
 */
function findColumnIndex(normalizedHeaders: string[], aliases: string[]): number {
  const normAliases = aliases.map(a => norm(a));

  // Priority 1: exact match
  for (const alias of normAliases) {
    const idx = normalizedHeaders.indexOf(alias);
    if (idx !== -1) return idx;
  }

  // Priority 2: starts-with
  for (const alias of normAliases) {
    const idx = normalizedHeaders.findIndex(h => h.startsWith(alias));
    if (idx !== -1) return idx;
  }

  // Priority 3: header contains alias
  for (const alias of normAliases) {
    if (alias.length < 3) continue;
    const idx = normalizedHeaders.findIndex(h => h.includes(alias));
    if (idx !== -1) return idx;
  }

  // Priority 4: alias contains header (reverse contains)
  for (const alias of normAliases) {
    if (alias.length < 4) continue;
    const idx = normalizedHeaders.findIndex(h => h.length >= 3 && alias.includes(h));
    if (idx !== -1) return idx;
  }

  return -1;
}

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const normalizedHeaders = headers.map(h => norm(h));

  const columnAliases: Record<string, string[]> = {
    sigAgente:     [
      "sigla", "sigla agente", "sigagente", "sig agente", "sig",
      "sigla do agente", "sigla da distribuidora", "sigla distribuidora",
      "codigo agente", "cod agente", "codagente",
    ],
    nomAgente:     [
      "nom agente", "nomagente", "distribuidora", "nome agente",
      "nome da distribuidora", "nome do agente", "agente",
      "nome distribuidora", "razao social", "empresa",
      "concessionaria", "nome concessionaria",
    ],
    subgrupo:      [
      "subgrupo", "sub grupo", "sub_grupo", "dscsubgrupo", "dsc sub grupo",
      "grupo tarifario", "classe", "dsc subgrupo",
    ],
    modalidade:    [
      "modalidade", "modalidade tarifaria", "dscmodalidadetarifaria",
      "modalidade tarifária", "dsc modalidade tarifaria",
      "modalidade_tarifaria", "mod tarifaria",
    ],
    posto:         [
      "posto", "posto tarifario", "posto tarifário",
      "nompostotarifario", "nom posto tarifario",
      "posto_tarifario", "dsc posto tarifario",
    ],
    vlrTUSD:       [
      "tusd", "vlr tusd", "vlrtusd", "valor tusd",
      "vlr_tusd", "valor_tusd", "tarifa tusd",
    ],
    vlrTE:         [
      "vlr te", "vlrte", "valor te", "vlr_te", "valor_te",
      "tarifa te", "te r$/mwh", "te (r$/mwh)",
    ],
    unidade:       [
      "unidade", "und", "dscunidade", "dsc unidade",
      "unid", "un", "unidade medida",
    ],
    baseTarifaria: [
      "base tarifaria", "basetarifaria", "base tarif",
      "dscbasetarifaria", "dsc base tarifaria",
      "base_tarifaria", "tipo tarifa",
    ],
    detalhe:       [
      "detalhe", "detalhe tarifa", "dscdetalhe", "dsc detalhe",
      "detalhamento", "detalhe_tarifa",
    ],
    vigencia:      [
      "inicio vigencia", "iniciovigencia", "dat inicio", "data inicio vigencia",
      "inicio da vigencia", "datiniciovigencia", "dat inicio vigencia",
      "inicio_vigencia", "data inicio", "dt inicio vigencia",
      "data vigencia", "vigencia",
    ],
    fimVigencia:   [
      "fim vigencia", "fimvigencia", "fim da vigencia",
      "data fim vigencia", "datfimvigencia", "dat fim vigencia",
      "fim_vigencia", "data fim", "dt fim vigencia",
    ],
    classe:        ["classe", "dscclasse", "dsc classe"],
    subclasse:     ["subclasse", "sub classe", "dscsubclasse"],
    resolucao:     ["resolucao", "resolucao aneel", "reh", "dscreh"],
    acessante:     ["acessante"],
    // Componentes-specific
    componente:    [
      "componente", "tipo componente", "dsctipcomponente",
      "dsc tipo componente", "tipo_componente",
      "desc componente", "descricao componente",
    ],
    vlrComponente: [
      "valor", "vlr componente", "vlrcomponente",
      "valor componente", "vlr_componente",
      "valor_componente", "valor r$",
    ],
  };

  for (const [key, aliases] of Object.entries(columnAliases)) {
    const idx = findColumnIndex(normalizedHeaders, aliases);
    if (idx >= 0) map[key] = idx;
  }

  // If vlrTE wasn't found via specific aliases, try exact "te" header match
  if (map.vlrTE === undefined) {
    const teIdx = normalizedHeaders.indexOf("te");
    if (teIdx !== -1) map.vlrTE = teIdx;
  }

  // Safety: if vlrTE accidentally matched the same column as vlrTUSD, remove it
  if (map.vlrTE !== undefined && map.vlrTUSD !== undefined && map.vlrTE === map.vlrTUSD) {
    delete map.vlrTE;
  }

  // Safety: if vlrComponente matched the same column as vlrTUSD or vlrTE, keep vlrComponente
  // (it's more specific for componentes files)

  console.log("[ANEEL detectColumns] Normalized headers:", normalizedHeaders);
  console.log("[ANEEL detectColumns] Column map result:", map);

  return map;
}

export function parseTarifasHomologadas(data: string[] | string[][], headers: string[]): ParsedTarifa[] {
  const cols = detectColumns(headers);
  const isPreParsed = Array.isArray(data[0]);

  if (!cols.sigAgente && !cols.nomAgente) {
    console.warn("[ANEEL Homol] No sigAgente/nomAgente column found. Headers:", headers);
    
    // Content-based fallback: try to find agent column by scanning data
    const sampleRows = (data.slice(0, 10) as string[][]);
    for (let colIdx = 0; colIdx < (sampleRows[0]?.length || 0); colIdx++) {
      const values = sampleRows.map(r => r[colIdx] || "").filter(Boolean);
      // Agent columns typically have 2-10 char abbreviations
      if (values.length > 0 && values.every(v => v.length >= 2 && v.length <= 50)) {
        // Check if any value looks like a known energy company abbreviation
        if (values.some(v => /^[A-Z]{2,10}$/i.test(v.trim()))) {
          cols.sigAgente = colIdx;
          console.log("[ANEEL Homol] Content-based fallback: sigAgente at col", colIdx);
          break;
        }
      }
    }
    
    if (cols.sigAgente === undefined && cols.nomAgente === undefined) {
      return [];
    }
  }

  // Content-based fallback for subgrupo
  if (cols.subgrupo === undefined) {
    const sampleRows = (isPreParsed ? data.slice(0, 20) : data.slice(1, 21)) as string[][];
    for (let colIdx = 0; colIdx < (sampleRows[0]?.length || 0); colIdx++) {
      const values = sampleRows.map(r => r[colIdx] || "").filter(Boolean);
      // Subgrupo values match pattern like A1, A2, A3, A3a, A4, AS, B1, B2, B3
      const subgrupoPattern = /^(A\d[a-z]?|AS|B\d)$/i;
      const matchCount = values.filter(v => subgrupoPattern.test(v.trim())).length;
      if (matchCount >= 3) {
        cols.subgrupo = colIdx;
        console.log("[ANEEL Homol] Content-based fallback: subgrupo at col", colIdx, "matched", matchCount, "values");
        break;
      }
    }
  }

  const debugSkipReasons = { noSub: 0, shortRow: 0, total: 0, filteredBase: 0, filteredDetalhe: 0 };
  const allRecords: ParsedTarifa[] = [];
  const startIdx = isPreParsed ? 0 : 1;

  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) { debugSkipReasons.shortRow++; continue; }
    debugSkipReasons.total++;

    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) { debugSkipReasons.noSub++; continue; }

    allRecords.push({
      sigAgente: cols.sigAgente !== undefined ? cells[cols.sigAgente] || "" : "",
      nomAgente: cols.nomAgente !== undefined ? cells[cols.nomAgente] || "" : "",
      subgrupo,
      modalidade: cols.modalidade !== undefined ? cells[cols.modalidade] || "" : "",
      posto: cols.posto !== undefined ? cells[cols.posto] || "" : "",
      vlrTUSD: cols.vlrTUSD !== undefined ? parseNumber(cells[cols.vlrTUSD]) : 0,
      vlrTE: cols.vlrTE !== undefined ? parseNumber(cells[cols.vlrTE]) : 0,
      unidade: cols.unidade !== undefined ? cells[cols.unidade] || "" : "",
      baseTarifaria,
      detalhe: cols.detalhe !== undefined ? cells[cols.detalhe] || "" : "",
      vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
    });
  }

  // Smart filtering: prefer "Tarifa de Aplicação" over "Base Econômica"
  const hasAplicacao = allRecords.some(r => norm(r.baseTarifaria).includes("aplica"));
  let filtered = allRecords;
  if (hasAplicacao) {
    filtered = filtered.filter(r => norm(r.baseTarifaria).includes("aplica"));
    debugSkipReasons.filteredBase = allRecords.length - filtered.length;
  }

  // Smart filtering: prefer "Não se aplica" detalhe (standard tariffs) over APE/SCEE
  const detalhes = new Set(filtered.map(r => norm(r.detalhe)));
  const hasNaoAplica = detalhes.has("nao se aplica") || detalhes.has(norm("Não se aplica"));
  if (hasNaoAplica && detalhes.size > 1) {
    const before = filtered.length;
    filtered = filtered.filter(r => {
      const nd = norm(r.detalhe);
      return nd === "nao se aplica" || nd === "" || nd === norm("Não se aplica");
    });
    debugSkipReasons.filteredDetalhe = before - filtered.length;
  }

  console.log("[ANEEL Homol] Debug:", debugSkipReasons, "Records found:", filtered.length, "Column map:", cols);
  console.log("[ANEEL Homol] Sample baseTarifaria values:", [...new Set(allRecords.slice(0, 100).map(r => r.baseTarifaria))]);
  console.log("[ANEEL Homol] Sample detalhe values:", [...new Set(allRecords.slice(0, 100).map(r => r.detalhe))]);

  return filtered;
}


export function parseComponentesTarifas(data: string[] | string[][], headers: string[]): ParsedTarifa[] {
  const cols = detectColumns(headers);
  const isPreParsed = Array.isArray(data[0]);

  if (!cols.sigAgente && !cols.nomAgente) {
    console.warn("[ANEEL Comp] No sigAgente/nomAgente column found. Headers:", headers);
    
    // Content-based fallback for agent
    const sampleRows = (data.slice(0, 10) as string[][]);
    for (let colIdx = 0; colIdx < (sampleRows[0]?.length || 0); colIdx++) {
      const values = sampleRows.map(r => r[colIdx] || "").filter(Boolean);
      if (values.length > 0 && values.some(v => /^[A-Z]{2,10}$/i.test(v.trim()))) {
        cols.sigAgente = colIdx;
        console.log("[ANEEL Comp] Content-based fallback: sigAgente at col", colIdx);
        break;
      }
    }
    
    if (cols.sigAgente === undefined && cols.nomAgente === undefined) {
      return [];
    }
  }

  // Content-based fallback for subgrupo
  if (cols.subgrupo === undefined) {
    const sampleRows = (isPreParsed ? data.slice(0, 20) : data.slice(1, 21)) as string[][];
    for (let colIdx = 0; colIdx < (sampleRows[0]?.length || 0); colIdx++) {
      const values = sampleRows.map(r => r[colIdx] || "").filter(Boolean);
      const subgrupoPattern = /^(A\d[a-z]?|AS|B\d)$/i;
      const matchCount = values.filter(v => subgrupoPattern.test(v.trim())).length;
      if (matchCount >= 3) {
        cols.subgrupo = colIdx;
        console.log("[ANEEL Comp] Content-based fallback: subgrupo at col", colIdx);
        break;
      }
    }
  }

  const records: ParsedTarifa[] = [];
  const startIdx = isPreParsed ? 0 : 1;
  let debugSkipReasons = { noSub: 0, total: 0, accepted: 0 };
  
  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) continue;
    debugSkipReasons.total++;

    // NO baseTarifaria filtering — accept all rows
    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";

    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) {
      debugSkipReasons.noSub++;
      continue;
    }

    let componenteLabel = "";
    if (cols.componente !== undefined) {
      componenteLabel = cells[cols.componente] || "";
    }

    debugSkipReasons.accepted++;

    const vlrComponente = cols.vlrComponente !== undefined ? parseNumber(cells[cols.vlrComponente]) : 0;
    const vlrTUSD = cols.vlrTUSD !== undefined ? parseNumber(cells[cols.vlrTUSD]) : 0;

    records.push({
      sigAgente: cols.sigAgente !== undefined ? cells[cols.sigAgente] || "" : "",
      nomAgente: cols.nomAgente !== undefined ? cells[cols.nomAgente] || "" : "",
      subgrupo,
      modalidade: cols.modalidade !== undefined ? cells[cols.modalidade] || "" : "",
      posto: cols.posto !== undefined ? cells[cols.posto] || "" : "",
      vlrTUSD: vlrTUSD,
      vlrTE: cols.vlrTE !== undefined ? parseNumber(cells[cols.vlrTE]) : 0,
      vlrFioB: vlrComponente || vlrTUSD,
      unidade: cols.unidade !== undefined ? cells[cols.unidade] || "" : "",
      baseTarifaria,
      detalhe: componenteLabel || (cols.detalhe !== undefined ? cells[cols.detalhe] || "" : ""),
      vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
    });
  }
  
  console.log("[ANEEL Comp] Debug:", debugSkipReasons, "Records found:", records.length);
  
  return records;
}

/**
 * Parse an XLSX file (ArrayBuffer) and return headers + pre-parsed rows.
 * Uses sheet_to_json to avoid CSV intermediary issues (commas in values).
 */
export function parseXlsxFile(buffer: ArrayBuffer): { headers: string[]; rows: string[][] } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  
  // Get raw arrays — header:1 means first row is data, not keys
  const raw = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: "" });
  
  if (raw.length < 2) return { headers: [], rows: [] };
  
  // Smart header detection: scan first 30 rows to find the actual header row
  const HEADER_KEYWORDS = [
    "agente", "subgrupo", "tusd", "vigencia", "modalidade",
    "distribuidora", "tarifa", "componente", "valor", "posto",
    "classe", "unidade", "detalhe", "resolucao",
  ];
  let headerRowIndex = 0;
  let bestMatchCount = 0;
  
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const rowCells = (raw[i] as any[]).map(c => norm(String(c ?? "")));
    const matchCount = HEADER_KEYWORDS.filter(kw => rowCells.some(cell => cell.includes(kw))).length;
    if (matchCount > bestMatchCount) {
      bestMatchCount = matchCount;
      headerRowIndex = i;
    }
    if (matchCount >= 4) {
      console.log(`[ANEEL XLSX] Header found at row ${i + 1} (matched ${matchCount} keywords)`);
      break;
    }
  }
  
  if (bestMatchCount < 2) {
    // Fallback: use first non-empty row as header
    console.warn(`[ANEEL XLSX] Low header confidence (${bestMatchCount} keywords). Using row ${headerRowIndex + 1} as header.`);
  }
  
  const headers = (raw[headerRowIndex] as any[]).map(c => String(c ?? "").trim());
  const rows = raw.slice(headerRowIndex + 1)
    .filter(row => (row as any[]).some(c => String(c ?? "").trim() !== ""))
    .map(row => (row as any[]).map(c => String(c ?? "").trim()));
  
  console.log(`[ANEEL XLSX] Headers detected (row ${headerRowIndex + 1}):`, headers);
  console.log(`[ANEEL XLSX] Total data rows: ${rows.length}`);
  if (rows.length > 0) {
    console.log(`[ANEEL XLSX] Sample row 1:`, rows[0]);
  }
  
  return { headers, rows };
}
