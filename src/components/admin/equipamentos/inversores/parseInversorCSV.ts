/**
 * Parser especializado para inversores do CSV de distribuidoras.
 * Reutiliza parseDistributorCSV para o parse base (categoria 'Inversor').
 */

import {
  parseDistributorCSV,
  type ParseResult as BaseParseResult,
} from "../modulos/parseDistributorCSV";

export interface ParsedDistributorInversor {
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number;
  tipo: string;
  status: "rascunho";
  ativo: boolean;
}

/**
 * Extrai potência em kW do nome do modelo de inversor.
 * Padrões comuns:
 *  - SG10RS → 10 kW
 *  - SG110CX → 110 kW
 *  - SYMO 10.0-3-M → 10 kW
 *  - SIW200F M030 → 30 kW (M seguido de 3 dígitos)
 *  - MOD 10KTL3 → 10 kW
 */
export function extractPotenciaKw(modelo: string): number {
  const upper = modelo.toUpperCase();

  // Padrão explícito: número + KW ou KWP
  const kwMatch = upper.match(/(\d+\.?\d*)\s*[Kk][Ww]/i);
  if (kwMatch) return parseFloat(kwMatch[1]);

  // Padrão SG(\d+)(RS|CX|RT|KTL|TL) — ex: SG10RS, SG110CX
  const sgMatch = upper.match(/SG(\d+)\s*(RS|CX|RT|KTL|TL)/);
  if (sgMatch) return parseInt(sgMatch[1]);

  // Padrão (\d+)\s*(KTL|KW|K) — ex: MOD 10KTL3
  const ktlMatch = upper.match(/(\d+)\s*(KTL|KW|K(?=[A-Z0-9]))/);
  if (ktlMatch) return parseInt(ktlMatch[1]);

  // Padrão M(\d{3}) — ex: M030 → 30
  const mMatch = upper.match(/\bM(\d{3})\b/);
  if (mMatch) {
    const val = parseInt(mMatch[1]);
    if (val >= 1 && val <= 500) return val;
  }

  // Padrão (\d+\.?\d*)-3-M ou número + sufixo de potência
  const symoMatch = upper.match(/(\d+\.?\d*)\s*-\s*3\s*-/);
  if (symoMatch) return parseFloat(symoMatch[1]);

  // Padrão genérico: número entre 1 e 500 seguido de sufixos RS, CX, TL, RT
  const genericMatch = upper.match(/(\d+\.?\d*)\s*(RS|CX|TL|RT)\b/);
  if (genericMatch) {
    const val = parseFloat(genericMatch[1]);
    if (val >= 1 && val <= 500) return val;
  }

  // Fallback: procurar número razoável de 1-3 dígitos no modelo
  const nums = modelo.match(/(\d+\.?\d*)/g);
  if (nums) {
    const candidates = nums.map(Number).filter(n => n >= 1 && n <= 500);
    if (candidates.length > 0) return Math.max(...candidates);
  }

  return 0;
}

/**
 * Detecta tipo de inversor pelo modelo.
 */
export function detectTipoInversor(modelo: string): string {
  const upper = modelo.toUpperCase();
  if (/\bMI\b|MICRO/i.test(upper)) return "Microinversor";
  if (/HYB|HY\b|HIBRIDO|HÍBRIDO/i.test(upper)) return "Híbrido";
  if (/CENTRAL|MVT/i.test(upper)) return "Central";
  return "String";
}

export interface InversorParseResult {
  inversores: ParsedDistributorInversor[];
  warnings: BaseParseResult["warnings"];
  totalLines: number;
  filteredLines: number;
}

/**
 * Parse do CSV de distribuidora para inversores.
 */
export function parseDistributorInversorCSV(csvText: string): InversorParseResult {
  const base = parseDistributorCSV(csvText, "Inversor");

  const inversores: ParsedDistributorInversor[] = base.modules.map(m => ({
    fabricante: m.fabricante,
    modelo: m.modelo,
    potencia_nominal_kw: extractPotenciaKw(m.modelo),
    tipo: detectTipoInversor(m.modelo),
    status: "rascunho" as const,
    ativo: true,
  }));

  return {
    inversores,
    warnings: base.warnings,
    totalLines: base.totalLines,
    filteredLines: base.filteredLines,
  };
}
