// ─── Safe Expression Engine for Custom Variables (vc_*) ────
// Parses expressions like "[economia_anual]/[valor_total]*100"
// SECURITY: No eval(), no Function(), no arbitrary code execution.
// Only supports: numbers, arithmetic operators, parentheses, and [variable] references.

export interface ExpressionContext {
  [key: string]: number;
}

/** Evaluation mode: tolerant continues with 0 for missing keys, strict returns error */
export type EvaluationMode = "tolerant" | "strict";

/** Structured result from evaluation with tracking */
export interface EvaluationResult {
  value: number | null;
  missingKeys: string[];
  error?: string;
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
  return parseExpressionTracked(tokens, pos, ctx);
}

/** Tracked version with missingKeys and mode support */
function parseExpressionTracked(
  tokens: Token[],
  pos: { i: number },
  ctx: ExpressionContext,
  missingKeys?: string[],
  mode: EvaluationMode = "tolerant",
): number {
  let left = parseTermTracked(tokens, pos, ctx, missingKeys, mode);

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
      pos.i++;
      const right = parseTermTracked(tokens, pos, ctx, missingKeys, mode);
      left = tok.value === "+" ? left + right : left - right;
    } else {
      break;
    }
  }

  return left;
}

/** term → factor ((*|/) factor)* */
function parseTerm(tokens: Token[], pos: { i: number }, ctx: ExpressionContext): number {
  return parseTermTracked(tokens, pos, ctx);
}

function parseTermTracked(
  tokens: Token[],
  pos: { i: number },
  ctx: ExpressionContext,
  missingKeys?: string[],
  mode: EvaluationMode = "tolerant",
): number {
  let left = parseFactor(tokens, pos, ctx, missingKeys, mode);

  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === "op" && (tok.value === "*" || tok.value === "/")) {
      pos.i++;
      const right = parseFactor(tokens, pos, ctx, missingKeys, mode);
      if (tok.value === "/") {
        if (right === 0) {
          if (mode === "strict") {
            throw new Error(`Divisão por zero na expressão`);
          }
          return 0;
        }
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
function parseFactor(
  tokens: Token[],
  pos: { i: number },
  ctx: ExpressionContext,
  missingKeys?: string[],
  mode: EvaluationMode = "tolerant",
): number {
  if (pos.i >= tokens.length) throw new Error("Expressão incompleta");

  const tok = tokens[pos.i];

  // Unary minus
  if (tok.type === "op" && tok.value === "-") {
    pos.i++;
    return -parseFactor(tokens, pos, ctx, missingKeys, mode);
  }

  // Parenthesized expression
  if (tok.type === "paren" && tok.value === "(") {
    pos.i++;
    const val = parseExpressionTracked(tokens, pos, ctx, missingKeys, mode);
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
      if (missingKeys) missingKeys.push(tok.name);
      if (mode === "strict") {
        throw new Error(`Variável não encontrada: ${tok.name}`);
      }
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
 * Evaluate with full tracking: returns value, missingKeys, and error info.
 * Supports tolerant (default, continues with 0) and strict (errors on missing/divzero) modes.
 */
export function evaluateTracked(
  expression: string,
  context: ExpressionContext,
  mode: EvaluationMode = "tolerant",
): EvaluationResult {
  const missingKeys: string[] = [];
  try {
    if (!expression || expression.trim() === "") {
      return { value: null, missingKeys, error: "Expressão vazia" };
    }
    const tokens = tokenize(expression);
    if (tokens.length === 0) {
      return { value: null, missingKeys, error: "Nenhum token encontrado" };
    }
    const pos = { i: 0 };
    const result = parseExpressionTracked(tokens, pos, context, missingKeys, mode);
    const value = isFinite(result) ? Math.round(result * 10000) / 10000 : null;
    return {
      value,
      missingKeys: [...new Set(missingKeys)],
      error: value === null ? "Resultado não-finito" : undefined,
    };
  } catch (err: any) {
    return {
      value: null,
      missingKeys: [...new Set(missingKeys)],
      error: err.message,
    };
  }
}

/**
 * Check if an expression is fixed text (no math operators, no variable refs).
 * Used for custom variables of type "text" that should not be evaluated numerically.
 */
export function isFixedText(expression: string): boolean {
  if (!expression || expression.trim() === "") return false;
  const trimmed = expression.trim();
  const hasVarRefs = /\[[^\]]+\]/.test(trimmed);
  const hasMathOps = /[+\-*\/()]/.test(trimmed);
  return !hasVarRefs && !hasMathOps;
}

/**
 * Evaluate a custom variable expression, handling both numeric and text types.
 * - If tipo_resultado is "text" or expression has no math/var refs → returns text as-is
 * - Otherwise evaluates numerically
 * Returns string result or null on error.
 */
export function evaluateCustomVar(
  expression: string,
  context: ExpressionContext,
  tipoResultado?: string,
): string | null {
  if (!expression || expression.trim() === "") return null;
  const trimmed = expression.trim();

  // Text-type: return as-is
  if (tipoResultado === "text" || isFixedText(trimmed)) {
    return trimmed;
  }

  // Numeric evaluation
  const val = evaluate(trimmed, context);
  return val !== null ? String(val) : null;
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
