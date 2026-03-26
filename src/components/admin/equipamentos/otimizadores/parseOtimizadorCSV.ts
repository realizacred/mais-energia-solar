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

  // Padrão P(\d{3,4}) — ex: P370, P505
  const pMatch = upper.match(/\bP(\d{3,4})\b/);
  if (pMatch) return parseInt(pMatch[1]);

  // Padrão M(\d{3,4}) — ex: M1600
  const mMatch = upper.match(/\bM(\d{3,4})\b/);
  if (mMatch) return parseInt(mMatch[1]);

  // Padrão (\d{3,4})W — ex: 450W
  const wMatch = upper.match(/(\d{3,4})\s*W\b/);
  if (wMatch) return parseInt(wMatch[1]);

  // Padrão SUN2000-(\d{3,4})W — ex: SUN2000-450W-P
  const sunMatch = upper.match(/SUN2000-(\d{3,4})W/);
  if (sunMatch) return parseInt(sunMatch[1]);

  // Fallback: procurar número razoável de 3-4 dígitos
  const nums = modelo.match(/(\d{3,4})/g);
  if (nums) {
    const candidates = nums.map(Number).filter(n => n >= 100 && n <= 2000);
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
