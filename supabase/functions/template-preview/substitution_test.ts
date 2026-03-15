import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Inline replicas of the exact logic from index.ts for unit testing ──

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function slugifyFilePart(value: string, preserveHyphens = false): string {
  let result = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (preserveHyphens) {
    result = result.replace(/[^a-zA-Z0-9-]+/g, "_");
  } else {
    result = result.replace(/[^a-zA-Z0-9]+/g, "_");
  }
  return result.replace(/_+/g, "_").replace(/^_+|_+$/g, "");
}

function buildProposalFileName(input: {
  proposalNumber?: string | null;
  proposalDate?: string | null;
  customerName?: string | null;
}): string {
  const date =
    input.proposalDate && String(input.proposalDate).trim()
      ? String(input.proposalDate).trim().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  const parts = ["Proposta"];
  if (input.proposalNumber) parts.push(slugifyFilePart(String(input.proposalNumber), true));
  if (date) parts.push(slugifyFilePart(date, true));
  if (input.customerName) parts.push(slugifyFilePart(String(input.customerName)));
  const fileName = parts.filter(Boolean).join("_").slice(0, 180);
  return `${fileName}.pdf`;
}

/**
 * Simulates the substitution logic from processDocxTemplate (index.ts L126-241)
 */
function simulateSubstitution(
  content: string,
  vars: Record<string, string | null | undefined>,
): { result: string; missingVars: string[]; emptyVars: string[] } {
  const emptyKeysSet = new Set<string>();
  const cleanVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      emptyKeysSet.add(key);
    } else {
      cleanVars[key] = String(value);
    }
  }

  // Step 2: Replace valid values
  for (const [key, value] of Object.entries(cleanVars)) {
    const safeValue = escapeXml(value);
    content = content.replaceAll(`[${key}]`, safeValue);
    content = content.replaceAll(`{{${key}}}`, safeValue);
  }

  // Step 2b: Replace empty values with em-dash
  const emptyVars: string[] = [];
  for (const key of emptyKeysSet) {
    if (content.includes(`[${key}]`) || content.includes(`{{${key}}}`)) {
      content = content.replaceAll(`[${key}]`, escapeXml("—"));
      content = content.replaceAll(`{{${key}}}`, escapeXml("—"));
      emptyVars.push(key);
    }
  }

  // Step 3: Missing vars
  const missingVars: string[] = [];
  const remainingBracket = /\[([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\]/g;
  let m;
  while ((m = remainingBracket.exec(content)) !== null) {
    if (!missingVars.includes(m[1])) missingVars.push(m[1]);
  }
  const remainingMustache = /\{\{([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\}\}/g;
  while ((m = remainingMustache.exec(content)) !== null) {
    if (!missingVars.includes(m[1])) missingVars.push(m[1]);
  }

  for (const varName of missingVars) {
    const safeMarker = escapeXml(`<${varName}>`);
    content = content.replaceAll(`[${varName}]`, safeMarker);
    content = content.replaceAll(`{{${varName}}}`, safeMarker);
  }

  return { result: content, missingVars, emptyVars };
}

// ═══════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════

Deno.test("missing variable → <varName> XML-safe marker", () => {
  const { result, missingVars } = simulateSubstitution(
    "Área: [Area] Potência: [potencia]",
    { potencia: "13,4" },
  );
  assertEquals(result, "Área: &lt;Area&gt; Potência: 13,4");
  assertEquals(missingVars, ["Area"]);
});
Deno.test("escapeXml escapes angle brackets", () => {
  const marker = escapeXml(`<Area>`);
  assertEquals(marker, "&lt;Area&gt;");
});

Deno.test("XML raw content contains escaped marker, never raw tag", () => {
  const rawXml = `Área: [Area]`;
  const { result: xmlContent } = simulateSubstitution(rawXml, {});
  assertEquals(xmlContent.includes("&lt;Area&gt;"), true);
  assertEquals(xmlContent.includes("<Area>"), false);
});

Deno.test("empty variable (null) → em-dash —", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: null as any },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("empty variable (empty string) → em-dash —", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: "" },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("empty variable (whitespace only) → em-dash —", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: "   " },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("string '0' is NOT treated as empty", () => {
  const { result, emptyVars, missingVars } = simulateSubstitution(
    "Valor: [valor]",
    { valor: "0" },
  );
  assertEquals(result, "Valor: 0");
  assertEquals(emptyVars, []);
  assertEquals(missingVars, []);
});

Deno.test("numeric 0 (coerced) is NOT treated as empty", () => {
  // Real payloads from JSON parse may arrive as number 0
  const { result, emptyVars, missingVars } = simulateSubstitution(
    "Valor: [valor]",
    { valor: 0 as any },
  );
  assertEquals(result, "Valor: 0");
  assertEquals(emptyVars, []);
  assertEquals(missingVars, []);
});

Deno.test("string '0.00' is NOT treated as empty", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Valor: [valor]",
    { valor: "0.00" },
  );
  assertEquals(result, "Valor: 0.00");
  assertEquals(emptyVars, []);
});

Deno.test("string 'false' is NOT treated as empty", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Flag: [flag]",
    { flag: "false" },
  );
  assertEquals(result, "Flag: false");
  assertEquals(emptyVars, []);
});

Deno.test("boolean false (coerced) is NOT treated as empty", () => {
  // Real payloads from JSON parse may arrive as boolean false
  const { result, emptyVars, missingVars } = simulateSubstitution(
    "Flag: [flag]",
    { flag: false as any },
  );
  assertEquals(result, "Flag: false");
  assertEquals(emptyVars, []);
  assertEquals(missingVars, []);
});

Deno.test("mustache syntax {{var}} missing → XML-safe marker", () => {
  const { result, missingVars } = simulateSubstitution(
    "Nome: {{cliente_nome}}",
    {},
  );
  assertEquals(result, "Nome: &lt;cliente_nome&gt;");
  assertEquals(missingVars, ["cliente_nome"]);
});

Deno.test("mixed: value + empty + missing", () => {
  const { result, missingVars, emptyVars } = simulateSubstitution(
    "Área: [Area] Payback: [payback] Potência: [potencia]",
    { potencia: "13,4", payback: "" },
  );
  assertEquals(result, "Área: &lt;Area&gt; Payback: \u2014 Potência: 13,4");
  assertEquals(missingVars, ["Area"]);
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("XML-unsafe characters in value are escaped", () => {
  const { result } = simulateSubstitution(
    "Nome: [nome]",
    { nome: 'João & Maria <Ltda> "Solar"' },
  );
  assertEquals(result, "Nome: João &amp; Maria &lt;Ltda&gt; &quot;Solar&quot;");
});

// ── File name tests ──

Deno.test("slugifyFilePart removes accents", () => {
  assertEquals(slugifyFilePart("Maria Lúzia De Souza"), "Maria_Luzia_De_Souza");
});

Deno.test("slugifyFilePart preserves hyphens when flag is set", () => {
  assertEquals(slugifyFilePart("N2025-1795-1", true), "N2025-1795-1");
});

Deno.test("slugifyFilePart removes special characters", () => {
  assertEquals(slugifyFilePart("João (da Silva) #3"), "Joao_da_Silva_3");
});

Deno.test("buildProposalFileName full example", () => {
  const result = buildProposalFileName({
    proposalNumber: "N2025-1795-1",
    proposalDate: "2026-01-23",
    customerName: "Maria Lúzia De Souza Silva",
  });
  assertEquals(result, "Proposta_N2025-1795-1_2026-01-23_Maria_Luzia_De_Souza_Silva.pdf");
});

Deno.test("buildProposalFileName with null fields", () => {
  const result = buildProposalFileName({
    proposalNumber: null,
    proposalDate: null,
    customerName: null,
  });
  // Should have Proposta + today's date
  assertEquals(result.startsWith("Proposta_"), true);
  assertEquals(result.endsWith(".pdf"), true);
});

Deno.test("buildProposalFileName with accented name", () => {
  const result = buildProposalFileName({
    proposalNumber: "N1",
    proposalDate: "2026-03-15",
    customerName: "José André Müller",
  });
  assertEquals(result, "Proposta_N1_2026-03-15_Jose_Andre_Muller.pdf");
});
