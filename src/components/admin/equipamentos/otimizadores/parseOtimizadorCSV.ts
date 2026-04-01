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
export function extractPotenciaWpOtimizador(modelo: string): number | null {
  if (!modelo) return null;
  const m = modelo.toUpperCase().trim();

  // Filtrar inversores SolarEdge: SE8250H, SE10000H, etc.
  if (/^SE\d{4,}/.test(m)) return null;

  // Padrão 1: número + W explícito (ex: 450W, 500W-P, SUN2000-450W-P)
  const p1 = m.match(/(\d+(?:[.,]\d+)?)\s*W\b/);
  if (p1) return parseFloat(p1[1].replace(',', '.'));

  // Padrão 2: número + kW explícito (ex: 1.6kW → 1600W)
  const p2 = m.match(/(\d+(?:[.,]\d+)?)\s*KW\b/);
  if (p2) return parseFloat(p2[1].replace(',', '.')) * 1000;

  // Padrão 3: letra(s) + número 3-4 dígitos no final (ex: M1600, P1100, P370, S1200)
  const p3 = m.match(/^[A-Z]{1,2}(\d{3,4})$/);
  if (p3) return parseInt(p3[1], 10);

  // Padrão 4: letra(s) + número 3-4 dígitos antes de hífen (ex: P370-EV, S1400-X)
  const p4 = m.match(/^[A-Z]{1,2}(\d{3,4})(?=-)/);
  if (p4) return parseInt(p4[1], 10);

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

  const otimizadores: ParsedDistributorOtimizador[] = [];
  const warnings = [...base.warnings];
  for (const m of base.modules) {
    const potencia = extractPotenciaWpOtimizador(m.modelo);
    if (potencia === null) continue; // é inversor, não otimizador
    if (potencia <= 0) {
      warnings.push({ line: 0, raw: "", issue: `Potência (W) não detectada no modelo "${m.fabricante} ${m.modelo}" — preencha manualmente` });
    }
    otimizadores.push({
      fabricante: m.fabricante,
      modelo: m.modelo,
      potencia_wp: potencia,
      status: "rascunho" as const,
      ativo: true,
    });
  }

  return {
    otimizadores,
    warnings,
    totalLines: base.totalLines,
    filteredLines: base.filteredLines,
  };
}
