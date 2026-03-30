/**
 * Expression Evaluator v2 — Safe recursive descent parser
 * Supports: numbers, strings, booleans, [variable] refs,
 * arithmetic, comparisons, IF/SWITCH/AND/OR/NOT/MAX/MIN/ABS/ROUND/CHAR
 * Separator: semicolons (;) inside functions
 * NO eval(), NO Function(), NO arbitrary code execution.
 */

export type ExpressionValue = number | string | boolean | null;

export interface ExpressionContext {
  [key: string]: ExpressionValue;
}

export interface EvalError {
  type: "PARSE_ERROR" | "UNSUPPORTED_FUNCTION" | "EXECUTION_ERROR" | "CTX_KEY_MISSING";
  message: string;
  expression: string;
}

export interface EvalResult {
  value: ExpressionValue;
  error: EvalError | null;
  missingKeys: string[];
}

// ── Token types ──

type Token =
  | { type: "number"; value: number }
  | { type: "string"; value: string }
  | { type: "boolean"; value: boolean }
  | { type: "variable"; name: string }
  | { type: "op"; value: string }
  | { type: "paren"; value: "(" | ")" }
  | { type: "semi" }
  | { type: "func"; name: string }
  | { type: "eof" };

// ── Tokenizer ──

const FUNCTIONS = new Set([
  "IF", "SWITCH", "AND", "OR", "NOT", "MAX", "MIN", "ABS", "ROUND", "CHAR",
]);

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr;

  while (i < s.length) {
    const ch = s[i];

    // Skip whitespace
    if (/\s/.test(ch)) { i++; continue; }

    // Semicolon (function argument separator)
    if (ch === ";") { tokens.push({ type: "semi" }); i++; continue; }

    // Variable: [nome_da_variavel]
    if (ch === "[") {
      const end = s.indexOf("]", i + 1);
      if (end === -1) throw new Error(`Variável não fechada na posição ${i}`);
      tokens.push({ type: "variable", name: s.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

    // String literal: "text" or 'text'
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let str = "";
      i++; // skip opening quote
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) { str += s[i + 1]; i += 2; }
        else { str += s[i]; i++; }
      }
      if (i >= s.length) throw new Error(`String não fechada`);
      i++; // skip closing quote
      tokens.push({ type: "string", value: str });
      continue;
    }

    // Number (including decimals and negative handled as unary)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) throw new Error(`Número inválido: ${num}`);
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    // Operators: <=, >=, <>, !=, ==, =, <, >, +, -, *, /
    if ("+-*/".includes(ch)) {
      tokens.push({ type: "op", value: ch }); i++; continue;
    }
    if (ch === "<") {
      if (s[i + 1] === "=") { tokens.push({ type: "op", value: "<=" }); i += 2; }
      else if (s[i + 1] === ">") { tokens.push({ type: "op", value: "<>" }); i += 2; }
      else { tokens.push({ type: "op", value: "<" }); i++; }
      continue;
    }
    if (ch === ">") {
      if (s[i + 1] === "=") { tokens.push({ type: "op", value: ">=" }); i += 2; }
      else { tokens.push({ type: "op", value: ">" }); i++; }
      continue;
    }
    if (ch === "=" && s[i + 1] === "=") { tokens.push({ type: "op", value: "==" }); i += 2; continue; }
    if (ch === "=") { tokens.push({ type: "op", value: "=" }); i++; continue; }
    if (ch === "!" && s[i + 1] === "=") { tokens.push({ type: "op", value: "!=" }); i += 2; continue; }

    // Parentheses
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch }); i++; continue;
    }

    // Identifiers: function names or TRUE/FALSE
    if (/[a-zA-Z_]/.test(ch)) {
      let ident = "";
      while (i < s.length && /[a-zA-Z0-9_]/.test(s[i])) { ident += s[i]; i++; }
      const upper = ident.toUpperCase();
      if (upper === "TRUE") { tokens.push({ type: "boolean", value: true }); continue; }
      if (upper === "FALSE") { tokens.push({ type: "boolean", value: false }); continue; }
      if (upper === "NULL" || upper === "VAZIO") { tokens.push({ type: "number", value: 0 }); continue; }
      if (FUNCTIONS.has(upper)) {
        tokens.push({ type: "func", name: upper }); continue;
      }
      // Treat bare identifiers as variable references (without brackets)
      tokens.push({ type: "variable", name: ident }); continue;
    }

    throw new Error(`Caractere inesperado '${ch}' na posição ${i}`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

// ── Parser ──

class Parser {
  private tokens: Token[];
  private pos = 0;
  private ctx: ExpressionContext;
  public missingKeys: string[] = [];

  constructor(tokens: Token[], ctx: ExpressionContext) {
    this.tokens = tokens;
    this.ctx = ctx;
  }

  private peek(): Token { return this.tokens[this.pos]; }
  private advance(): Token { return this.tokens[this.pos++]; }

  private expect(type: string, value?: string): Token {
    const tok = this.advance();
    if (tok.type !== type || (value !== undefined && (tok as any).value !== value)) {
      throw new Error(`Esperado ${type}${value ? `(${value})` : ""}, encontrado ${tok.type}`);
    }
    return tok;
  }

  // entry: expression
  public parse(): ExpressionValue {
    const result = this.parseExpression();
    const tok = this.peek();
    if (tok.type !== "eof" && tok.type !== "semi" && !(tok.type === "paren" && tok.value === ")")) {
      // Allow trailing content in some contexts
    }
    return result;
  }

  // expression: comparison
  private parseExpression(): ExpressionValue {
    return this.parseComparison();
  }

  // comparison: addition ((<|>|<=|>=|=|==|!=|<>) addition)?
  private parseComparison(): ExpressionValue {
    let left = this.parseAddition();

    while (true) {
      const tok = this.peek();
      if (tok.type === "op" && ["=", "==", "!=", "<>", "<", ">", "<=", ">="].includes(tok.value)) {
        this.advance();
        const right = this.parseAddition();
        left = this.evalComparison(left, tok.value, right);
      } else {
        break;
      }
    }
    return left;
  }

  private evalComparison(left: ExpressionValue, op: string, right: ExpressionValue): boolean {
    const l = this.coerceForComparison(left);
    const r = this.coerceForComparison(right);

    // String comparison (case-insensitive)
    if (typeof l === "string" && typeof r === "string") {
      const ls = l.toLowerCase(), rs = r.toLowerCase();
      switch (op) {
        case "=": case "==": return ls === rs;
        case "!=": case "<>": return ls !== rs;
        case "<": return ls < rs;
        case ">": return ls > rs;
        case "<=": return ls <= rs;
        case ">=": return ls >= rs;
      }
    }

    // Numeric comparison
    const ln = toNum(l), rn = toNum(r);
    switch (op) {
      case "=": case "==": return ln === rn;
      case "!=": case "<>": return ln !== rn;
      case "<": return ln < rn;
      case ">": return ln > rn;
      case "<=": return ln <= rn;
      case ">=": return ln >= rn;
    }
    return false;
  }

  private coerceForComparison(v: ExpressionValue): string | number {
    if (v === null || v === undefined) return 0;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "string") {
      // Try to parse as number first
      const n = parseFloat(v.replace(/,/g, "."));
      if (!isNaN(n) && /^[\d.,\-]+$/.test(v.trim())) return n;
      return v;
    }
    return v;
  }

  // addition: multiplication ((+|-) multiplication)*
  private parseAddition(): ExpressionValue {
    let left = this.parseMultiplication();

    while (true) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.advance();
        const right = this.parseMultiplication();
        if (tok.value === "+") {
          // String concatenation if either side is string and not purely numeric
          if (typeof left === "string" || typeof right === "string") {
            left = String(left ?? "") + String(right ?? "");
          } else {
            left = toNum(left) + toNum(right);
          }
        } else {
          left = toNum(left) - toNum(right);
        }
      } else {
        break;
      }
    }
    return left;
  }

  // multiplication: unary ((*|/) unary)*
  private parseMultiplication(): ExpressionValue {
    let left = this.parseUnary();

    while (true) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "*" || tok.value === "/")) {
        this.advance();
        const right = this.parseUnary();
        if (tok.value === "*") {
          left = toNum(left) * toNum(right);
        } else {
          const r = toNum(right);
          left = r === 0 ? 0 : toNum(left) / r;
        }
      } else {
        break;
      }
    }
    return left;
  }

  // unary: -unary | primary
  private parseUnary(): ExpressionValue {
    const tok = this.peek();
    if (tok.type === "op" && tok.value === "-") {
      this.advance();
      return -toNum(this.parseUnary());
    }
    if (tok.type === "op" && tok.value === "+") {
      this.advance();
      return toNum(this.parseUnary());
    }
    return this.parsePrimary();
  }

  // primary: number | string | boolean | variable | func(...) | (expr)
  private parsePrimary(): ExpressionValue {
    const tok = this.peek();

    if (tok.type === "number") { this.advance(); return tok.value; }
    if (tok.type === "string") { this.advance(); return tok.value; }
    if (tok.type === "boolean") { this.advance(); return tok.value; }

    if (tok.type === "variable") {
      this.advance();
      const val = this.ctx[tok.name];
      if (val === undefined) {
        this.missingKeys.push(tok.name);
        return 0;
      }
      return val;
    }

    if (tok.type === "func") {
      return this.parseFunction();
    }

    if (tok.type === "paren" && tok.value === "(") {
      this.advance();
      const val = this.parseExpression();
      this.expect("paren", ")");
      return val;
    }

    if (tok.type === "eof" || tok.type === "semi") {
      return 0;
    }

    throw new Error(`Token inesperado: ${JSON.stringify(tok)}`);
  }

  // Parse function arguments (semicolon-separated)
  private parseFuncArgs(): ExpressionValue[] {
    this.expect("paren", "(");
    const args: ExpressionValue[] = [];

    if (this.peek().type === "paren" && (this.peek() as any).value === ")") {
      this.advance();
      return args;
    }

    args.push(this.parseExpression());
    while (this.peek().type === "semi") {
      this.advance();
      args.push(this.parseExpression());
    }

    this.expect("paren", ")");
    return args;
  }

  private parseFunction(): ExpressionValue {
    const tok = this.advance() as { type: "func"; name: string };
    const name = tok.name;
    const args = this.parseFuncArgs();

    switch (name) {
      case "IF": {
        // IF(condition; trueVal; falseVal)
        if (args.length < 2) throw new Error("IF requer pelo menos 2 argumentos");
        const cond = toBool(args[0]);
        return cond ? args[1] : (args[2] ?? null);
      }

      case "SWITCH": {
        // SWITCH(value; case1; result1; case2; result2; ...; default?)
        if (args.length < 3) throw new Error("SWITCH requer pelo menos 3 argumentos");
        const switchVal = args[0];
        for (let i = 1; i < args.length - 1; i += 2) {
          if (looseEquals(switchVal, args[i])) return args[i + 1];
        }
        // Default: last arg if odd number of remaining args
        return (args.length % 2 === 0) ? args[args.length - 1] : null;
      }

      case "AND": {
        return args.every(a => toBool(a));
      }

      case "OR": {
        return args.some(a => toBool(a));
      }

      case "NOT": {
        if (args.length < 1) throw new Error("NOT requer 1 argumento");
        return !toBool(args[0]);
      }

      case "MAX": {
        if (args.length === 0) return 0;
        return Math.max(...args.map(toNum));
      }

      case "MIN": {
        if (args.length === 0) return 0;
        return Math.min(...args.map(toNum));
      }

      case "ABS": {
        if (args.length < 1) throw new Error("ABS requer 1 argumento");
        return Math.abs(toNum(args[0]));
      }

      case "ROUND": {
        if (args.length < 1) throw new Error("ROUND requer 1 argumento");
        const decimals = args.length >= 2 ? toNum(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(toNum(args[0]) * factor) / factor;
      }

      case "CHAR": {
        if (args.length < 1) throw new Error("CHAR requer 1 argumento");
        const code = toNum(args[0]);
        return String.fromCharCode(code);
      }

      default:
        throw new Error(`Função não suportada: ${name}`);
    }
  }
}

// ── Helpers ──

function toNum(v: ExpressionValue): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
    // Handle pt-BR formatted numbers: "1.234,56" → 1234.56
    const cleaned = v.replace(/\./g, "").replace(",", ".");
    const n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function toBool(v: ExpressionValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v !== "" && v !== "0" && v.toUpperCase() !== "FALSE";
  return false;
}

function looseEquals(a: ExpressionValue, b: ExpressionValue): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  // String comparison (case-insensitive)
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  // Mixed: try numeric
  const na = toNum(a), nb = toNum(b);
  if (na === nb && (typeof a === "number" || typeof b === "number")) return true;
  // String coercion
  return String(a).toLowerCase() === String(b).toLowerCase();
}

// ── Public API ──

/**
 * Evaluate a safe expression against a context.
 * Returns structured result with value, errors, and missing keys.
 */
export function evaluateExpressionV2(
  expression: string,
  context: ExpressionContext,
): EvalResult {
  const missingKeys: string[] = [];

  if (!expression || expression.trim() === "") {
    return { value: null, error: null, missingKeys };
  }

  try {
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, context);
    const value = parser.parse();

    return {
      value: value !== undefined ? value : null,
      error: null,
      missingKeys: parser.missingKeys,
    };
  } catch (err: any) {
    const message = err?.message || String(err);
    const errorType: EvalError["type"] = message.includes("Função não suportada")
      ? "UNSUPPORTED_FUNCTION"
      : "PARSE_ERROR";

    return {
      value: null,
      error: {
        type: errorType,
        message,
        expression,
      },
      missingKeys,
    };
  }
}

/**
 * Legacy-compatible wrapper: returns number | null for backward compat.
 * Delegates to the new evaluator internally.
 */
export function evaluateExpressionCompat(
  expr: string,
  ctx: Record<string, number>,
): number | null {
  // Convert numeric context to ExpressionContext
  const fullCtx: ExpressionContext = {};
  for (const [k, v] of Object.entries(ctx)) {
    fullCtx[k] = v;
  }

  const result = evaluateExpressionV2(expr, fullCtx);
  if (result.error) return null;
  if (result.value === null) return null;
  if (typeof result.value === "number") {
    return isFinite(result.value) ? Math.round(result.value * 10000) / 10000 : null;
  }
  if (typeof result.value === "boolean") return result.value ? 1 : 0;
  // Try to parse string result as number
  const n = parseFloat(String(result.value).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : Math.round(n * 10000) / 10000;
}

/**
 * Check if an expression is fixed text (no math, no var refs, no functions).
 */
export function isFixedText(expression: string): boolean {
  if (!expression || expression.trim() === "") return false;
  const trimmed = expression.trim();
  return !/[\[\]+\-*\/();<>=!]/.test(trimmed) && !FUNCTIONS.has(trimmed.toUpperCase());
}

/**
 * Evaluate a custom variable expression, handling text and numeric.
 */
export function evaluateCustomVarV2(
  expression: string,
  context: ExpressionContext,
  tipoResultado?: string,
): EvalResult {
  if (!expression || expression.trim() === "") {
    return { value: null, error: null, missingKeys: [] };
  }

  const trimmed = expression.trim();

  // Text-type: return as-is if it's just fixed text
  if (tipoResultado === "text" && isFixedText(trimmed)) {
    return { value: trimmed, error: null, missingKeys: [] };
  }

  return evaluateExpressionV2(trimmed, context);
}

/**
 * Extract all [variable] references from an expression.
 */
export function extractVariableRefs(expression: string): string[] {
  const matches = expression.match(/\[([^\]]+)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1, -1).trim()))];
}
