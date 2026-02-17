/**
 * CSV parsing and merging helpers for irradiance data import.
 * Canonical implementation — single source of truth for CSV processing.
 */

// ─── Types ───────────────────────────────────────────────

export interface ParsedCsvRow {
  lat: number;
  lon: number;
  months: number[]; // 12 values, Jan-Dec
}

export interface MergedPoint {
  lat: number;
  lon: number;
  m01: number; m02: number; m03: number; m04: number;
  m05: number; m06: number; m07: number; m08: number;
  m09: number; m10: number; m11: number; m12: number;
  dhi_m01?: number; dhi_m02?: number; dhi_m03?: number; dhi_m04?: number;
  dhi_m05?: number; dhi_m06?: number; dhi_m07?: number; dhi_m08?: number;
  dhi_m09?: number; dhi_m10?: number; dhi_m11?: number; dhi_m12?: number;
  dni_m01?: number; dni_m02?: number; dni_m03?: number; dni_m04?: number;
  dni_m05?: number; dni_m06?: number; dni_m07?: number; dni_m08?: number;
  dni_m09?: number; dni_m10?: number; dni_m11?: number; dni_m12?: number;
  unit: string;
  plane: string;
}

export interface CsvValidationResult {
  ghiCount: number;
  dhiCount: number;
  dniCount: number;
  mergedCount: number;
  unitDetected: string;
  keysMatch: boolean;
  keysDiffPct: number;
  skippedRows: number;
  skippedReasons: Record<string, number>;
  samplePoints: { lat: number; lon: number; jan: number; dec: number }[];
}

// ─── Constants ───────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  // Portuguese 3-letter
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  // English 3-letter
  feb: 1, apr: 3, may: 4, aug: 7, sep: 8, oct: 9, dec: 11,
  // Numeric m01-m12
  m01: 0, m02: 1, m03: 2, m04: 3, m05: 4, m06: 5,
  m07: 6, m08: 7, m09: 8, m10: 9, m11: 10, m12: 11,
  // Full English
  january: 0, february: 1, march: 2, april: 3, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** File name hints for users */
export const FILE_HINTS: Record<string, { fileName: string; description: string }> = {
  ghi: { fileName: "global_horizontal_means", description: "Irradiância global horizontal" },
  dhi: { fileName: "diffuse_means", description: "Irradiância difusa horizontal" },
  dni: { fileName: "direct_normal_means", description: "Irradiância normal direta" },
};

// ─── Parsing ─────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;
  if (tabs > semicolons && tabs > commas) return "\t";
  return semicolons > commas ? ";" : ",";
}

function parseNumber(val: string): number | null {
  if (!val || val.trim() === "" || val.trim() === "-") return null;
  // Handle both comma and dot as decimal separator
  const cleaned = val.trim().replace(",", ".");
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/['"]/g, "")
    .replace(/[_\s]+/g, " ")
    .trim();
}

function findColumnIndex(headers: string[], possibleNames: string[]): number {
  const normalized = headers.map(normalizeHeader);
  const targets = possibleNames.map(normalizeHeader);

  // Priority 1: Exact match
  for (const name of targets) {
    const idx = normalized.indexOf(name);
    if (idx !== -1) return idx;
  }
  // Priority 2: Starts with
  for (const name of targets) {
    const idx = normalized.findIndex(h => h.startsWith(name));
    if (idx !== -1) return idx;
  }
  // Priority 3: Contains
  for (const name of targets) {
    const idx = normalized.findIndex(h => h.includes(name));
    if (idx !== -1) return idx;
  }
  return -1;
}

// Brazil bounding box (generous)
const BRAZIL_BOUNDS = {
  latMin: -35, latMax: 6,
  lonMin: -75, lonMax: -28,
};

export function parseCsvContent(
  content: string,
  label: string
): { rows: ParsedCsvRow[]; unitDetected: string; skippedRows: number; skippedReasons: Record<string, number> } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${label}: arquivo vazio ou apenas cabeçalho`);

  const delimiter = detectDelimiter(lines[0]);
  const rawHeaders = lines[0].split(delimiter).map(h => h.trim());

  // Flexible column detection
  const latIdx = findColumnIndex(rawHeaders, ["lat", "latitude"]);
  const lonIdx = findColumnIndex(rawHeaders, ["lon", "lng", "longitude"]);
  if (latIdx < 0 || lonIdx < 0) {
    throw new Error(`${label}: colunas LAT/LON não encontradas. Headers: ${rawHeaders.join(", ")}`);
  }

  // Detect month columns
  const monthCols: { idx: number; month: number }[] = [];
  for (let i = 0; i < rawHeaders.length; i++) {
    const key = normalizeHeader(rawHeaders[i]);
    const m = MONTH_MAP[key];
    if (m !== undefined) monthCols.push({ idx: i, month: m });
  }
  if (monthCols.length !== 12) {
    throw new Error(
      `${label}: esperado 12 colunas de meses, encontrado ${monthCols.length}. ` +
      `Headers detectados: [${rawHeaders.join(", ")}]. ` +
      `Colunas de mês encontradas: [${monthCols.map(mc => rawHeaders[mc.idx]).join(", ")}]`
    );
  }
  monthCols.sort((a, b) => a.month - b.month);

  const rows: ParsedCsvRow[] = [];
  const allValues: number[] = [];
  let skippedRows = 0;
  const skippedReasons: Record<string, number> = {};

  const addSkip = (reason: string) => {
    skippedRows++;
    skippedReasons[reason] = (skippedReasons[reason] || 0) + 1;
  };

  const maxColIdx = Math.max(latIdx, lonIdx, ...monthCols.map(m => m.idx));

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length <= maxColIdx) {
      addSkip("colunas insuficientes");
      continue;
    }

    const lat = parseNumber(cols[latIdx]);
    const lon = parseNumber(cols[lonIdx]);

    if (lat === null || lon === null) {
      addSkip("lat/lon inválido");
      continue;
    }

    // Generous bounds check — wider than Brazil to allow edge points
    if (lat < BRAZIL_BOUNDS.latMin || lat > BRAZIL_BOUNDS.latMax ||
        lon < BRAZIL_BOUNDS.lonMin || lon > BRAZIL_BOUNDS.lonMax) {
      addSkip("fora do Brasil");
      continue;
    }

    const months: number[] = [];
    let hasInvalid = false;
    for (const mc of monthCols) {
      const val = parseNumber(cols[mc.idx]);
      if (val === null) {
        hasInvalid = true;
        break;
      }
      months.push(val);
    }

    if (hasInvalid) {
      addSkip("valor mensal inválido");
      continue;
    }

    allValues.push(...months);
    rows.push({ lat, lon, months });
  }

  const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
  const unitDetected = avg > 50 ? "Wh/m²/dia → kWh" : "kWh/m²/dia";

  // Auto-convert Wh to kWh
  if (avg > 50) {
    for (const r of rows) {
      r.months = r.months.map(v => v / 1000);
    }
  }

  return { rows, unitDetected, skippedRows, skippedReasons };
}

// ─── Merging ─────────────────────────────────────────────

function coordKey(lat: number, lon: number): string {
  return `${lat.toFixed(4)}|${lon.toFixed(4)}`;
}

export function mergeGhiDhiDni(
  ghiRows: ParsedCsvRow[],
  dhiRows: ParsedCsvRow[] | null,
  dniRows: ParsedCsvRow[] | null
): MergedPoint[] {
  const dhiMap = new Map<string, number[]>();
  if (dhiRows) for (const r of dhiRows) dhiMap.set(coordKey(r.lat, r.lon), r.months);

  const dniMap = new Map<string, number[]>();
  if (dniRows) for (const r of dniRows) dniMap.set(coordKey(r.lat, r.lon), r.months);

  return ghiRows.map(ghi => {
    const k = coordKey(ghi.lat, ghi.lon);
    const dhi = dhiMap.get(k);
    const dni = dniMap.get(k);

    const point: MergedPoint = {
      lat: ghi.lat, lon: ghi.lon,
      m01: ghi.months[0], m02: ghi.months[1], m03: ghi.months[2], m04: ghi.months[3],
      m05: ghi.months[4], m06: ghi.months[5], m07: ghi.months[6], m08: ghi.months[7],
      m09: ghi.months[8], m10: ghi.months[9], m11: ghi.months[10], m12: ghi.months[11],
      unit: "kwh_m2_day",
      plane: "horizontal",
    };

    if (dhi) {
      point.dhi_m01 = dhi[0]; point.dhi_m02 = dhi[1]; point.dhi_m03 = dhi[2]; point.dhi_m04 = dhi[3];
      point.dhi_m05 = dhi[4]; point.dhi_m06 = dhi[5]; point.dhi_m07 = dhi[6]; point.dhi_m08 = dhi[7];
      point.dhi_m09 = dhi[8]; point.dhi_m10 = dhi[9]; point.dhi_m11 = dhi[10]; point.dhi_m12 = dhi[11];
    }
    if (dni) {
      point.dni_m01 = dni[0]; point.dni_m02 = dni[1]; point.dni_m03 = dni[2]; point.dni_m04 = dni[3];
      point.dni_m05 = dni[4]; point.dni_m06 = dni[5]; point.dni_m07 = dni[6]; point.dni_m08 = dni[7];
      point.dni_m09 = dni[8]; point.dni_m10 = dni[9]; point.dni_m11 = dni[10]; point.dni_m12 = dni[11];
    }

    return point;
  });
}

export function validateCsvFiles(
  ghiRows: ParsedCsvRow[],
  dhiRows: ParsedCsvRow[] | null,
  dniRows: ParsedCsvRow[] | null,
  merged: MergedPoint[],
  skippedRows = 0,
  skippedReasons: Record<string, number> = {}
): CsvValidationResult {
  const ghiKeys = new Set(ghiRows.map(r => coordKey(r.lat, r.lon)));
  const dhiKeys = dhiRows ? new Set(dhiRows.map(r => coordKey(r.lat, r.lon))) : new Set<string>();
  const dniKeys = dniRows ? new Set(dniRows.map(r => coordKey(r.lat, r.lon))) : new Set<string>();

  const maxKeys = Math.max(ghiKeys.size, dhiKeys.size || 0, dniKeys.size || 0);
  const allMatch = dhiRows || dniRows
    ? [...ghiKeys].filter(k => (!dhiRows || dhiKeys.has(k)) && (!dniRows || dniKeys.has(k))).length
    : ghiKeys.size;
  const diffPct = maxKeys > 0 ? ((maxKeys - allMatch) / maxKeys) * 100 : 0;

  return {
    ghiCount: ghiRows.length,
    dhiCount: dhiRows?.length ?? 0,
    dniCount: dniRows?.length ?? 0,
    mergedCount: merged.length,
    unitDetected: "kWh/m²/dia",
    keysMatch: diffPct <= 0.5,
    keysDiffPct: diffPct,
    skippedRows,
    skippedReasons,
    samplePoints: merged.slice(0, 3).map(p => ({
      lat: p.lat, lon: p.lon, jan: p.m01, dec: p.m12,
    })),
  };
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export function generateVersionTag(prefix = "atlas"): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `${prefix}-import-${y}${m}${d}-${h}${min}`;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error(`Falha ao ler ${file.name}`));
    reader.readAsText(file);
  });
}
