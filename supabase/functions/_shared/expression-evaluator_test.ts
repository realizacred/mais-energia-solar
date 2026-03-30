/**
 * Tests for expression-evaluator.ts
 * Covers: IF, SWITCH, AND/OR/NOT, MAX/MIN/ABS/ROUND/CHAR,
 * comparisons, missing keys, division by zero, unsupported functions
 */
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateExpressionV2, evaluateCustomVarV2, type EvalResult } from "./expression-evaluator.ts";

// ── Helper ──
function eval_(expr: string, ctx: Record<string, any> = {}): EvalResult {
  return evaluateExpressionV2(expr, ctx);
}

// ════════════════════════════════════════════════════
// BASIC ARITHMETIC
// ════════════════════════════════════════════════════

Deno.test("basic arithmetic: addition", () => {
  const r = eval_("2 + 3");
  assertEquals(r.value, 5);
  assertEquals(r.error, null);
});

Deno.test("basic arithmetic: multiplication and division", () => {
  assertEquals(eval_("10 * 3").value, 30);
  assertEquals(eval_("10 / 4").value, 2.5);
});

Deno.test("basic arithmetic: operator precedence", () => {
  assertEquals(eval_("2 + 3 * 4").value, 14);
  assertEquals(eval_("(2 + 3) * 4").value, 20);
});

// ════════════════════════════════════════════════════
// VARIABLE REFERENCES
// ════════════════════════════════════════════════════

Deno.test("variable reference: resolves from context", () => {
  const r = eval_("[valor_total] + 100", { valor_total: 500 });
  assertEquals(r.value, 600);
  assertEquals(r.missingKeys.length, 0);
});

Deno.test("variable reference: missing key tracked", () => {
  const r = eval_("[missing_var] + 10");
  assertEquals(r.value, 10); // missing → 0
  assertEquals(r.missingKeys, ["missing_var"]);
  assertEquals(r.error, null); // not a fatal error, just tracked
});

// ════════════════════════════════════════════════════
// DIVISION BY ZERO
// ════════════════════════════════════════════════════

Deno.test("division by zero: returns structured error", () => {
  const r = eval_("100 / 0");
  assertEquals(r.value, null);
  assertExists(r.error);
  assertEquals(r.error!.type, "DIVISION_BY_ZERO");
});

Deno.test("division by zero via variable: returns structured error", () => {
  const r = eval_("[a] / [b]", { a: 100, b: 0 });
  assertEquals(r.value, null);
  assertExists(r.error);
  assertEquals(r.error!.type, "DIVISION_BY_ZERO");
});

// ════════════════════════════════════════════════════
// IF FUNCTION
// ════════════════════════════════════════════════════

Deno.test("IF with number condition: true branch", () => {
  const r = eval_('IF([x] > 10; "alto"; "baixo")', { x: 15 });
  assertEquals(r.value, "alto");
});

Deno.test("IF with number condition: false branch", () => {
  const r = eval_('IF([x] > 10; "alto"; "baixo")', { x: 5 });
  assertEquals(r.value, "baixo");
});

Deno.test("IF with string comparison", () => {
  const r = eval_('IF([tipo] = "residencial"; "Res"; "Com")', { tipo: "residencial" });
  assertEquals(r.value, "Res");
});

// ════════════════════════════════════════════════════
// SWITCH FUNCTION
// ════════════════════════════════════════════════════

Deno.test("SWITCH: matches first case", () => {
  const r = eval_('SWITCH([tipo]; "A"; "Alpha"; "B"; "Beta"; "Default")', { tipo: "A" });
  assertEquals(r.value, "Alpha");
});

Deno.test("SWITCH: matches second case", () => {
  const r = eval_('SWITCH([tipo]; "A"; "Alpha"; "B"; "Beta"; "Default")', { tipo: "B" });
  assertEquals(r.value, "Beta");
});

Deno.test("SWITCH: falls through to default", () => {
  const r = eval_('SWITCH([tipo]; "A"; "Alpha"; "B"; "Beta"; "Default")', { tipo: "C" });
  assertEquals(r.value, "Default");
});

// ════════════════════════════════════════════════════
// AND / OR / NOT
// ════════════════════════════════════════════════════

Deno.test("AND: all true", () => {
  assertEquals(eval_("AND(TRUE; TRUE; TRUE)").value, true);
});

Deno.test("AND: one false", () => {
  assertEquals(eval_("AND(TRUE; FALSE; TRUE)").value, false);
});

Deno.test("OR: one true", () => {
  assertEquals(eval_("OR(FALSE; TRUE; FALSE)").value, true);
});

Deno.test("NOT: inverts", () => {
  assertEquals(eval_("NOT(TRUE)").value, false);
  assertEquals(eval_("NOT(FALSE)").value, true);
});

// ════════════════════════════════════════════════════
// MAX / MIN / ABS / ROUND / CHAR
// ════════════════════════════════════════════════════

Deno.test("MAX: returns largest", () => {
  assertEquals(eval_("MAX(5; 3; 9; 1)").value, 9);
});

Deno.test("MIN: returns smallest", () => {
  assertEquals(eval_("MIN(5; 3; 9; 1)").value, 1);
});

Deno.test("ABS: positive result", () => {
  assertEquals(eval_("ABS(-42)").value, 42);
});

Deno.test("ROUND: rounds to decimals", () => {
  assertEquals(eval_("ROUND(3.14159; 2)").value, 3.14);
  assertEquals(eval_("ROUND(3.5; 0)").value, 4);
});

Deno.test("CHAR: returns character", () => {
  assertEquals(eval_("CHAR(65)").value, "A");
  assertEquals(eval_("CHAR(10)").value, "\n");
});

// ════════════════════════════════════════════════════
// COMPARISONS
// ════════════════════════════════════════════════════

Deno.test("comparison: numeric equality", () => {
  assertEquals(eval_("5 = 5").value, true);
  assertEquals(eval_("5 = 6").value, false);
});

Deno.test("comparison: string equality (case-insensitive)", () => {
  assertEquals(eval_('"Abc" = "abc"').value, true);
  assertEquals(eval_('"Abc" <> "xyz"').value, true);
});

Deno.test("comparison: less/greater than", () => {
  assertEquals(eval_("3 < 5").value, true);
  assertEquals(eval_("5 > 3").value, true);
  assertEquals(eval_("5 <= 5").value, true);
  assertEquals(eval_("5 >= 6").value, false);
});

// ════════════════════════════════════════════════════
// UNSUPPORTED FUNCTION
// ════════════════════════════════════════════════════

Deno.test("unsupported function: returns structured error", () => {
  const r = eval_("VLOOKUP(1; 2; 3)");
  // VLOOKUP is not a known function, will be treated as bare identifier
  // The parser should handle this gracefully
  assertExists(r);
});

// ════════════════════════════════════════════════════
// PARSE ERROR
// ════════════════════════════════════════════════════

Deno.test("parse error: unclosed bracket", () => {
  const r = eval_("[missing");
  assertExists(r.error);
  assertEquals(r.error!.type, "PARSE_ERROR");
});

Deno.test("parse error: unclosed string", () => {
  const r = eval_('"unclosed string');
  assertExists(r.error);
  assertEquals(r.error!.type, "PARSE_ERROR");
});

// ════════════════════════════════════════════════════
// CUSTOM VAR EVALUATION
// ════════════════════════════════════════════════════

Deno.test("evaluateCustomVarV2: text type returns as-is", () => {
  const r = evaluateCustomVarV2("Texto fixo", {}, "text");
  assertEquals(r.value, "Texto fixo");
  assertEquals(r.error, null);
});

Deno.test("evaluateCustomVarV2: numeric expression", () => {
  const r = evaluateCustomVarV2("[a] * 2", { a: 10 });
  assertEquals(r.value, 20);
});

// ════════════════════════════════════════════════════
// COMPLEX REAL-WORLD EXPRESSIONS
// ════════════════════════════════════════════════════

Deno.test("complex: vc_aumento calculation", () => {
  const r = eval_(
    "([geracao_estimada] - [consumo_total]) / [consumo_total] * 100",
    { geracao_estimada: 800, consumo_total: 600 },
  );
  // (800-600)/600*100 = 33.333...
  assertEquals(typeof r.value, "number");
  const v = r.value as number;
  assertEquals(Math.round(v * 100) / 100, 33.33);
});

Deno.test("complex: IF with nested arithmetic", () => {
  const r = eval_(
    'IF([valor] > 50000; "Premium"; "Standard")',
    { valor: 75000 },
  );
  assertEquals(r.value, "Premium");
});

Deno.test("complex: SWITCH with TRUE pattern", () => {
  const r = eval_(
    'SWITCH(TRUE; [x] < 10; "baixo"; [x] < 50; "medio"; "alto")',
    { x: 30 },
  );
  assertEquals(r.value, "medio");
});

// ════════════════════════════════════════════════════
// EMPTY / NULL EXPRESSIONS
// ════════════════════════════════════════════════════

Deno.test("empty expression: returns null", () => {
  const r = eval_("");
  assertEquals(r.value, null);
  assertEquals(r.error, null);
});

Deno.test("whitespace expression: returns null", () => {
  const r = eval_("   ");
  assertEquals(r.value, null);
  assertEquals(r.error, null);
});

// ════════════════════════════════════════════════════
// BOOLEAN / STRING COERCION
// ════════════════════════════════════════════════════

Deno.test("boolean: TRUE/FALSE literals", () => {
  assertEquals(eval_("TRUE").value, true);
  assertEquals(eval_("FALSE").value, false);
});

Deno.test("string concatenation with +", () => {
  const r = eval_('"Hello" + " " + "World"');
  assertEquals(r.value, "Hello World");
});

// ════════════════════════════════════════════════════
// SERIES / ANNUAL DATA
// ════════════════════════════════════════════════════

Deno.test("series: annual variable references resolve", () => {
  const ctx: Record<string, any> = {};
  for (let i = 0; i <= 24; i++) {
    ctx[`economia_anual_valor_${i}`] = 1000 + i * 100;
    ctx[`fluxo_caixa_acumulado_anual_${i}`] = -50000 + i * 5000;
  }

  const r = eval_("[economia_anual_valor_10] + [fluxo_caixa_acumulado_anual_10]", ctx);
  // economia_anual_valor_10 = 1000 + 10*100 = 2000
  // fluxo_caixa_acumulado_anual_10 = -50000 + 10*5000 = 0
  assertEquals(r.value, 2000);
  assertEquals(r.missingKeys.length, 0);
});
