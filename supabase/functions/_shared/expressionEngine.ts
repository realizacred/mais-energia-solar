/**
 * ─── Unified Expression Engine for Deno (Edge Functions) ─────────────
 * Ported from src/lib/expressionEngine.ts for use in backend resolvers.
 * Supports: numbers, strings, booleans, [variable] refs,
 * arithmetic (+, -, *, /, ^), comparisons,
 * IF/SWITCH/AND/OR/NOT/MAX/MIN/ABS/ROUND/CHAR/CONCAT/UPPER/LOWER/LEN/TRIM
 * Separators: both ";" and "," accepted as argument separators.
 * NO eval(), NO Function(), NO arbitrary code execution.
 */

// ── Types ──

export interface ExpressionContext {
  [key: string]: number | string | boolean | null;
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
  "ROUNDDOWN", "ROUNDUP", "FLOOR", "CEILING", "SQRT", "MOD", "LOG",
  "CONCAT", "UPPER", "LOWER", "LEN", "TRIM",
  "TODAY", "YEAR", "MONTH", "DAY",
]);

function tokenize(expr: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const s = expr;

  while (i < s.length) {
    const ch = s[i];

    if (/\s/.test(ch)) { i++; continue; }

    if (ch === ";" || ch === ",") { tokens.push({ type: "semi" }); i++; continue; }

    if (ch === "[") {
      const end = s.indexOf("]", i + 1);
      if (end === -1) throw new Error(`Variável não fechada na posição ${i}`);
      tokens.push({ type: "variable", name: s.slice(i + 1, end).trim() });
      i = end + 1;
      continue;
    }

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

    if (/[0-9]/.test(ch) || (ch === "." && i + 1 < s.length && /[0-9]/.test(s[i + 1]))) {
      let num = "";
      while (i < s.length && /[0-9.]/.test(s[i])) { num += s[i]; i++; }
      const parsed = parseFloat(num);
      if (isNaN(parsed)) throw new Error(`Número inválido: ${num}`);
      tokens.push({ type: "number", value: parsed });
      continue;
    }

    if (ch === "^") { tokens.push({ type: "op", value: "^" }); i++; continue; }

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

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch }); i++; continue;
    }

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

  public parse(): ExpressionValue {
    return this.parseExpression();
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
          left = r === 0 ? 0 : toNum(left) / r;
        }
      } else {
        break;
      }
    }
    return left;
  }

  private parseExponent(): ExpressionValue {
    const base = this.parseUnary();
    const tok = this.peek();
    if (tok.type === "op" && tok.value === "^") {
      this.advance();
      const exp = this.parseExponent();
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
      case "NOT": return !toBool(args[0] ?? false);

      case "MAX": return args.length === 0 ? 0 : Math.max(...args.map(toNum));
      case "MIN": return args.length === 0 ? 0 : Math.min(...args.map(toNum));
      case "ABS": return Math.abs(toNum(args[0]));

      case "ROUND": {
        const decimals = args.length >= 2 ? toNum(args[1]) : 0;
        const factor = Math.pow(10, decimals);
        return Math.round(toNum(args[0]) * factor) / factor;
      }

      case "CHAR": return String.fromCharCode(toNum(args[0]));

      case "ROUNDDOWN": {
        const rd = args.length >= 2 ? toNum(args[1]) : 0;
        const rf = Math.pow(10, rd);
        return Math.floor(toNum(args[0]) * rf) / rf;
      }

      case "ROUNDUP": {
        const ru = args.length >= 2 ? toNum(args[1]) : 0;
        const ruf = Math.pow(10, ru);
        return Math.ceil(toNum(args[0]) * ruf) / ruf;
      }

      case "FLOOR": return Math.floor(toNum(args[0]));
      case "CEILING": return Math.ceil(toNum(args[0]));
      case "SQRT": return Math.sqrt(toNum(args[0]));

      case "MOD": {
        const divisor = toNum(args[1]);
        return divisor === 0 ? 0 : toNum(args[0]) % divisor;
      }

      case "LOG": {
        const lv = toNum(args[0]);
        return lv > 0 ? Math.log(lv) : 0;
      }

      case "CONCAT": return args.map(a => a === null ? "" : String(a)).join("");
      case "UPPER": return String(args[0] ?? "").toUpperCase();
      case "LOWER": return String(args[0] ?? "").toLowerCase();
      case "LEN": return String(args[0] ?? "").length;
      case "TRIM": return String(args[0] ?? "").trim();

      case "TODAY": {
        const now = new Date();
        return now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      }

      case "YEAR": {
        const ds = String(args[0] ?? "");
        const dy = ds.includes("/") ? ds.split("/").pop() : ds.slice(0, 4);
        return parseInt(dy ?? "0", 10) || 0;
      }

      case "MONTH": {
        const ms = String(args[0] ?? "");
        const mp = ms.includes("/") ? ms.split("/")[1] : ms.slice(5, 7);
        return parseInt(mp ?? "0", 10) || 0;
      }

      case "DAY": {
        const das = String(args[0] ?? "");
        const dp = das.includes("/") ? das.split("/")[0] : das.slice(8, 10);
        return parseInt(dp ?? "0", 10) || 0;
      }

      default:
        throw new Error(`Função não suportada: ${name}`);
    }
  }
}

// ── Public API ──

/**
 * Evaluate a formula string with full support for string comparisons,
 * IF/SWITCH, nested functions, etc.
 * Returns: { value, missingKeys } where value can be number, string, boolean, or null.
 */
export function evaluateFormula(
  expression: string,
  context: ExpressionContext,
): { value: ExpressionValue; missingKeys: string[] } {
  if (!expression || expression.trim() === "") {
    return { value: null, missingKeys: [] };
  }
  try {
    const tokens = tokenize(expression.trim());
    const parser = new Parser(tokens, context);
    const value = parser.parse();
    const missingKeys = [...new Set(parser.missingKeys)];
    return { value, missingKeys };
  } catch {
    return { value: null, missingKeys: [] };
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
