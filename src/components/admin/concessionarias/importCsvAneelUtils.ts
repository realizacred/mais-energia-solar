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
    sigAgente:     ["sigla", "sigla agente", "sigagente", "sig agente", "sig"],
    nomAgente:     ["nom agente", "nomagente", "distribuidora", "nome agente", "nome da distribuidora"],
    subgrupo:      ["subgrupo", "sub grupo", "sub_grupo"],
    modalidade:    ["modalidade", "modalidade tarifaria"],
    posto:         ["posto", "posto tarifario", "posto tarifário"],
    vlrTUSD:       ["tusd", "vlr tusd", "vlrtusd", "valor tusd"],
    vlrTE:         ["vlr te", "vlrte", "valor te"],
    unidade:       ["unidade", "und"],
    baseTarifaria: ["base tarifaria", "basetarifaria", "base tarif"],
    detalhe:       ["detalhe", "detalhe tarifa"],
    vigencia:      ["inicio vigencia", "iniciovigencia", "dat inicio", "data inicio vigencia", "inicio da vigencia"],
    fimVigencia:   ["fim vigencia", "fimvigencia", "fim da vigencia", "data fim vigencia"],
    classe:        ["classe"],
    subclasse:     ["subclasse", "sub classe"],
    resolucao:     ["resolucao", "resolucao aneel", "reh"],
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

  const debugSkipReasons = { noBase: 0, noSub: 0, shortRow: 0, total: 0 };
  const records: ParsedTarifa[] = [];
  const startIdx = isPreParsed ? 0 : 1;

  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) { debugSkipReasons.shortRow++; continue; }
    debugSkipReasons.total++;

    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
    // Accept: "Tarifa de Aplicação", "Base Econômica", or empty (no filter)
    // Only REJECT if baseTarifaria is present AND is something truly irrelevant
    if (baseTarifaria) {
      const baseNorm = norm(baseTarifaria);
      const isAplicacao = baseNorm.includes("aplica") || baseNorm.includes("aplicacao");
      const isEconomica = baseNorm.includes("econom");
      const isBase = baseNorm.includes("base") || baseNorm.includes("tarifa");
      // Accept aplicação, econômica, or anything that looks tariff-related
      if (!isAplicacao && !isEconomica && !isBase) {
        debugSkipReasons.noBase++;
        continue;
      }
    }

    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) { debugSkipReasons.noSub++; continue; }

    records.push({
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

  console.log("[ANEEL Homol] Debug skip reasons:", debugSkipReasons, "Records found:", records.length);
  console.log("[ANEEL Homol] Column map:", cols);

  // Fallback: if zero records but rows existed, retry without ANY filter
  if (records.length === 0 && (debugSkipReasons.noBase > 0 || debugSkipReasons.noSub > 0)) {
    console.warn("[ANEEL Homol] All rows filtered. Retrying without baseTarifaria filter...");
    return parseTarifasNoFilter(data, cols, isPreParsed, startIdx);
  }

  return records;
}

/** Fallback parser that skips the baseTarifaria filter */
function parseTarifasNoFilter(
  data: string[] | string[][],
  cols: Record<string, number>,
  isPreParsed: boolean,
  startIdx: number,
): ParsedTarifa[] {
  const records: ParsedTarifa[] = [];
  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) continue;

    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) continue;

    records.push({
      sigAgente: cols.sigAgente !== undefined ? cells[cols.sigAgente] || "" : "",
      nomAgente: cols.nomAgente !== undefined ? cells[cols.nomAgente] || "" : "",
      subgrupo,
      modalidade: cols.modalidade !== undefined ? cells[cols.modalidade] || "" : "",
      posto: cols.posto !== undefined ? cells[cols.posto] || "" : "",
      vlrTUSD: cols.vlrTUSD !== undefined ? parseNumber(cells[cols.vlrTUSD]) : 0,
      vlrTE: cols.vlrTE !== undefined ? parseNumber(cells[cols.vlrTE]) : 0,
      unidade: cols.unidade !== undefined ? cells[cols.unidade] || "" : "",
      baseTarifaria: cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "",
      detalhe: cols.detalhe !== undefined ? cells[cols.detalhe] || "" : "",
      vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
    });
  }
  console.log("[ANEEL Homol] Fallback (no filter) records:", records.length);
  return records;
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
  let debugSkipReasons = { noBase: 0, noSub: 0, noComp: 0, noFioB: 0, total: 0, accepted: 0 };
  
  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) continue;
    debugSkipReasons.total++;

    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
    // Accept: aplicação, econômica, or empty — same logic as homologadas
    if (baseTarifaria) {
      const baseNorm = norm(baseTarifaria);
      const isAplicacao = baseNorm.includes("aplica") || baseNorm.includes("aplicacao");
      const isEconomica = baseNorm.includes("econom");
      const isBase = baseNorm.includes("base") || baseNorm.includes("tarifa");
      if (!isAplicacao && !isEconomica && !isBase) {
        debugSkipReasons.noBase++;
        continue;
      }
    }

    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) {
      debugSkipReasons.noSub++;
      continue;
    }

    // For componentes: accept ALL component types, not just "fio b"
    // The user may want to import CVA, CDE, Proinfa, etc.
    // We'll tag what component it is so downstream can decide
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
  
  console.log("[ANEEL Comp] Debug skip reasons:", debugSkipReasons, "Records found:", records.length);
  
  // Fallback: if still zero, retry without any filter
  if (records.length === 0 && debugSkipReasons.total > 0) {
    console.warn("[ANEEL Comp] All rows filtered. Retrying without filters...");
    return parseTarifasNoFilter(data, cols, isPreParsed, startIdx);
  }
  
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
  
  const headers = (raw[0] as any[]).map(c => String(c ?? "").trim());
  const rows = raw.slice(1)
    .filter(row => (row as any[]).some(c => String(c ?? "").trim() !== ""))
    .map(row => (row as any[]).map(c => String(c ?? "").trim()));
  
  return { headers, rows };
}
