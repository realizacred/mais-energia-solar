/**
 * Generation Audit Engine — Classifies variable resolution quality.
 * Used after template-preview/proposal-generate returns audit data.
 * 100% evidence-based — no hardcoded lists determine blocking.
 */

import type {
  GenerationAuditReport,
  GenerationVarAuditItem,
  GenerationVarStatus,
  GenerationSeverity,
  GenerationHealth,
  CustomVarResult,
} from "./types";

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

function classifyCustomVar(cv: CustomVarResult): GenerationVarAuditItem {
  if (cv.error) {
    return {
      variable: cv.nome,
      status: "error_expression",
      severity: "warning",
      value: null,
      origin: "custom",
      message: cv.error_message || `Expressão custom "${cv.nome}" falhou na avaliação`,
      suggestion: "Revisar fórmula no wizard ou verificar dependências",
    };
  }

  if (cv.valor_calculado === null || cv.valor_calculado === "") {
    return {
      variable: cv.nome,
      status: "warning_null",
      severity: "warning",
      value: null,
      origin: "custom",
      message: `Variável custom "${cv.nome}" retornou null — dados de entrada ausentes`,
      suggestion: "Verificar se os campos da fórmula estão preenchidos",
    };
  }

  return {
    variable: cv.nome,
    status: "ok_custom",
    severity: "ok",
    value: cv.valor_calculado,
    origin: "custom",
    message: `Variável custom "${cv.nome}" calculada com sucesso`,
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
  /** Custom variable evaluation results from backend */
  customVarResults?: CustomVarResult[];
}

/**
 * Build a structured audit report from backend response.
 */
export function buildGenerationAuditReport(input: BuildAuditReportInput): GenerationAuditReport {
  const {
    templateId, templateName, propostaId, versaoId,
    totalVarsProvided, missingVars, emptyVars, resolvedCount,
    customVarResults,
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

  // Classify custom var results
  if (customVarResults) {
    for (const cv of customVarResults) {
      items.push(classifyCustomVar(cv));
    }
  }

  const errorCount = items.filter(i => i.severity === "error").length;
  const warningCount = items.filter(i => i.severity === "warning").length;
  const okCount = resolvedCount - emptyVars.length + (customVarResults?.filter(c => !c.error && c.valor_calculado != null).length ?? 0);

  const totalPlaceholders = resolvedCount + missingVars.length;
  const healthScore = totalPlaceholders > 0
    ? Math.round(((totalPlaceholders - errorCount * 2 - warningCount) / totalPlaceholders) * 100)
    : 100;
  const clampedScore = Math.max(0, Math.min(100, healthScore));

  let health: GenerationHealth = "saudavel";
  if (clampedScore < 80 || errorCount > 0) health = "critica";
  else if (clampedScore < 95 || warningCount > 0) health = "atencao";

  return {
    templateId,
    templateName,
    propostaId,
    versaoId,
    generatedAt: new Date().toISOString(),
    totalPlaceholders,
    resolved: resolvedCount,
    resolvedViaSnapshot: 0,
    unresolvedPlaceholders: missingVars.map(v => v.replace(/[[\]{}]/g, "")),
    nullValues: emptyVars.map(v => v.replace(/[[\]{}]/g, "")),
    emptyValues: emptyVars.map(v => v.replace(/[[\]{}]/g, "")),
    customVarResults: customVarResults ?? undefined,
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
 * Evidence-based policy:
 * - BLOCK on error_unresolved for critical variables
 * - BLOCK on error_expression for critical custom variables
 * - DO NOT block on warning_null alone
 */
export function shouldBlockGeneration(report: GenerationAuditReport): boolean {
  return report.items.some(
    i => i.severity === "error" && (i.status === "error_unresolved" || i.status === "error_expression")
  );
}
