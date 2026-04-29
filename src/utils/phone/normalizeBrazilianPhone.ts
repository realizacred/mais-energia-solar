/**
 * Normalizador de telefones brasileiros para vinculação de conversas WhatsApp.
 * Não altera o banco — apenas gera variantes possíveis para busca.
 */

export interface NormalizedPhone {
  raw: string;
  /** Apenas dígitos, sem DDI 55 e sem o nono dígito (se aplicável). */
  digits: string;
  /** Variantes para tentar matchar em telefone_normalized. */
  variants: string[];
}

/**
 * Aceita: número puro "32988887777", JID "5532988887777@s.whatsapp.net", máscaras "(32) 98888-7777".
 * Retorna conjunto de variantes (com/sem DDI, com/sem 9) para busca tolerante.
 */
export function normalizeBrazilianPhone(input?: string | null): NormalizedPhone | null {
  if (!input) return null;

  // Extrai parte antes do @ (JID), depois remove tudo que não é dígito
  const beforeAt = input.includes("@") ? input.split("@")[0] : input;
  let digits = beforeAt.replace(/\D/g, "");

  if (!digits) return null;

  // Remove DDI 55 se presente (12+ dígitos começando com 55)
  if (digits.length >= 12 && digits.startsWith("55")) {
    digits = digits.slice(2);
  }

  // Telefone deve ter 10 (fixo) ou 11 (celular com 9) dígitos após DDD
  if (digits.length < 10 || digits.length > 11) {
    return { raw: input, digits, variants: Array.from(new Set([digits, `55${digits}`])) };
  }

  const ddd = digits.slice(0, 2);
  const rest = digits.slice(2);

  const variantsSet = new Set<string>();
  variantsSet.add(digits);
  variantsSet.add(`55${digits}`);

  // Se tem 11 dígitos e começa com 9 → também gerar versão sem 9
  if (rest.length === 9 && rest.startsWith("9")) {
    const without9 = `${ddd}${rest.slice(1)}`;
    variantsSet.add(without9);
    variantsSet.add(`55${without9}`);
  }
  // Se tem 10 dígitos e DDD válido → também gerar versão com 9
  if (rest.length === 8) {
    const with9 = `${ddd}9${rest}`;
    variantsSet.add(with9);
    variantsSet.add(`55${with9}`);
  }

  return {
    raw: input,
    digits,
    variants: Array.from(variantsSet),
  };
}
