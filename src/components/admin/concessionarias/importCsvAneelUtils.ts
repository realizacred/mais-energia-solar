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
  // Componentes file indicators - match truncated headers too
  if (joined.includes("componente") || joined.includes("componer") || joined.includes("fio b") || joined.includes("fio_b") || joined.includes("dsctipcomponente")) {
    return "componentes";
  }
  return "homologadas";
}

interface ColumnMap {
  [key: string]: number;
}

export function detectColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const patterns: Record<string, RegExp> = {
    sigAgente: /^sigla$|sig\s*agente/i,
    nomAgente: /nom\s*agente|distribuidora/i,
    subgrupo: /sub\s*grupo/i,
    modalidade: /modalidade/i,
    posto: /^posto$/i,
    vlrTUSD: /^tusd$|vlr.*tusd/i,
    vlrTE: /^te$|vlr.*te/i,
    unidade: /^unidade$/i,
    baseTarifaria: /base\s*tarif/i,
    detalhe: /^detalhe$/i,
    vigencia: /inicio\s*vig|dat.*inicio/i,
    classe: /^classe$/i,
    subclasse: /sub\s*classe/i,
    resolucao: /resolu[cç]|^reh$/i,
    // Componentes-specific — handle truncated XLSX headers
    componente: /compone[nrt]|dsc.*tipo.*componente/i,
    vlrComponente: /^valor$|vlr.*componente/i,
  };

  for (const [key, re] of Object.entries(patterns)) {
    const idx = headers.findIndex(h => re.test(h.trim()));
    if (idx >= 0) map[key] = idx;
  }
  return map;
}

export function parseTarifasHomologadas(data: string[] | string[][], headers: string[]): ParsedTarifa[] {
  const cols = detectColumns(headers);
  const isPreParsed = Array.isArray(data[0]);

  if (!cols.sigAgente && !cols.nomAgente) return [];

  const records: ParsedTarifa[] = [];
  const startIdx = isPreParsed ? 0 : 1;
  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) continue;

    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
    if (baseTarifaria && !baseTarifaria.toLowerCase().includes("aplica")) continue;

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
      baseTarifaria,
      detalhe: cols.detalhe !== undefined ? cells[cols.detalhe] || "" : "",
      vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
    });
  }
  return records;
}

export function parseComponentesTarifas(data: string[] | string[][], headers: string[]): ParsedTarifa[] {
  const cols = detectColumns(headers);
  const isPreParsed = Array.isArray(data[0]);

  if (!cols.sigAgente && !cols.nomAgente) return [];

  const records: ParsedTarifa[] = [];
  const startIdx = isPreParsed ? 0 : 1;
  for (let i = startIdx; i < data.length; i++) {
    const cells = isPreParsed ? (data[i] as string[]) : parseCSVLine(data[i] as string);
    if (cells.length < 3) continue;

    const baseTarifaria = cols.baseTarifaria !== undefined ? cells[cols.baseTarifaria] || "" : "";
    if (baseTarifaria && !baseTarifaria.toLowerCase().includes("aplica")) continue;

    const subgrupo = cols.subgrupo !== undefined ? cells[cols.subgrupo] || "" : "";
    if (!subgrupo) continue;

    const componente = cols.componente !== undefined ? cells[cols.componente] || "" : "";
    if (!componente.toLowerCase().includes("fio b") && !componente.toLowerCase().includes("distribuicao") && !componente.toLowerCase().includes("distribuição")) continue;
    if (!componente.toLowerCase().includes("fio b")) continue;

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
      detalhe: cols.detalhe !== undefined ? cells[cols.detalhe] || "" : "",
      vigencia: cols.vigencia !== undefined ? cells[cols.vigencia] || "" : "",
    });
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
