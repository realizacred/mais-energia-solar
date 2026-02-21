/**
 * ═══════════════════════════════════════════════════════════════
 * PARSER + AUDITOR DE VARIÁVEIS EM TEMPLATES
 * ═══════════════════════════════════════════════════════════════
 *
 * Detecta variáveis usadas em templates ({{grupo.campo}} e [campo])
 * e cruza com o VARIABLES_CATALOG para auditoria.
 */

import { VARIABLES_CATALOG, findVariable, toCanonical, type CatalogVariable } from "./variablesCatalog";

// ── Types ────────────────────────────────────────────────────

export interface ExtractedVariable {
  /** Chave original encontrada no template (ex: "{{cliente.nome}}" ou "[nome]") */
  raw: string;
  /** Chave canônica resolvida (ex: "{{cliente.nome}}") */
  canonical: string;
  /** Se existe no catálogo */
  registered: boolean;
  /** Referência ao catálogo, se existir */
  catalogEntry?: CatalogVariable;
}

export interface TemplateAuditResult {
  /** Todas as variáveis encontradas no template */
  extracted: ExtractedVariable[];
  /** Variáveis usadas no template que NÃO existem no catálogo */
  unregistered: string[];
  /** Variáveis do catálogo que NÃO são usadas em nenhum template */
  orphaned: CatalogVariable[];
  /** Total de variáveis encontradas */
  totalFound: number;
  /** Total registradas */
  totalRegistered: number;
  /** Total não registradas */
  totalUnregistered: number;
}

// ── Parser ───────────────────────────────────────────────────

/**
 * Extrai todas as variáveis de um template string.
 * Suporta {{grupo.campo}} e [campo].
 */
export function extractTemplateVariables(templateString: string): ExtractedVariable[] {
  const results: ExtractedVariable[] = [];
  const seen = new Set<string>();

  // Match {{grupo.campo}}
  const mustacheRegex = /\{\{([^}]+)\}\}/g;
  let match: RegExpExecArray | null;

  while ((match = mustacheRegex.exec(templateString)) !== null) {
    const raw = match[0]; // {{grupo.campo}}
    if (seen.has(raw)) continue;
    seen.add(raw);

    const catalogEntry = findVariable(raw);
    results.push({
      raw,
      canonical: raw,
      registered: !!catalogEntry,
      catalogEntry,
    });
  }

  // Match [campo] (legacy)
  const legacyRegex = /\[([^\]]+)\]/g;
  while ((match = legacyRegex.exec(templateString)) !== null) {
    const raw = match[0]; // [campo]
    if (seen.has(raw)) continue;
    seen.add(raw);

    const canonical = toCanonical(raw);
    const catalogEntry = findVariable(raw) || findVariable(canonical);
    results.push({
      raw,
      canonical,
      registered: !!catalogEntry,
      catalogEntry,
    });
  }

  return results;
}

/**
 * Audita um template contra o catálogo completo.
 * Retorna variáveis não registradas, órfãs e métricas.
 */
export function auditTemplate(templateString: string): TemplateAuditResult {
  const extracted = extractTemplateVariables(templateString);

  const unregistered = extracted
    .filter((v) => !v.registered)
    .map((v) => v.raw);

  // Encontrar variáveis órfãs (no catálogo mas não usadas no template)
  const usedCanonicals = new Set(extracted.map((v) => v.canonical));
  const orphaned = VARIABLES_CATALOG.filter(
    (v) => !usedCanonicals.has(v.canonicalKey) && !usedCanonicals.has(v.legacyKey)
  );

  return {
    extracted,
    unregistered,
    orphaned,
    totalFound: extracted.length,
    totalRegistered: extracted.filter((v) => v.registered).length,
    totalUnregistered: unregistered.length,
  };
}

/**
 * Audita múltiplos templates de uma vez.
 * Útil para verificar cobertura geral do catálogo.
 */
export function auditMultipleTemplates(
  templates: Array<{ id: string; nome: string; content: string }>
): {
  perTemplate: Array<{ id: string; nome: string; audit: TemplateAuditResult }>;
  globalOrphaned: CatalogVariable[];
  globalUnregistered: string[];
} {
  const allUsedCanonicals = new Set<string>();
  const allUnregistered = new Set<string>();

  const perTemplate = templates.map((t) => {
    const audit = auditTemplate(t.content);
    audit.extracted.forEach((v) => allUsedCanonicals.add(v.canonical));
    audit.unregistered.forEach((u) => allUnregistered.add(u));
    return { id: t.id, nome: t.nome, audit };
  });

  const globalOrphaned = VARIABLES_CATALOG.filter(
    (v) => !allUsedCanonicals.has(v.canonicalKey) && !allUsedCanonicals.has(v.legacyKey)
  );

  return {
    perTemplate,
    globalOrphaned,
    globalUnregistered: Array.from(allUnregistered),
  };
}
