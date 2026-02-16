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
  samplePoints: { lat: number; lon: number; jan: number; dec: number }[];
}

// ─── Constants ───────────────────────────────────────────

const MONTH_MAP: Record<string, number> = {
  jan: 0, fev: 1, mar: 2, abr: 3, mai: 4, jun: 5,
  jul: 6, ago: 7, set: 8, out: 9, nov: 10, dez: 11,
  m01: 0, m02: 1, m03: 2, m04: 3, m05: 4, m06: 5,
  m07: 6, m08: 7, m09: 8, m10: 9, m11: 10, m12: 11,
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

// ─── Parsing ─────────────────────────────────────────────

function detectDelimiter(firstLine: string): string {
  return (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ";" : ",";
}

function parseNumber(val: string): number {
  const n = parseFloat(val.trim().replace(",", "."));
  if (isNaN(n)) throw new Error(`Valor não numérico: "${val}"`);
  return n;
}

export function parseCsvContent(content: string, label: string): { rows: ParsedCsvRow[]; unitDetected: string } {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) throw new Error(`${label}: arquivo vazio ou apenas cabeçalho`);

  const delimiter = detectDelimiter(lines[0]);
  const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ""));

  const latIdx = headers.findIndex(h => h === "lat" || h === "latitude");
  const lonIdx = headers.findIndex(h => h === "lon" || h === "lng" || h === "longitude");
  if (latIdx < 0 || lonIdx < 0) throw new Error(`${label}: colunas LAT/LON não encontradas. Headers: ${headers.join(", ")}`);

  const monthCols: { idx: number; month: number }[] = [];
  for (let i = 0; i < headers.length; i++) {
    const m = MONTH_MAP[headers[i]];
    if (m !== undefined) monthCols.push({ idx: i, month: m });
  }
  if (monthCols.length !== 12) {
    throw new Error(`${label}: esperado 12 colunas de meses, encontrado ${monthCols.length}. Headers: ${headers.join(", ")}`);
  }
  monthCols.sort((a, b) => a.month - b.month);

  const rows: ParsedCsvRow[] = [];
  const allValues: number[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter);
    if (cols.length < Math.max(latIdx, lonIdx, ...monthCols.map(m => m.idx)) + 1) continue;
    try {
      const lat = parseNumber(cols[latIdx]);
      const lon = parseNumber(cols[lonIdx]);
      const months = monthCols.map(mc => parseNumber(cols[mc.idx]));
      if (lat < -40 || lat > 12 || lon < -80 || lon > -30) continue;
      if (months.some(v => isNaN(v))) continue;
      allValues.push(...months);
      rows.push({ lat, lon, months });
    } catch { /* skip invalid */ }
  }

  const avg = allValues.length > 0 ? allValues.reduce((a, b) => a + b, 0) / allValues.length : 0;
  const unitDetected = avg > 50 ? "Wh/m²/dia → kWh" : "kWh/m²/dia";

  // Auto-convert Wh to kWh
  if (avg > 50) {
    for (const r of rows) {
      r.months = r.months.map(v => v / 1000);
    }
  }

  return { rows, unitDetected };
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
  merged: MergedPoint[]
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
