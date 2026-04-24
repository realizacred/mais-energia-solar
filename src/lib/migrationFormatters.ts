/**
 * migrationFormatters — utilitários puros para normalizar dados vindos
 * de fontes externas (SolarMarket etc.) para o padrão visual nativo do CRM.
 *
 * Governança:
 *   - RB-62: formatação nativa obrigatória (telefone, CPF/CNPJ, CEP, nome, e-mail)
 *   - SRP: cada função faz apenas uma coisa, sem efeitos colaterais
 *   - Reutilizável tanto no frontend (TS) quanto em edge functions (Deno) —
 *     este arquivo é importado pela função `sm-promote` como módulo local.
 *
 * Todas as funções aceitam null/undefined e devolvem null nesses casos
 * (nunca lançam exceções) para permitir uso direto em pipelines de migração.
 */

/** Remove tudo que não for dígito. Retorna "" para null/undefined. */
function digits(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).replace(/\D+/g, "");
}

/**
 * Formata telefone BR para "(XX) XXXXX-XXXX" (celular) ou "(XX) XXXX-XXXX" (fixo).
 * Aceita números com ou sem DDI 55. Retorna null se não houver 10 ou 11 dígitos.
 *
 * Exemplos:
 *   formatPhoneBR("32988887777") → "(32) 98888-7777"
 *   formatPhoneBR("5532988887777") → "(32) 98888-7777"
 *   formatPhoneBR("3233334444") → "(32) 3333-4444"
 *   formatPhoneBR("123") → null
 */
export function formatPhoneBR(raw: unknown): string | null {
  let d = digits(raw);
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return null;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (rest.length === 9) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

/**
 * Formata CPF "XXX.XXX.XXX-XX" ou CNPJ "XX.XXX.XXX/XXXX-XX".
 * Retorna null se não tiver 11 (CPF) ou 14 (CNPJ) dígitos.
 *
 * Exemplos:
 *   formatCpfCnpj("12345678900") → "123.456.789-00"
 *   formatCpfCnpj("12345678000190") → "12.345.678/0001-90"
 */
export function formatCpfCnpj(raw: unknown): string | null {
  const d = digits(raw);
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return null;
}

/**
 * Formata CEP brasileiro como "XXXXX-XXX".
 * Retorna null se não tiver exatamente 8 dígitos.
 */
export function formatCep(raw: unknown): string | null {
  const d = digits(raw);
  if (d.length !== 8) return null;
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

/**
 * Capitaliza nomes próprios respeitando preposições comuns (de, da, do, dos, das, e).
 *
 * Exemplos:
 *   capitalizeName("JOAO SILVA") → "Joao Silva"
 *   capitalizeName("maria DA silva e SOUZA") → "Maria da Silva e Souza"
 *   capitalizeName("  ") → null
 */
export function capitalizeName(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().replace(/\s+/g, " ");
  if (!s) return null;
  const lower = new Set(["de", "da", "do", "dos", "das", "e", "di", "du"]);
  return s
    .toLowerCase()
    .split(" ")
    .map((word, idx) => {
      if (idx > 0 && lower.has(word)) return word;
      // Preserva hífens em sobrenomes compostos (ex.: "Saint-Exupéry")
      return word
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
        .join("-");
    })
    .join(" ");
}

/**
 * Normaliza e-mail: trim + lowercase. Retorna null se string vazia
 * ou se não tiver formato mínimo (algo@algo.algo).
 */
export function normalizeEmail(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // Validação mínima: contém @ e domínio com ponto
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return null;
  return s;
}

/* ─────────────────────────────────────────────────────────────────────────
 * Smoke tests inline (executados apenas em ambiente de desenvolvimento).
 * Mantém os contratos documentados próximos da implementação.
 * ───────────────────────────────────────────────────────────────────────── */
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(`migrationFormatters smoke fail: ${msg}`);
  };
  assert(formatPhoneBR("32988887777") === "(32) 98888-7777", "celular 11d");
  assert(formatPhoneBR("3233334444") === "(32) 3333-4444", "fixo 10d");
  assert(formatPhoneBR("5532988887777") === "(32) 98888-7777", "ddi 55");
  assert(formatPhoneBR("123") === null, "phone curto");
  assert(formatCpfCnpj("12345678900") === "123.456.789-00", "cpf");
  assert(formatCpfCnpj("12345678000190") === "12.345.678/0001-90", "cnpj");
  assert(formatCpfCnpj("999") === null, "doc curto");
  assert(formatCep("36300000") === "36300-000", "cep");
  assert(capitalizeName("JOAO SILVA") === "Joao Silva", "nome upper");
  assert(capitalizeName("maria DA silva") === "Maria da Silva", "preposição");
  assert(normalizeEmail(" Foo@BAR.com ") === "foo@bar.com", "email");
  assert(normalizeEmail("invalido") === null, "email inválido");
}
