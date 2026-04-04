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

function normalizeVariableFormat(text: string): string {
  let normalized = text.replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\]/g, "{{$1}}");
  normalized = normalized.replace(/\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g, "{{$1}}");
  return normalized;
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
 * Simulates the substitution logic from processDocxTemplate (index.ts).
 * All operations happen on raw XML strings — angle brackets in markers
 * are entity-escaped so the XML stays valid.
 */
function simulateSubstitution(
  content: string,
  vars: Record<string, string | null | undefined>,
): { result: string; missingVars: string[]; emptyVars: string[] } {
  content = normalizeVariableFormat(content);
  const emptyKeysSet = new Set<string>();
  const cleanVars: Record<string, string> = {};

  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      emptyKeysSet.add(key);
    } else {
      cleanVars[key] = String(value);
    }
  }

  // Step 2: Replace valid values (XML-escaped)
  for (const [key, value] of Object.entries(cleanVars)) {
    const safeValue = escapeXml(value);
    content = content.replaceAll(`[${key}]`, safeValue);
    content = content.replaceAll(`{{${key}}}`, safeValue);
  }

  // Step 2b: Replace empty values with em-dash (XML-escaped)
  const emptyVars: string[] = [];
  for (const key of emptyKeysSet) {
    if (content.includes(`[${key}]`) || content.includes(`{{${key}}}`)) {
      content = content.replaceAll(`[${key}]`, escapeXml("\u2014"));
      content = content.replaceAll(`{{${key}}}`, escapeXml("\u2014"));
      emptyVars.push(key);
    }
  }

  // Step 3: Missing vars — replace with XML-safe angle bracket marker
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
    // escapeXml("<Area>") produces the string: &lt;Area&gt;
    const safeMarker = escapeXml(`<${varName}>`);
    content = content.replaceAll(`[${varName}]`, safeMarker);
    content = content.replaceAll(`{{${varName}}}`, safeMarker);
  }

  return { result: content, missingVars, emptyVars };
}

// ═══════════════════════════════════════════════════════════
// TESTS — escapeXml function
// ═══════════════════════════════════════════════════════════

Deno.test("escapeXml escapes ampersand", () => {
  assertEquals(escapeXml("A & B"), "A &amp; B");
});

Deno.test("escapeXml escapes angle brackets", () => {
  // Input is literal <Area>, output must be entity-escaped
  const input = "<Area>";
  const output = escapeXml(input);
  // The output string contains the 4 literal characters & l t ; etc.
  assertEquals(output, "&lt;Area&gt;");
  // Verify it does NOT contain a raw < or > around Area
  assertEquals(output.startsWith("<"), false);
  assertEquals(output.includes(">"), false);
});

Deno.test("escapeXml escapes quotes", () => {
  assertEquals(escapeXml('"hello"'), "&quot;hello&quot;");
});

Deno.test("escapeXml escapes apostrophes", () => {
  assertEquals(escapeXml("it's"), "it&apos;s");
});

Deno.test("escapeXml handles combined unsafe chars", () => {
  const input = 'A & B <C> "D" E\'s';
  const expected = "A &amp; B &lt;C&gt; &quot;D&quot; E&apos;s";
  assertEquals(escapeXml(input), expected);
});

// ═══════════════════════════════════════════════════════════
// TESTS — substitution: missing variable
// ═══════════════════════════════════════════════════════════

Deno.test("missing variable produces entity-escaped marker in raw XML", () => {
  // Simulate raw DOCX XML content with a placeholder
  const rawXml = '<w:t>Area: [Area]</w:t>';
  const { result, missingVars } = simulateSubstitution(rawXml, {});

  // The raw XML string must contain entity-escaped angle brackets
  assertEquals(result, "<w:t>Area: &lt;Area&gt;</w:t>");
  assertEquals(missingVars, ["Area"]);

  // Verify the entity-escaped marker is present as literal characters
  assertEquals(result.indexOf("&lt;Area&gt;") > -1, true);

  // Verify NO raw <Area> tag was injected (which would corrupt XML)
  const afterWt = result.replace(/<w:t>/g, "").replace(/<\/w:t>/g, "");
  assertEquals(afterWt.indexOf("<Area>") === -1, true);
});

Deno.test("missing variable with bracket syntax", () => {
  const { result, missingVars } = simulateSubstitution(
    "Potencia: [potencia] Area: [Area]",
    { potencia: "13,4" },
  );
  assertEquals(result, "Potencia: 13,4 Area: &lt;Area&gt;");
  assertEquals(missingVars, ["Area"]);
});

Deno.test("missing variable with mustache syntax", () => {
  const { result, missingVars } = simulateSubstitution(
    "Nome: {{cliente_nome}}",
    {},
  );
  assertEquals(result, "Nome: &lt;cliente_nome&gt;");
  assertEquals(missingVars, ["cliente_nome"]);
});

Deno.test("spaced bracket variable is normalized and replaced", () => {
  const { result, emptyVars, missingVars } = simulateSubstitution(
    "Contrato: [ cliente_nome ]",
    { cliente_nome: "Mateus" },
  );
  assertEquals(result, "Contrato: Mateus");
  assertEquals(emptyVars, []);
  assertEquals(missingVars, []);
});

// ═══════════════════════════════════════════════════════════
// TESTS — substitution: empty variable
// ═══════════════════════════════════════════════════════════

Deno.test("empty variable (null) becomes em-dash", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: null as any },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("empty variable (empty string) becomes em-dash", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: "" },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("empty variable (whitespace only) becomes em-dash", () => {
  const { result, emptyVars } = simulateSubstitution(
    "Payback: [payback]",
    { payback: "   " },
  );
  assertEquals(result, "Payback: \u2014");
  assertEquals(emptyVars, ["payback"]);
});

// ═══════════════════════════════════════════════════════════
// TESTS — values that must NOT be treated as empty
// ═══════════════════════════════════════════════════════════

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
  const { result, emptyVars, missingVars } = simulateSubstitution(
    "Flag: [flag]",
    { flag: false as any },
  );
  assertEquals(result, "Flag: false");
  assertEquals(emptyVars, []);
  assertEquals(missingVars, []);
});

// ═══════════════════════════════════════════════════════════
// TESTS — mixed scenarios
// ═══════════════════════════════════════════════════════════

Deno.test("mixed: value + empty + missing", () => {
  const { result, missingVars, emptyVars } = simulateSubstitution(
    "Area: [Area] Payback: [payback] Potencia: [potencia]",
    { potencia: "13,4", payback: "" },
  );
  assertEquals(result, "Area: &lt;Area&gt; Payback: \u2014 Potencia: 13,4");
  assertEquals(missingVars, ["Area"]);
  assertEquals(emptyVars, ["payback"]);
});

// ═══════════════════════════════════════════════════════════
// TESTS — XML-unsafe characters in values
// ═══════════════════════════════════════════════════════════

Deno.test("XML-unsafe characters in value are escaped", () => {
  const { result } = simulateSubstitution(
    "Nome: [nome]",
    { nome: 'A & B <C> "D"' },
  );
  assertEquals(result, "Nome: A &amp; B &lt;C&gt; &quot;D&quot;");
});

// ═══════════════════════════════════════════════════════════
// TESTS — file name helpers
// ═══════════════════════════════════════════════════════════

Deno.test("slugifyFilePart removes accents", () => {
  assertEquals(slugifyFilePart("Maria L\u00fazia De Souza"), "Maria_Luzia_De_Souza");
});

Deno.test("slugifyFilePart preserves hyphens when flag is set", () => {
  assertEquals(slugifyFilePart("N2025-1795-1", true), "N2025-1795-1");
});

Deno.test("slugifyFilePart removes special characters", () => {
  assertEquals(slugifyFilePart("Jo\u00e3o (da Silva) #3"), "Joao_da_Silva_3");
});

Deno.test("buildProposalFileName full example", () => {
  const result = buildProposalFileName({
    proposalNumber: "N2025-1795-1",
    proposalDate: "2026-01-23",
    customerName: "Maria L\u00fazia De Souza Silva",
  });
  assertEquals(result, "Proposta_N2025-1795-1_2026-01-23_Maria_Luzia_De_Souza_Silva.pdf");
});

Deno.test("buildProposalFileName with null fields", () => {
  const result = buildProposalFileName({
    proposalNumber: null,
    proposalDate: null,
    customerName: null,
  });
  assertEquals(result.startsWith("Proposta_"), true);
  assertEquals(result.endsWith(".pdf"), true);
});

Deno.test("buildProposalFileName with accented name", () => {
  const result = buildProposalFileName({
    proposalNumber: "N1",
    proposalDate: "2026-03-15",
    customerName: "Jos\u00e9 Andr\u00e9 M\u00fcller",
  });
  assertEquals(result, "Proposta_N1_2026-03-15_Jose_Andre_Muller.pdf");
});
