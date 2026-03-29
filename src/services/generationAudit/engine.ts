/**
 * Generation Audit Engine — Classifies variable resolution quality.
 * Used after template-preview returns missing_vars/empty_vars.
 * Reusable, no side effects.
 */

import type {
  GenerationAuditReport,
  GenerationVarAuditItem,
  GenerationVarStatus,
  GenerationSeverity,
  GenerationHealth,
} from "./types";

/** Known broken placeholders from forensic audit (Fase 3.1) */
const KNOWN_BROKEN_PLACEHOLDERS = new Set([
  "capo_m",
  "capo_seguro",
]);

/** Known custom variables that may return null when wizard data is incomplete */
const KNOWN_NULLABLE_CUSTOM = new Set([
  "vc_aumento",
  "vc_calculo_seguro",
  "vc_garantiaservico",
  "vc_string_box_cc",
]);

/** Critical variables that MUST have a value for a valid proposal */
const CRITICAL_VARIABLES = new Set([
  "nome",
  "cliente_nome",
  "potencia_kwp",
  "valor_total",
  "cidade",
  "estado",
  "distribuidora",
  "modulo_fabricante",
  "modulo_modelo",
  "numero_modulos",
]);

function classifyMissing(varName: string): { status: GenerationVarStatus; severity: GenerationSeverity; message: string; suggestion?: string } {
  const clean = varName.replace(/[[\]{}]/g, "");

  if (KNOWN_BROKEN_PLACEHOLDERS.has(clean)) {
    return {
      status: "error_unresolved",
      severity: "error",
      message: `Placeholder legado "${clean}" não existe em nenhum resolver`,
      suggestion: "Remover do template DOCX ou criar como variável custom",
    };
  }

  if (CRITICAL_VARIABLES.has(clean)) {
    return {
      status: "error_unresolved",
      severity: "error",
      message: `Variável crítica "${clean}" não foi resolvida`,
      suggestion: "Verificar dados de entrada da proposta",
    };
  }

  return {
    status: "error_unresolved",
    severity: "warning",
    message: `Placeholder "${clean}" não encontrado nos resolvers`,
    suggestion: "Verificar se a variável existe no catálogo ou é custom",
  };
}

function classifyEmpty(varName: string): { status: GenerationVarStatus; severity: GenerationSeverity; message: string; suggestion?: string } {
  const clean = varName.replace(/[[\]{}]/g, "");

  if (KNOWN_NULLABLE_CUSTOM.has(clean)) {
    return {
      status: "warning_null",
      severity: "warning",
      message: `Variável custom "${clean}" retornou null — fórmula do wizard sem dados de entrada`,
      suggestion: "Revisar fórmula no wizard ou adicionar fallback",
    };
  }

  if (CRITICAL_VARIABLES.has(clean)) {
    return {
      status: "warning_null",
      severity: "error",
      message: `Variável crítica "${clean}" está vazia`,
      suggestion: "Verificar se os dados foram preenchidos no formulário",
    };
  }

  return {
    status: "warning_null",
    severity: "warning",
    message: `Variável "${clean}" resolveu como vazia`,
  };
}

export interface BuildAuditReportInput {
  templateId: string;
  templateName: string;
  propostaId: string;
  versaoId?: string;
  /** Total vars passed to the template engine */
  totalVarsProvided: number;
  /** Vars that had no matching placeholder — returned by backend */
  missingVars: string[];
  /** Vars that resolved but were empty/null — returned by backend */
  emptyVars: string[];
  /** Total resolved count from backend */
  resolvedCount: number;
}

/**
 * Build a structured audit report from template-preview backend response.
 */
export function buildGenerationAuditReport(input: BuildAuditReportInput): GenerationAuditReport {
  const {
    templateId, templateName, propostaId, versaoId,
    totalVarsProvided, missingVars, emptyVars, resolvedCount,
  } = input;

  const items: GenerationVarAuditItem[] = [];

  // Classify missing vars
  for (const v of missingVars) {
    const clean = v.replace(/[[\]{}]/g, "");
    const classification = classifyMissing(v);
    items.push({
      variable: clean,
      status: classification.status,
      severity: classification.severity,
      value: null,
      origin: "template",
      message: classification.message,
      suggestion: classification.suggestion,
    });
  }

  // Classify empty vars
  for (const v of emptyVars) {
    const clean = v.replace(/[[\]{}]/g, "");
    const classification = classifyEmpty(v);
    items.push({
      variable: clean,
      status: classification.status,
      severity: classification.severity,
      value: "",
      origin: "resolver",
      message: classification.message,
      suggestion: classification.suggestion,
    });
  }

  const errorCount = items.filter(i => i.severity === "error").length;
  const warningCount = items.filter(i => i.severity === "warning").length;
  const okCount = resolvedCount - emptyVars.length;

  const totalPlaceholders = resolvedCount + missingVars.length;
  const healthScore = totalPlaceholders > 0
    ? Math.round(((totalPlaceholders - errorCount * 2 - warningCount) / totalPlaceholders) * 100)
    : 100;
  const clampedScore = Math.max(0, Math.min(100, healthScore));

  let health: GenerationHealth = "saudavel";
  if (errorCount > 0) health = "critica";
  else if (warningCount > 0) health = "atencao";

  return {
    templateId,
    templateName,
    propostaId,
    versaoId,
    generatedAt: new Date().toISOString(),
    totalPlaceholders,
    resolved: resolvedCount,
    resolvedViaSnapshot: 0, // Could be enriched if backend provides this
    unresolvedPlaceholders: missingVars.map(v => v.replace(/[[\]{}]/g, "")),
    nullValues: emptyVars.map(v => v.replace(/[[\]{}]/g, "")),
    emptyValues: emptyVars.map(v => v.replace(/[[\]{}]/g, "")),
    items,
    healthScore: clampedScore,
    health,
    errorCount,
    warningCount,
    okCount: Math.max(0, okCount),
  };
}

/**
 * Get the health label in Portuguese.
 */
export function getHealthLabel(health: GenerationHealth): string {
  switch (health) {
    case "saudavel": return "Saudável";
    case "atencao": return "Atenção";
    case "critica": return "Crítica";
  }
}

/**
 * Determine if generation should be blocked based on audit.
 * Current policy: only block on critical errors (known broken placeholders).
 */
export function shouldBlockGeneration(report: GenerationAuditReport): boolean {
  // Only block if there are truly critical unresolved vars
  return report.items.some(
    i => i.severity === "error" && i.status === "error_unresolved" && KNOWN_BROKEN_PLACEHOLDERS.has(i.variable)
  );
}
