/**
 * ANEEL Import Guard — Line-by-line validation engine
 * 
 * Validates each row individually with specific error messages per field.
 * Converts Brazilian date formats and comma decimals.
 * Returns a structured validation report.
 */

import { norm, parseNumber, detectColumns } from "./importCsvAneelUtils";

export interface RowValidation {
  rowIndex: number; // 1-based (header = row 1, data starts row 2)
  status: "valid" | "invalid" | "warning";
  errors: string[];
  warnings: string[];
  raw: Record<string, string>;
  normalized: Record<string, string | number | null>;
}

export interface ValidationReport {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  rows: RowValidation[];
  missingRequiredColumns: string[];
  detectedColumns: Record<string, number>;
}

/** Required columns for a valid import — varies by file type */
const REQUIRED_COLUMNS_HOMOLOGADAS = ["sigAgente", "vigencia", "subgrupo", "vlrTUSD"] as const;
const REQUIRED_COLUMNS_COMPONENTES = ["sigAgente", "vigencia", "subgrupo"] as const;

const REQUIRED_LABELS: Record<string, string> = {
  sigAgente: "sigla (Sigla do Agente)",
  vigencia: "inicio_vigencia (Início Vigência)",
  subgrupo: "subgrupo",
  vlrTUSD: "tusd (Valor TUSD)",
  vlrComponente: "valor componente",
};

/** Parse Brazilian date dd/mm/yyyy → ISO yyyy-mm-dd */
export function parseBrazilianDate(raw: string): { value: string | null; error: string | null } {
  if (!raw || !raw.trim()) return { value: null, error: "Data vazia" };
  
  const trimmed = raw.trim();
  
  // Already ISO format (yyyy-mm-dd)
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return { value: trimmed.substring(0, 10), error: null };
  }
  
  // Brazilian format dd/mm/yyyy
  const brMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (brMatch) {
    const [, day, month, year] = brMatch;
    const d = parseInt(day, 10);
    const m = parseInt(month, 10);
    const y = parseInt(year, 10);
    
    if (m < 1 || m > 12) return { value: null, error: `Mês inválido: ${m}` };
    if (d < 1 || d > 31) return { value: null, error: `Dia inválido: ${d}` };
    if (y < 1990 || y > 2099) return { value: null, error: `Ano fora do intervalo: ${y}` };
    
    return { value: `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`, error: null };
  }
  
  // Excel serial date number
  const numVal = parseFloat(trimmed);
  if (!isNaN(numVal) && numVal > 30000 && numVal < 60000) {
    // Excel serial date conversion
    const epoch = new Date(1899, 11, 30);
    const date = new Date(epoch.getTime() + numVal * 86400000);
    if (!isNaN(date.getTime())) {
      return { 
        value: date.toISOString().substring(0, 10), 
        error: null 
      };
    }
  }
  
  return { value: null, error: `Formato de data não reconhecido: "${trimmed}"` };
}

/** Parse number with comma support */
function parseNumericField(raw: string): { value: number | null; error: string | null } {
  if (!raw || !raw.trim()) return { value: 0, error: null }; // empty = 0, not error
  
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  const num = parseFloat(cleaned);
  
  if (isNaN(num)) return { value: null, error: `Valor não numérico: "${raw}"` };
  return { value: num, error: null };
}

/**
 * Validate all rows with per-line error reporting.
 */
/** Patterns that indicate a footer/summary line from the ANEEL export */
const FOOTER_PATTERNS = [
  /filtros?\s*aplicados/i,
  /^ano\s+.?\s*\d{4}/i,
  /^flag\b/i,
  /tipo\s+de\s+outorga/i,
  /\(em\s+branco\)/i,
  /^total\b/i,
  /^fonte:/i,
  /^legenda:/i,
];

function isFooterRow(cells: string[]): boolean {
  const joined = cells.map(c => (c || "").trim()).join(" ").trim();
  if (!joined) return true; // blank row
  return FOOTER_PATTERNS.some(p => p.test(joined));
}

export interface DiscardedRow {
  rowIndex: number;
  reason: string;
  preview: string;
}

export function validateRows(
  headers: string[],
  rows: string[][],
  fileType: "homologadas" | "componentes" = "homologadas",
): ValidationReport & { discardedFooterRows: DiscardedRow[] } {
  const colMap = detectColumns(headers);
  
  // Check required columns based on file type
  const requiredCols = fileType === "componentes" ? REQUIRED_COLUMNS_COMPONENTES : REQUIRED_COLUMNS_HOMOLOGADAS;
  const missingRequiredColumns: string[] = [];
  for (const reqCol of requiredCols) {
    if (colMap[reqCol] === undefined) {
      missingRequiredColumns.push(
        `Campo obrigatório '${REQUIRED_LABELS[reqCol] || reqCol}' não encontrado no cabeçalho.`
      );
    }
  }
  
  // For componentes, require at least vlrComponente OR vlrTUSD
  if (fileType === "componentes" && colMap.vlrComponente === undefined && colMap.vlrTUSD === undefined) {
    missingRequiredColumns.push(
      `Campo obrigatório 'valor componente' ou 'tusd' não encontrado no cabeçalho.`
    );
  }
  
  // Check for modalidade (required for proper import but not blocking)
  const hasModalidade = colMap.modalidade !== undefined;
  const hasFimVigencia = colMap.fimVigencia !== undefined;
  const hasBaseTarifaria = colMap.baseTarifaria !== undefined;
  
  const validationRows: RowValidation[] = [];
  const discardedFooterRows: DiscardedRow[] = [];
  
  for (let i = 0; i < rows.length; i++) {
    const cells = rows[i];
    const rowNum = i + 2; // row 1 is header, data starts at 2
    const errors: string[] = [];
    const warnings: string[] = [];
    const raw: Record<string, string> = {};
    const normalized: Record<string, string | number | null> = {};
    
    // Extract raw values
    for (const [key, idx] of Object.entries(colMap)) {
      raw[key] = cells[idx] ?? "";
    }
    
    // Detect and skip footer/summary/blank rows
    if (isFooterRow(cells)) {
      const joined = cells.map(c => (c || "").trim()).filter(Boolean).join(" | ");
      const reason = cells.every(c => !c || !c.trim())
        ? "Linha em branco"
        : "Linha de rodapé/resumo do site ANEEL";
      discardedFooterRows.push({ rowIndex: rowNum, reason, preview: joined.substring(0, 120) });
      continue;
    }
    
    // Validate sigAgente
    const sigAgente = raw.sigAgente || raw.nomAgente || "";
    if (!sigAgente.trim()) {
      errors.push("Sigla do agente vazia");
    }
    normalized.sigAgente = sigAgente.trim();
    
    // Validate subgrupo
    const subgrupo = raw.subgrupo || "";
    if (!subgrupo.trim()) {
      errors.push("Subgrupo vazio");
    }
    normalized.subgrupo = subgrupo.trim();
    
    // Validate inicio_vigencia
    if (colMap.vigencia !== undefined) {
      const dateResult = parseBrazilianDate(raw.vigencia || "");
      if (dateResult.error) {
        errors.push(`Início vigência: ${dateResult.error}`);
      }
      normalized.inicioVigencia = dateResult.value;
    }
    
    // Validate fim_vigencia
    if (hasFimVigencia) {
      const fimResult = parseBrazilianDate(raw.fimVigencia || "");
      if (raw.fimVigencia && fimResult.error) {
        warnings.push(`Fim vigência: ${fimResult.error}`);
      }
      normalized.fimVigencia = fimResult.value;
      
      // Cross-validate: inicio <= fim
      if (normalized.inicioVigencia && normalized.fimVigencia) {
        if (String(normalized.inicioVigencia) > String(normalized.fimVigencia)) {
          errors.push(`Início vigência (${normalized.inicioVigencia}) posterior ao fim (${normalized.fimVigencia})`);
        }
      }
    }
    
    // Validate TUSD (numeric) — only required for homologadas
    if (colMap.vlrTUSD !== undefined) {
      const tusdResult = parseNumericField(raw.vlrTUSD || "");
      if (tusdResult.error && fileType !== "componentes") {
        errors.push(`TUSD: ${tusdResult.error}`);
      }
      normalized.vlrTUSD = tusdResult.value;
    } else if (fileType === "componentes") {
      // For componentes, use vlrComponente as the value
      if (colMap.vlrComponente !== undefined) {
        const compResult = parseNumericField(raw.vlrComponente || "");
        if (compResult.error) {
          warnings.push(`Valor componente: ${compResult.error}`);
        }
        normalized.vlrComponente = compResult.value;
      }
    }
    
    // Validate TE (numeric, optional)
    if (raw.vlrTE !== undefined) {
      const teResult = parseNumericField(raw.vlrTE);
      if (teResult.error) {
        warnings.push(`TE: ${teResult.error}`);
      }
      normalized.vlrTE = teResult.value;
    }
    
    // Validate base_tarifaria
    if (hasBaseTarifaria) {
      normalized.baseTarifaria = raw.baseTarifaria || "";
    }
    
    // Validate modalidade
    if (hasModalidade) {
      normalized.modalidade = raw.modalidade || "";
    } else {
      warnings.push("Coluna 'modalidade' ausente — será usada 'Convencional' como padrão");
    }
    
    validationRows.push({
      rowIndex: rowNum,
      status: errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid",
      errors,
      warnings,
      raw,
      normalized,
    });
  }
  
  return {
    totalRows: validationRows.length,
    validRows: validationRows.filter(r => r.status === "valid").length,
    invalidRows: validationRows.filter(r => r.status === "invalid").length,
    warningRows: validationRows.filter(r => r.status === "warning").length,
    rows: validationRows,
    missingRequiredColumns,
    detectedColumns: colMap,
    discardedFooterRows,
  };
}
