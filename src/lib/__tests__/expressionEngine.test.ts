import { describe, it, expect } from "vitest";
import { evaluate, evaluateExpression, evaluateTracked, validateExpression, extractVariables } from "../expressionEngine";

describe("expressionEngine v2 (unified)", () => {
  it("basic arithmetic", () => {
    expect(evaluate("[a] * [b] + [c]", { a: 10, b: 5, c: 3 })).toBe(53);
  });

  it("exponentiation with ^", () => {
    const r = evaluate("[preco]*(1+0.074)^25", { preco: 10000 });
    expect(r).not.toBeNull();
    expect(r!).toBeGreaterThan(59000);
    expect(r!).toBeLessThan(60000);
  });

  it("IF + MAX with comma separator", () => {
    const r = evaluateExpression(
      'IF([capo_seguro]="1 Ano", MAX([vc_a_vista]*(5/100), 139), "0")',
      { capo_seguro: "1 Ano", vc_a_vista: 10000 }
    );
    expect(r).toBe(500);
  });

  it("IF + MAX with semicolon separator", () => {
    const r = evaluateExpression(
      'IF([capo_seguro]="1 Ano"; MAX([vc_a_vista]*(5/100); 139); "0")',
      { capo_seguro: "1 Ano", vc_a_vista: 10000 }
    );
    expect(r).toBe(500);
  });

  it("SWITCH with TRUE", () => {
    const r = evaluateExpression(
      'SWITCH(TRUE; [nome]=[b1]; 36; [nome]=[b2]; 48; 0)',
      { nome: "Banco A", b1: "Banco A", b2: "Banco B" }
    );
    expect(r).toBe(36);
  });

  it("nested IF (5 levels)", () => {
    const r = evaluateExpression(
      'IF([x]="a", 1, IF([x]="b", 2, IF([x]="c", 3, IF([x]="d", 4, IF([x]="e", 5, 0)))))',
      { x: "d" }
    );
    expect(r).toBe(4);
  });

  it("division by zero returns 0 in tolerant", () => {
    expect(evaluate("[a] / [b]", { a: 10, b: 0 })).toBe(0);
  });

  it("missing var tracked", () => {
    const r = evaluateTracked("[missing] + 5", {});
    expect(r.degraded).toBe(true);
    expect(r.missingKeys).toContain("missing");
    expect(r.value).toBe(5);
  });

  it("validateExpression detects errors", () => {
    expect(validateExpression("IF(").valid).toBe(false);
    expect(validateExpression("[a] + [b]").valid).toBe(true);
  });

  it("extractVariables", () => {
    expect(extractVariables("[a] + [b] * [a]")).toEqual(["a", "b"]);
  });

  it("string comparison case-insensitive", () => {
    const r = evaluateExpression('IF([x]="ABC", 1, 0)', { x: "abc" });
    expect(r).toBe(1);
  });
});
