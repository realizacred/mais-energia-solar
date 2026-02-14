// ─── Safe Expression Engine for Custom Variables (vc_*) ────
// Parses expressions like "[economia_anual]/[valor_total]*100"
// SECURITY: No eval(), no Function(), no arbitrary code execution.
// Only supports: numbers, arithmetic operators, parentheses, and [variable] references.

export interface ExpressionContext {
  [key: string]: number;
}

type Token =
  | { type: "number"; value: number }
  | { type: "variable"; name: string }
  | { type: "op"; value: "+" | "-" | "*" | "/" }
  | { type: "paren"; value: "(" | ")" };

/** Tokenize an expression string */
function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr.trim();

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Variable: [nome_da_variavel]
    if (ch === "[") {
      const end = s.indexOf("]", i + 1);
      if (end === -1) throw new Error(`Variável não fechada na posição ${i}`);
      tokens.push({ type: "variable", name: s.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    // Number (including decimals)
    if (/[0-9.]/.test(ch)) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) throw new Error(`Número inválido: ${num}`);
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    // Operators
    if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", value: ch as "+" | "-" | "*" | "/" });
      i++;
      continue;
    }

    // Parentheses
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
      continue;
    }

    throw new Error(`Caractere inesperado '${ch}' na posição ${i}`);
  }

  return tokens;
}

/** Recursive descent parser: expr → term ((+|-) term)* */
function parseExpression(tokens: Token[], pos: { i: number }, ctx: ExpressionContext): number {
  let left = parseTerm(tokens, pos, ctx);

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      pos.i++;
      const right = parseTerm(tokens, pos, ctx);
      left = tok.value === "+" ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

/** term → factor ((*|/) factor)* */
function parseTerm(tokens: Token[], pos: { i: number }, ctx: ExpressionContext): number {
  let left = parseFactor(tokens, pos, ctx);

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === "op" && (tok.value === "*" || tok.value === "/")) {
      pos.i++;
      const right = parseFactor(tokens, pos, ctx);
      if (tok.value === "/") {
        if (right === 0) return 0; // Safe division by zero
        left = left / right;
      } else {
        left = left * right;
      }
    } else {
      break;
    }
  }

  return left;
}

/** factor → number | variable | (expr) | -factor */
function parseFactor(tokens: Token[], pos: { i: number }, ctx: ExpressionContext): number {
  if (pos.i >= tokens.length) throw new Error("Expressão incompleta");

  const tok = tokens[pos.i];

  // Unary minus
  if (tok.type === "op" && tok.value === "-") {
    pos.i++;
    return -parseFactor(tokens, pos, ctx);
  }

  // Parenthesized expression
  if (tok.type === "paren" && tok.value === "(") {
    pos.i++;
    const val = parseExpression(tokens, pos, ctx);
    if (pos.i >= tokens.length || tokens[pos.i].type !== "paren" || (tokens[pos.i] as any).value !== ")") {
      throw new Error("Parêntese não fechado");
    }
    pos.i++;
    return val;
  }

  // Number literal
  if (tok.type === "number") {
    pos.i++;
    return tok.value;
  }

  // Variable reference
  if (tok.type === "variable") {
    pos.i++;
    const val = ctx[tok.name];
    if (val === undefined) {
      console.warn(`[ExpressionEngine] Variável não encontrada: ${tok.name}, usando 0`);
      return 0;
    }
    return typeof val === "number" ? val : 0;
  }

  throw new Error(`Token inesperado: ${JSON.stringify(tok)}`);
}

/**
 * Evaluate a safe expression string against a context of named values.
 * Returns the numeric result or null on error.
 * 
 * Example:
 *   evaluate("[economia_anual] / [valor_total] * 100", { economia_anual: 12000, valor_total: 80000 })
 *   // → 15
 */
export function evaluate(expression: string, context: ExpressionContext): number | null {
  try {
    if (!expression || expression.trim() === "") return null;
    const tokens = tokenize(expression);
    if (tokens.length === 0) return null;
    const pos = { i: 0 };
    const result = parseExpression(tokens, pos, context);
    return isFinite(result) ? Math.round(result * 10000) / 10000 : null;
  } catch (err) {
    console.warn(`[ExpressionEngine] Erro ao avaliar "${expression}":`, err);
    return null;
  }
}

/**
 * Extract all variable names referenced in an expression.
 * Example: extractVariables("[a] + [b] * 2") → ["a", "b"]
 */
export function extractVariables(expression: string): string[] {
  const matches = expression.match(/\[([^\]]+)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1, -1).trim()))];
}

/**
 * Validate an expression without evaluating it.
 * Returns { valid: true } or { valid: false, error: string }
 */
export function validateExpression(expression: string): { valid: boolean; error?: string } {
  try {
    if (!expression || expression.trim() === "") return { valid: false, error: "Expressão vazia" };
    const tokens = tokenize(expression);
    if (tokens.length === 0) return { valid: false, error: "Nenhum token encontrado" };
    // Dry run with empty context (variables will resolve to 0)
    const pos = { i: 0 };
    parseExpression(tokens, pos, {});
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}
