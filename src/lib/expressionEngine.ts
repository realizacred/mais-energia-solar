/**
 * ─── Unified Expression Engine (v2 ported from BE) ─────────────
 * Supports: numbers, strings, booleans, [variable] refs,
 * arithmetic (+, -, *, /, ^), comparisons, 
 * IF/SWITCH/AND/OR/NOT/MAX/MIN/ABS/ROUND/CHAR
 * Separators: both ";" and "," accepted as argument separators.
 * NO eval(), NO Function(), NO arbitrary code execution.
 * 
 * Based on supabase/functions/_shared/expression-evaluator.ts
 * Ported to browser TypeScript for FE preview/audit.
 */

// ── Public types (backward compatible with v1 API) ──

export interface ExpressionContext {
  [key: string]: number | string | boolean | null;
}

export type EvaluationMode = "tolerant" | "strict";

export interface EvaluationResult {
  value: number | null;
  missingKeys: string[];
  degraded: boolean;
  error?: string;
}

type ExpressionValue = number | string | boolean | null;

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

    if (/\s/.test(ch)) { i++; continue; }

    // Semicolon OR comma → argument separator
    if (ch === ";" || ch === ",") { tokens.push({ type: "semi" }); i++; continue; }

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
      i++;
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) { str += s[i + 1]; i += 2; }
        else { str += s[i]; i++; }
      }
      if (i >= s.length) throw new Error(`String não fechada`);
      i++;
      tokens.push({ type: "string", value: str });
      continue;
    }

    // Number (including decimals)
    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) throw new Error(`Número inválido: ${num}`);
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    // Caret (exponentiation)
    if (ch === "^") { tokens.push({ type: "op", value: "^" }); i++; continue; }

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
      tokens.push({ type: "variable", name: ident }); continue;
    }

    throw new Error(`Caractere inesperado '${ch}' na posição ${i}`);
  }

  tokens.push({ type: "eof" });
  return tokens;
}

// ── Helpers ──

function toNum(v: ExpressionValue): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (typeof v === "string") {
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
  if (typeof a === "string" && typeof b === "string") {
    return a.toLowerCase() === b.toLowerCase();
  }
  const na = toNum(a), nb = toNum(b);
  if (na === nb && (typeof a === "number" || typeof b === "number")) return true;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

// ── Parser ──

class Parser {
  private tokens: Token[];
  private pos = 0;
  private ctx: ExpressionContext;
  public missingKeys: string[] = [];
  private mode: EvaluationMode;

  constructor(tokens: Token[], ctx: ExpressionContext, mode: EvaluationMode = "tolerant") {
    this.tokens = tokens;
    this.ctx = ctx;
    this.mode = mode;
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

  public parse(): ExpressionValue {
    const result = this.parseExpression();
    return result;
  }

  private parseExpression(): ExpressionValue {
    return this.parseComparison();
  }

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
      const n = parseFloat(v.replace(/,/g, "."));
      if (!isNaN(n) && /^[\d.,\-]+$/.test(v.trim())) return n;
      return v;
    }
    return v;
  }

  private parseAddition(): ExpressionValue {
    let left = this.parseMultiplication();

    while (true) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "+" || tok.value === "-")) {
        this.advance();
        const right = this.parseMultiplication();
        if (tok.value === "+") {
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

  private parseMultiplication(): ExpressionValue {
    let left = this.parseExponent();

    while (true) {
      const tok = this.peek();
      if (tok.type === "op" && (tok.value === "*" || tok.value === "/")) {
        this.advance();
        const right = this.parseExponent();
        if (tok.value === "*") {
          left = toNum(left) * toNum(right);
        } else {
          const r = toNum(right);
          if (r === 0) {
            if (this.mode === "strict") {
              throw new Error("Divisão por zero");
            }
            left = 0;
          } else {
            left = toNum(left) / r;
          }
        }
      } else {
        break;
      }
    }
    return left;
  }

  // Exponentiation: unary (^ unary)* — right-associative
  private parseExponent(): ExpressionValue {
    const base = this.parseUnary();
    const tok = this.peek();
    if (tok.type === "op" && tok.value === "^") {
      this.advance();
      const exp = this.parseExponent(); // right-associative via recursion
      return Math.pow(toNum(base), toNum(exp));
    }
    return base;
  }

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
        if (this.mode === "strict") {
          throw new Error(`Variável não encontrada: ${tok.name}`);
        }
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
        if (args.length < 2) throw new Error("IF requer pelo menos 2 argumentos");
        const cond = toBool(args[0]);
        return cond ? args[1] : (args[2] ?? null);
      }

      case "SWITCH": {
        if (args.length < 3) throw new Error("SWITCH requer pelo menos 3 argumentos");
        const switchVal = args[0];
        for (let i = 1; i < args.length - 1; i += 2) {
          if (looseEquals(switchVal, args[i])) return args[i + 1];
        }
        return (args.length % 2 === 0) ? args[args.length - 1] : null;
      }

      case "AND": return args.every(a => toBool(a));
      case "OR": return args.some(a => toBool(a));

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

// ── Public API (backward-compatible with v1 exports) ──

/**
 * Evaluate a safe expression string against a context of named values.
 * Returns the numeric result or null on error.
 */
export function evaluate(expression: string, context: ExpressionContext): number | null {
  try {
    if (!expression || expression.trim() === "") return null;
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, context);
    const value = parser.parse();
    if (value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "number") return isFinite(value) ? Math.round(value * 10000) / 10000 : null;
    const n = parseFloat(String(value).replace(/\./g, "").replace(",", "."));
    return isNaN(n) ? null : Math.round(n * 10000) / 10000;
  } catch {
    return null;
  }
}

/**
 * Full expression evaluation returning value + missingKeys + errors.
 * Now supports IF, SWITCH, MAX, MIN, ^, etc.
 */
export function evaluateExpression(
  formula: string,
  variables: Record<string, number | string>,
): number | string | null {
  if (!formula || formula.trim() === "") return null;
  try {
    const ctx: ExpressionContext = {};
    for (const [k, v] of Object.entries(variables)) ctx[k] = v;
    const tokens = tokenize(formula.trim());
    const parser = new Parser(tokens, ctx);
    const value = parser.parse();
    if (value === null) return null;
    if (typeof value === "boolean") return value ? 1 : 0;
    if (typeof value === "string") return value;
    if (typeof value === "number") return isFinite(value) ? Math.round(value * 10000) / 10000 : null;
    return null;
  } catch {
    return null;
  }
}

/**
 * Evaluate with full tracking: returns value, missingKeys, and error info.
 */
export function evaluateTracked(
  expression: string,
  context: ExpressionContext,
  mode: EvaluationMode = "tolerant",
): EvaluationResult {
  const missingKeys: string[] = [];
  try {
    if (!expression || expression.trim() === "") {
      return { value: null, missingKeys, degraded: false, error: "Expressão vazia" };
    }
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, context, mode);
    const raw = parser.parse();

    let value: number | null = null;
    if (raw !== null) {
      if (typeof raw === "number") value = isFinite(raw) ? Math.round(raw * 10000) / 10000 : null;
      else if (typeof raw === "boolean") value = raw ? 1 : 0;
      else {
        const n = parseFloat(String(raw).replace(/\./g, "").replace(",", "."));
        value = isNaN(n) ? null : Math.round(n * 10000) / 10000;
      }
    }

    const uniqueMissing = [...new Set(parser.missingKeys)];
    return {
      value,
      missingKeys: uniqueMissing,
      degraded: uniqueMissing.length > 0,
      error: value === null ? "Resultado não-finito" : undefined,
    };
  } catch (err: any) {
    return {
      value: null,
      missingKeys: [...new Set(missingKeys)],
      degraded: true,
      error: err.message,
    };
  }
}

/**
 * Check if an expression is fixed text (no math, no var refs, no functions).
 */
export function isFixedText(expression: string): boolean {
  if (!expression || expression.trim() === "") return false;
  const trimmed = expression.trim();
  return !/[\[\]+\-*\/();<>=!^,]/.test(trimmed) && !FUNCTIONS.has(trimmed.toUpperCase());
}

/**
 * Evaluate a custom variable expression, handling both numeric and text types.
 */
export function evaluateCustomVar(
  expression: string,
  context: ExpressionContext,
  tipoResultado?: string,
): string | null {
  if (!expression || expression.trim() === "") return null;
  const trimmed = expression.trim();

  if (tipoResultado === "text" && isFixedText(trimmed)) {
    return trimmed;
  }

  try {
    const tokens = tokenize(trimmed);
    const parser = new Parser(tokens, context);
    const value = parser.parse();
    if (value === null) return null;
    return String(value);
  } catch {
    return null;
  }
}

/**
 * Extract all variable names referenced in an expression.
 */
export function extractVariables(expression: string): string[] {
  const matches = expression.match(/\[([^\]]+)\]/g);
  if (!matches) return [];
  return [...new Set(matches.map(m => m.slice(1, -1).trim()))];
}

/**
 * Validate an expression without evaluating it.
 */
export function validateExpression(expression: string): { valid: boolean; error?: string } {
  try {
    if (!expression || expression.trim() === "") return { valid: false, error: "Expressão vazia" };
    const tokens = tokenize(expression.trim());
    if (tokens.length <= 1) return { valid: false, error: "Nenhum token encontrado" };
    const parser = new Parser(tokens, {});
    parser.parse();
    return { valid: true };
  } catch (err: any) {
    return { valid: false, error: err.message };
  }
}

/**
 * List of supported functions for UI display.
 */
export const SUPPORTED_FUNCTIONS = [
  { name: "IF", syntax: "IF(condição; valor_verdadeiro; valor_falso)", example: 'IF([x]>10; "grande"; "pequeno")' },
  { name: "SWITCH", syntax: "SWITCH(valor; caso1; resultado1; ...; default)", example: 'SWITCH([tipo]; "A"; 100; "B"; 200; 0)' },
  { name: "MAX", syntax: "MAX(valor1; valor2; ...)", example: "MAX([a]; [b]; 100)" },
  { name: "MIN", syntax: "MIN(valor1; valor2; ...)", example: "MIN([a]; [b]; 0)" },
  { name: "ROUND", syntax: "ROUND(valor; decimais)", example: "ROUND([x]; 2)" },
  { name: "ABS", syntax: "ABS(valor)", example: "ABS([diferenca])" },
  { name: "AND", syntax: "AND(cond1; cond2; ...)", example: "AND([x]>0; [y]>0)" },
  { name: "OR", syntax: "OR(cond1; cond2; ...)", example: "OR([x]>10; [y]>10)" },
  { name: "NOT", syntax: "NOT(condição)", example: "NOT([ativo]=0)" },
  { name: "CHAR", syntax: "CHAR(código)", example: "CHAR(10)" },
] as const;
