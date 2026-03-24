/**
 * ucValidation — Client-side validation rules for Unidades Consumidoras.
 * SRP: Validate UC data before persistence.
 * Mirrors DB trigger `validate_uc_name` for early feedback.
 */

const INVALID_NAMES = new Set([
  "teste", "test", "uc", "unidade", "000", "0000", "00000",
  "null", "undefined", "none", "n/a",
]);

const ONLY_NUMBERS_REGEX = /^[\d\s\-\/.,;:#+*()]+$/;
const HAS_LETTER_REGEX = /[a-zA-ZÀ-ÿ]/;

export interface UcNameValidationResult {
  valid: boolean;
  error: string | null;
}

export const ucValidation = {
  /**
   * Validate UC name before save.
   * Rules:
   * - Must be at least 3 characters
   * - Must contain at least one letter
   * - Cannot be a known placeholder/generic value
   */
  validateName(nome: string | null | undefined): UcNameValidationResult {
    if (!nome || nome.trim().length === 0) {
      return { valid: false, error: "Nome da UC é obrigatório." };
    }

    const trimmed = nome.trim();

    if (trimmed.length < 3) {
      return { valid: false, error: "Nome da UC deve ter pelo menos 3 caracteres." };
    }

    if (!HAS_LETTER_REGEX.test(trimmed)) {
      return { valid: false, error: "Nome da UC deve conter pelo menos uma letra." };
    }

    if (INVALID_NAMES.has(trimmed.toLowerCase())) {
      return { valid: false, error: "Nome da UC não pode ser um valor genérico." };
    }

    return { valid: true, error: null };
  },

  /**
   * Sanitize UC name extracted from invoice PDF.
   * Removes technical terms, normalizes casing.
   */
  sanitizeExtractedName(raw: string | null | undefined): string | null {
    if (!raw || raw.trim().length === 0) return null;

    let cleaned = raw.trim();

    // Remove technical connection terms commonly found concatenated to names
    const technicalTerms = [
      /\b(BIFASICO|TRIFASICO|MONOFASICO|BIFÁSICO|TRIFÁSICO|MONOFÁSICO)\b/gi,
      /\b(RESIDENCIAL|COMERCIAL|INDUSTRIAL|RURAL)\b/gi,
      /\b(CONVENCIONAL|HOROSSAZONAL|AZUL|VERDE|BRANCA)\b/gi,
      /\b(GRUPO\s*[AB])\b/gi,
      /\b(SUBGRUPO\s*\w+)\b/gi,
      /\b(BAIXA\s*TENSAO|ALTA\s*TENSAO|MEDIA\s*TENSAO)\b/gi,
    ];

    for (const term of technicalTerms) {
      cleaned = cleaned.replace(term, "");
    }

    // Remove excess whitespace
    cleaned = cleaned.replace(/\s+/g, " ").trim();

    // If nothing useful remains after cleaning, return null
    if (cleaned.length < 3 || !HAS_LETTER_REGEX.test(cleaned)) {
      return null;
    }

    // Title case for proper names
    cleaned = cleaned
      .toLowerCase()
      .replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

    // Fix common patterns: "Da", "De", "Do", "Dos", "Das" should be lowercase
    cleaned = cleaned.replace(/\s(D[aeo]s?)\s/g, (_, p) => ` ${p.toLowerCase()} `);

    return cleaned;
  },

  /**
   * Validate that a codigo_uc is not empty/generic.
   */
  validateCodigoUc(codigo: string | null | undefined): UcNameValidationResult {
    if (!codigo || codigo.trim().length === 0) {
      return { valid: false, error: "Código da UC é obrigatório." };
    }

    const trimmed = codigo.trim();
    if (trimmed.length < 3) {
      return { valid: false, error: "Código da UC deve ter pelo menos 3 caracteres." };
    }

    return { valid: true, error: null };
  },
};
