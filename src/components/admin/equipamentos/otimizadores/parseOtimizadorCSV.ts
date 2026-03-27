/**
 * Parser especializado para otimizadores do CSV de distribuidoras.
 * Reutiliza parseDistributorCSV para o parse base (categoria 'Otimizador').
 */

import {
  parseDistributorCSV,
  type ParseResult as BaseParseResult,
} from "../modulos/parseDistributorCSV";

export interface ParsedDistributorOtimizador {
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  status: "rascunho";
  ativo: boolean;
}

/**
 * Extrai potência em Wp do nome do modelo de otimizador.
 * Padrões comuns:
 *  - SOLAREDGE P370 → 370 Wp
 *  - SOLAREDGE M1600 → 1600 Wp
 *  - HUAWEI SUN2000-450W-P → 450 Wp
 *  - Número seguido de W → valor direto
 */
export function extractPotenciaWpOtimizador(modelo: string): number {
  const upper = modelo.toUpperCase();

  // Padrão P(\d{2,3}) — ex: P370, P505 (range otimizador: 50-800W)
  const pMatch = upper.match(/\bP(\d{2,3})\b/);
  if (pMatch) {
    const val = parseInt(pMatch[1]);
    if (val >= 50 && val <= 800) return val;
  }

  // Padrão (\d{2,3})W — ex: 400W, 450W
  const wMatch = upper.match(/(\d{2,3})\s*W\b/);
  if (wMatch) {
    const val = parseInt(wMatch[1]);
    if (val >= 50 && val <= 800) return val;
  }

  // Padrão SUN2000-(\d{2,3})W — ex: SUN2000-450W-P
  const sunMatch = upper.match(/SUN2000-(\d{2,3})W/);
  if (sunMatch) {
    const val = parseInt(sunMatch[1]);
    if (val >= 50 && val <= 800) return val;
  }

  // Fallback: procurar número razoável de 2-3 dígitos no range de otimizador
  const nums = modelo.match(/(\d{2,3})/g);
  if (nums) {
    const candidates = nums.map(Number).filter(n => n >= 50 && n <= 800);
    if (candidates.length > 0) return Math.max(...candidates);
  }

  return 0;
}

export interface OtimizadorParseResult {
  otimizadores: ParsedDistributorOtimizador[];
  warnings: BaseParseResult["warnings"];
  totalLines: number;
  filteredLines: number;
}

/**
 * Parse do CSV de distribuidora para otimizadores.
 */
export function parseDistributorOtimizadorCSV(csvText: string): OtimizadorParseResult {
  const base = parseDistributorCSV(csvText, "Otimizador");

  const otimizadores: ParsedDistributorOtimizador[] = base.modules.map(m => ({
    fabricante: m.fabricante,
    modelo: m.modelo,
    potencia_wp: extractPotenciaWpOtimizador(m.modelo),
    status: "rascunho" as const,
    ativo: true,
  }));

  return {
    otimizadores,
    warnings: base.warnings,
    totalLines: base.totalLines,
    filteredLines: base.filteredLines,
  };
}
