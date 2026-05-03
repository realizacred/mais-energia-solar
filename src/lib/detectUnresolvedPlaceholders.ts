/**
 * Detecta placeholders {{variavel}} ou {variavel} não substituídos
 * em um HTML/string já renderizado de proposta.
 *
 * Uso:
 *   const unresolved = detectUnresolvedPlaceholders(html);
 *   if (unresolved.length) console.warn("[proposal] placeholders não resolvidos:", unresolved);
 *
 * - Ignora padrões obviamente não-variáveis: handlebars de controle ({{#if}}, {{/each}}),
 *   expressões CSS calc(), funções url(), e tags HTML.
 * - Retorna nomes únicos, ordenados.
 */
export function detectUnresolvedPlaceholders(html: string): string[] {
  if (!html || typeof html !== "string") return [];

  const found = new Set<string>();

  // {{variavel}} ou {{ variavel.subkey }}
  const doubleBrace = /\{\{\s*([a-zA-Z_][\w.\-]*)\s*\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = doubleBrace.exec(html)) !== null) {
    const name = m[1];
    // Skip handlebars control structures
    if (name.startsWith("#") || name.startsWith("/") || name === "else" || name === "this") continue;
    found.add(name);
  }

  // {variavel} simples — só se parecer chave de variável (com . ou _) e não estar em CSS/JS
  const singleBrace = /(?<![{\w])\{\s*([a-zA-Z_][\w.]*\.[a-zA-Z_][\w.]*)\s*\}(?!\})/g;
  while ((m = singleBrace.exec(html)) !== null) {
    found.add(m[1]);
  }

  return Array.from(found).sort();
}

/**
 * Helper para uso em renderizadores: loga warning em modo dev.
 */
export function warnUnresolvedPlaceholders(html: string, source = "proposal"): string[] {
  const unresolved = detectUnresolvedPlaceholders(html);
  if (unresolved.length > 0 && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `[${source}] ${unresolved.length} placeholder(s) não resolvido(s):`,
      unresolved
    );
  }
  return unresolved;
}
