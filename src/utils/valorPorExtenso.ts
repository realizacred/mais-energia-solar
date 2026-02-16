// ═══════════════════════════════════════════════════
// Valor por Extenso — Conversão de valor numérico
// para texto em português brasileiro (BRL).
// Usado em contratos e documentos jurídicos.
// ═══════════════════════════════════════════════════

const UNIDADES = [
  "", "um", "dois", "três", "quatro", "cinco",
  "seis", "sete", "oito", "nove", "dez",
  "onze", "doze", "treze", "quatorze", "quinze",
  "dezesseis", "dezessete", "dezoito", "dezenove",
];

const DEZENAS = [
  "", "", "vinte", "trinta", "quarenta", "cinquenta",
  "sessenta", "setenta", "oitenta", "noventa",
];

const CENTENAS = [
  "", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos",
  "seiscentos", "setecentos", "oitocentos", "novecentos",
];

const ESCALAS = [
  { singular: "", plural: "" },
  { singular: "mil", plural: "mil" },
  { singular: "milhão", plural: "milhões" },
  { singular: "bilhão", plural: "bilhões" },
  { singular: "trilhão", plural: "trilhões" },
];

function grupoParaExtenso(n: number): string {
  if (n === 0) return "";
  if (n === 100) return "cem";

  const centena = Math.floor(n / 100);
  const resto = n % 100;

  const parts: string[] = [];

  if (centena > 0) {
    parts.push(CENTENAS[centena]);
  }

  if (resto > 0) {
    if (resto < 20) {
      parts.push(UNIDADES[resto]);
    } else {
      const dezena = Math.floor(resto / 10);
      const unidade = resto % 10;
      parts.push(DEZENAS[dezena]);
      if (unidade > 0) {
        parts.push(UNIDADES[unidade]);
      }
    }
  }

  return parts.join(" e ");
}

function inteiroParaExtenso(n: number): string {
  if (n === 0) return "zero";
  if (n < 0) return "menos " + inteiroParaExtenso(-n);

  // Divide em grupos de 3 dígitos (unidades, milhares, milhões, etc.)
  const grupos: number[] = [];
  let valor = Math.floor(n);
  while (valor > 0) {
    grupos.push(valor % 1000);
    valor = Math.floor(valor / 1000);
  }

  const partes: string[] = [];

  for (let i = grupos.length - 1; i >= 0; i--) {
    const grupo = grupos[i];
    if (grupo === 0) continue;

    const escala = ESCALAS[i];
    const texto = grupoParaExtenso(grupo);

    if (i === 0) {
      partes.push(texto);
    } else {
      const escalaTexto = grupo === 1 ? escala.singular : escala.plural;
      // Para "mil", não dizemos "um mil"
      if (i === 1 && grupo === 1) {
        partes.push(escalaTexto);
      } else {
        partes.push(`${texto} ${escalaTexto}`);
      }
    }
  }

  // Regra: se o último grupo é < 100 ou é múltiplo de 100, usa "e"
  if (partes.length > 1) {
    const ultimo = grupos[0];
    if (ultimo > 0 && (ultimo < 100 || ultimo % 100 === 0)) {
      const lastPart = partes.pop()!;
      return partes.join(", ") + " e " + lastPart;
    }
  }

  return partes.join(", ");
}

/**
 * Converte um valor numérico em reais para texto por extenso.
 *
 * @example
 * valorPorExtenso(15809.89)
 * // "quinze mil, oitocentos e nove reais e oitenta e nove centavos"
 *
 * @example
 * valorPorExtenso(1000)
 * // "mil reais"
 *
 * @example
 * valorPorExtenso(0.50)
 * // "cinquenta centavos"
 */
export function valorPorExtenso(valor: number): string {
  if (valor === 0) return "zero reais";
  if (valor < 0) return "menos " + valorPorExtenso(-valor);

  const reais = Math.floor(valor);
  const centavos = Math.round((valor - reais) * 100);

  const partes: string[] = [];

  if (reais > 0) {
    const texto = inteiroParaExtenso(reais);
    partes.push(`${texto} ${reais === 1 ? "real" : "reais"}`);
  }

  if (centavos > 0) {
    const texto = inteiroParaExtenso(centavos);
    partes.push(`${texto} ${centavos === 1 ? "centavo" : "centavos"}`);
  }

  return partes.join(" e ");
}

/**
 * @deprecated Use `formatBRL` from `@/lib/formatters` instead.
 */
export { formatBRL as formatCurrency } from "@/lib/formatters";
