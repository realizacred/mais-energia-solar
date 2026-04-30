/**
 * toCanonicalPhoneDigits — SSOT para gravar `telefone_normalized` em leads,
 * clientes e demais entidades. Garante alinhamento com o formato canônico
 * usado pela migração SolarMarket (11 dígitos com 9º para celular, 10 para fixo).
 *
 * Governança:
 *   - AGENTS.md RB-62 (formatação nativa obrigatória)
 *   - dedup-rule-v4 (rejeita placeholders óbvios)
 *
 * Regras:
 *   1. Remove DDI 55 se presente
 *   2. Celular (8 dígitos após DDD começando com 8 ou 9) → adiciona 9º dígito
 *   3. Fixo (8 dígitos após DDD começando com 2-7) → mantém 10 dígitos
 *   4. Já com 11 dígitos → mantém
 *   5. Placeholders (todos repetidos, 6+ noves/zeros no fim) → null
 *   6. Tamanhos inválidos (<10 ou >11) → null
 */

const KNOWN_PLACEHOLDERS = new Set([
  "99999999999",
  "00000000000",
  "11111111111",
  "12345678901",
]);

function isPlaceholder(digits: string): boolean {
  if (KNOWN_PLACEHOLDERS.has(digits)) return true;
  if (/^(\d)\1+$/.test(digits)) return true; // todos iguais
  if (/(9{6,}|0{6,})$/.test(digits)) return true; // 6+ repetidos no fim
  return false;
}

/**
 * Normaliza telefone BR para o formato canônico de gravação no banco.
 * Retorna null se o telefone for inválido ou placeholder.
 */
export function toCanonicalPhoneDigits(input?: string | null): string | null {
  if (!input) return null;

  // Extrai parte antes do @ (JID), depois remove tudo que não é dígito
  const beforeAt = String(input).includes("@") ? String(input).split("@")[0] : String(input);
  let digits = beforeAt.replace(/\D/g, "");

  if (!digits) return null;

  // Remove DDI 55
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  if (digits.length === 12 && digits.startsWith("55")) digits = digits.slice(2);

  // Tamanho deve ser 10 ou 11 após DDD
  if (digits.length !== 10 && digits.length !== 11) return null;

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  // DDD válido: 11-99
  const dddNum = Number(ddd);
  if (dddNum < 11 || dddNum > 99) return null;

  let canonical: string;
  if (rest.length === 8) {
    // Celular antigo (10 dígitos, sem 9): adicionar 9 se primeiro dígito for 8 ou 9
    if (/^[89]/.test(rest)) {
      canonical = `${ddd}9${rest}`;
    } else {
      // Fixo (2-7): mantém 10 dígitos
      canonical = digits;
    }
  } else {
    // 11 dígitos: já no formato celular
    canonical = digits;
  }

  if (isPlaceholder(canonical)) return null;

  return canonical;
}
