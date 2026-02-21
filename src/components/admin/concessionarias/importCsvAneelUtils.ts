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

export function stripSuffixes(s: string): string {
  return s.replace(/\b(s\.?a\.?|s\/a|ltda|cia|distribui[cç][aã]o|energia|el[eé]trica|distribuidora|de)\b/gi, "").trim().replace(/\s+/g, " ");
}

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

  // Priority 3: contains
  for (const alias of normAliases) {
    if (alias.length < 3) continue; // skip very short aliases for contains
    const idx = normalizedHeaders.findIndex(h => h.includes(alias));
    if (idx !== -1) return idx;
  }

  return -1;
}

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const normalizedHeaders = headers.map(h => norm(h));

  const columnAliases: Record<string, string[]> = {
    sigAgente:     ["sigla", "sigla agente", "sigagente", "sig agente", "sig", "sigla do agente"],
    nomAgente:     ["nom agente", "nomagente", "distribuidora", "nome agente", "nome da distribuidora", "nome do agente", "agente"],
    subgrupo:      ["subgrupo", "sub grupo", "sub_grupo", "dscsubgrupo", "dsc sub grupo"],
    modalidade:    ["modalidade", "modalidade tarifaria", "dscmodalidadetarifaria", "modalidade tarifária"],
    posto:         ["posto", "posto tarifario", "posto tarifário", "nompostotarifario", "nom posto tarifario"],
    vlrTUSD:       ["tusd", "vlr tusd", "vlrtusd", "valor tusd"],
    vlrTE:         ["vlr te", "vlrte", "valor te"],
    unidade:       ["unidade", "und", "dscunidade"],
    baseTarifaria: ["base tarifaria", "basetarifaria", "base tarif", "dscbasetarifaria", "dsc base tarifaria"],
    detalhe:       ["detalhe", "detalhe tarifa", "dscdetalhe", "dsc detalhe"],
    vigencia:      ["inicio vigencia", "iniciovigencia", "dat inicio", "data inicio vigencia", "inicio da vigencia", "datiniciovigencia", "dat inicio vigencia"],
    fimVigencia:   ["fim vigencia", "fimvigencia", "fim da vigencia", "data fim vigencia", "datfimvigencia", "dat fim vigencia"],
    classe:        ["classe", "dscclasse"],
    subclasse:     ["subclasse", "sub classe", "dscsubclasse"],
    resolucao:     ["resolucao", "resolucao aneel", "reh", "dscreh"],
    acessante:     ["acessante"],
    // Componentes-specific
    componente:    ["componente", "tipo componente", "dsctipcomponente", "dsc tipo componente"],
    vlrComponente: ["valor", "vlr componente", "vlrcomponente"],
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

  return map;
}

export function parseTarifasHomologadas(data: string[] | string[][], headers: string[]): ParsedTarifa[] {
  const cols = detectColumns(headers);
  const isPreParsed = Array.isArray(data[0]);

  if (!cols.sigAgente && !cols.nomAgente) {
    console.warn("[ANEEL Homol] No sigAgente/nomAgente column found. Headers:", headers);
    return [];
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
    return [];
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
  
  // Smart header detection: scan first 10 rows to find the actual header row
  // A header row should contain known column keywords
  const HEADER_KEYWORDS = ["sigla", "agente", "subgrupo", "tusd", "vigencia", "modalidade", "distribuidora", "tarifa"];
  let headerRowIndex = 0;
  
  for (let i = 0; i < Math.min(10, raw.length); i++) {
    const rowCells = (raw[i] as any[]).map(c => norm(String(c ?? "")));
    const matchCount = HEADER_KEYWORDS.filter(kw => rowCells.some(cell => cell.includes(kw))).length;
    if (matchCount >= 3) {
      headerRowIndex = i;
      console.log(`[ANEEL XLSX] Header found at row ${i + 1} (matched ${matchCount} keywords)`);
      break;
    }
  }
  
  const headers = (raw[headerRowIndex] as any[]).map(c => String(c ?? "").trim());
  const rows = raw.slice(headerRowIndex + 1)
    .filter(row => (row as any[]).some(c => String(c ?? "").trim() !== ""))
    .map(row => (row as any[]).map(c => String(c ?? "").trim()));
  
  console.log(`[ANEEL XLSX] Headers detected (row ${headerRowIndex + 1}):`, headers);
  console.log(`[ANEEL XLSX] Data rows: ${rows.length}`);
  
  return { headers, rows };
}
