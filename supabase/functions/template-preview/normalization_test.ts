/**
 * Unit tests for normalizeParagraphRuns — the core of the robust DOCX placeholder handling.
 * These test the XML normalization WITHOUT needing Supabase auth.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

// ── Inline the function under test (edge functions can't be imported directly) ──

function normalizeParagraphRuns(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    if (!paraXml.includes("[")) return paraXml;
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) {
      return paraXml;
    }

    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    interface RunInfo {
      full: string;
      start: number;
      end: number;
      isGraphic: boolean;
      hasText: boolean;
      text: string;
    }
    const allRuns: RunInfo[] = [];
    let m;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];
      const isGraphic =
        full.includes("<w:drawing") ||
        full.includes("<w:pict") ||
        full.includes("<mc:AlternateContent") ||
        full.includes("<w:object") ||
        full.includes("<wp:anchor") ||
        full.includes("<wp:inline");

      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const textParts: string[] = [];
      while ((tMatch = tPattern.exec(full)) !== null) {
        textParts.push(tMatch[1]);
      }
      const text = textParts.join("");
      const hasText = textParts.length > 0;
      allRuns.push({ full, start: m.index, end: m.index + full.length, isGraphic, hasText, text });
    }

    const textRuns = allRuns.filter((r) => !r.isGraphic && r.hasText);
    if (textRuns.length < 2) return paraXml;

    const fullText = textRuns.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    let result = paraXml;
    let offset = 0;

    for (let i = 0; i < textRuns.length; i++) {
      const run = textRuns[i];
      let newRunXml: string;

      if (i === 0) {
        let firstReplaced = false;
        newRunXml = run.full.replace(
          /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g,
          () => {
            if (!firstReplaced) {
              firstReplaced = true;
              return `<w:t xml:space="preserve">${fullText}</w:t>`;
            }
            return "<w:t></w:t>";
          },
        );
      } else {
        newRunXml = run.full.replace(
          /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g,
          "<w:t></w:t>",
        );
      }

      const adjStart = run.start + offset;
      const adjEnd = run.end + offset;
      result = result.substring(0, adjStart) + newRunXml + result.substring(adjEnd);
      offset += newRunXml.length - run.full.length;
    }

    return result;
  });
}

// ── TESTS ──

Deno.test("Case 1: bracket split — ['[', 'responsavel_nome]']", () => {
  const xml = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[</w:t></w:r><w:r><w:t>responsavel_nome]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  // After normalization, should contain [responsavel_nome] in the first text run
  assertEquals(result.includes("[responsavel_nome]"), true, "placeholder should be unified");
  // Should preserve first run's rPr
  assertEquals(result.includes("<w:b/>"), true, "should preserve bold formatting");
  // Second run should be emptied but NOT removed (preserves layout)
  assertEquals(result.includes("<w:t></w:t>"), true, "second run emptied but kept");
});

Deno.test("Case 2: trailing bracket split — ['[inversor_fabricante_1', ']']", () => {
  const xml = `<w:p><w:r><w:t>[inversor_fabricante_1</w:t></w:r><w:r><w:t>]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[inversor_fabricante_1]"), true);
});

Deno.test("Case 3: three-way split — ['[', 'inversor_potencia_nominal', ']']", () => {
  const xml = `<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>[</w:t></w:r><w:r><w:t>inversor_potencia_nominal</w:t></w:r><w:r><w:t>]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[inversor_potencia_nominal]"), true);
  assertEquals(result.includes("<w:i/>"), true, "should preserve italic formatting");
});

Deno.test("Case 4: mid-word split — ['[vc_cartao_credito_parcela_', '2', ']']", () => {
  const xml = `<w:p><w:r><w:t>[vc_cartao_credito_parcela_</w:t></w:r><w:r><w:t>2</w:t></w:r><w:r><w:t>]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[vc_cartao_credito_parcela_2]"), true);
});

Deno.test("Case 5: single run placeholder — no merge needed", () => {
  const xml = `<w:p><w:r><w:t>[cliente_nome]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  // Should remain unchanged
  assertEquals(result, xml);
});

Deno.test("Case 6: multiple placeholders in same paragraph, one split one not", () => {
  const xml = `<w:p><w:r><w:t>Nome: [cliente_nome] - Resp: </w:t></w:r><w:r><w:t>[</w:t></w:r><w:r><w:t>responsavel_nome]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[cliente_nome]"), true, "intact placeholder preserved");
  assertEquals(result.includes("[responsavel_nome]"), true, "split placeholder merged");
});

Deno.test("Case 7: paragraph without brackets — untouched", () => {
  const xml = `<w:p><w:r><w:t>Hello world</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result, xml);
});

Deno.test("Case 8: preserve inter-run XML markers while merging", () => {
  const xml = `<w:p><w:r><w:t>[respon</w:t></w:r><w:proofErr w:type="spellStart"/><w:r><w:t>savel_nome]</w:t></w:r><w:proofErr w:type="spellEnd"/></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[responsavel_nome]"), true);
  assertEquals(result.includes("<w:proofErr w:type=\"spellStart\"/>"), true);
  assertEquals(result.includes("<w:proofErr w:type=\"spellEnd\"/>"), true);
});

Deno.test("Case 9: paragraph with drawing (behind-text image) — text runs still normalized", () => {
  const xml = `<w:p><w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:anchor behindDoc="1"><wp:extent cx="100" cy="100"/></wp:anchor></w:drawing></w:r><w:r><w:t>[potencia</w:t></w:r><w:r><w:t>_sistema]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  // Drawing run must be preserved exactly
  assertEquals(result.includes("<w:drawing>"), true, "drawing preserved");
  assertEquals(result.includes("behindDoc"), true, "anchor attributes preserved");
  // Placeholder must be unified in a single run
  assertEquals(result.includes("[potencia_sistema]"), true, "placeholder unified");
});

Deno.test("Case 10: paragraph with mc:AlternateContent — text runs normalized", () => {
  const xml = `<w:p><mc:AlternateContent><mc:Choice Requires="wps"><w:r><w:drawing><wp:anchor/></w:drawing></w:r></mc:Choice></mc:AlternateContent><w:r><w:t>[cidade</w:t></w:r><w:r><w:t>_estado]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[cidade_estado]"), true, "placeholder unified");
  assertEquals(result.includes("<mc:AlternateContent>"), true, "mc:AlternateContent preserved");
});

Deno.test("Case 11: graphic run with w:pict — not modified", () => {
  const xml = `<w:p><w:r><w:pict><v:shape/></w:pict></w:r><w:r><w:t>[nome</w:t></w:r><w:r><w:t>_cliente]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result.includes("[nome_cliente]"), true, "placeholder unified");
  assertEquals(result.includes("<w:pict><v:shape/></w:pict>"), true, "pict preserved");
});

// ═══════════════════════════════════════════════════════════════
// SUBSTITUTION RULES TESTS (layout-safe placeholders)
// ═══════════════════════════════════════════════════════════════

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

// deno-lint-ignore no-explicit-any
function simulateSubstitution(
  template: string,
  vars: Record<string, any>,
): { result: string; missingVars: string[]; emptyVars: string[] } {
  const missingVars: string[] = [];
  const emptyVars: string[] = [];
  const emptyKeysSet = new Set<string>();
  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      emptyKeysSet.add(key);
    }
  }
  let content = template;
  for (const [key, value] of Object.entries(vars)) {
    if (emptyKeysSet.has(key)) continue;
    content = content.replaceAll(`[${key}]`, escapeXml(String(value)));
  }
  for (const key of emptyKeysSet) {
    if (content.includes(`[${key}]`)) {
      content = content.replaceAll(`[${key}]`, escapeXml("—"));
      if (!emptyVars.includes(key)) emptyVars.push(key);
    }
  }
  const remaining = /\[([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\]/g;
  const localMissing: string[] = [];
  let m;
  while ((m = remaining.exec(content)) !== null) {
    if (!localMissing.includes(m[1])) localMissing.push(m[1]);
  }
  for (const varName of localMissing) {
    content = content.replaceAll(`[${varName}]`, `&lt;${varName}&gt;`);
    if (!missingVars.includes(varName)) missingVars.push(varName);
  }
  return { result: content, missingVars, emptyVars };
}

Deno.test("Substitution: missing var → <key> marker", () => {
  const { result, missingVars } = simulateSubstitution("Área: [Area]", {});
  assertEquals(result, "Área: &lt;Area&gt;");
  assertEquals(missingVars, ["Area"]);
});

Deno.test("Substitution: empty string → em-dash", () => {
  const { result, emptyVars } = simulateSubstitution("Área: [Area]", { Area: "" });
  assertEquals(result.includes("—"), true);
  assertEquals(emptyVars, ["Area"]);
});

Deno.test("Substitution: string '0' is NOT empty", () => {
  const { result, emptyVars, missingVars } = simulateSubstitution("Valor: [valor]", { valor: "0" });
  assertEquals(result, "Valor: 0");
  assertEquals(emptyVars.length, 0);
  assertEquals(missingVars.length, 0);
});

Deno.test("Substitution: numeric 0 is NOT empty", () => {
  const { result, emptyVars, missingVars } = simulateSubstitution("Valor: [valor]", { valor: 0 });
  assertEquals(result, "Valor: 0");
  assertEquals(emptyVars.length, 0);
  assertEquals(missingVars.length, 0);
});

Deno.test("Substitution: string 'false' is NOT empty", () => {
  const { result, emptyVars } = simulateSubstitution("Ativo: [ativo]", { ativo: "false" });
  assertEquals(result, "Ativo: false");
  assertEquals(emptyVars.length, 0);
});

Deno.test("Substitution: boolean false is NOT empty", () => {
  const { result, emptyVars } = simulateSubstitution("Ativo: [ativo]", { ativo: false });
  assertEquals(result, "Ativo: false");
  assertEquals(emptyVars.length, 0);
});

Deno.test("Substitution: null var → em-dash", () => {
  const { result, emptyVars } = simulateSubstitution("PB: [payback]", { payback: null as unknown as string });
  assertEquals(result.includes("—"), true);
  assertEquals(emptyVars, ["payback"]);
});

Deno.test("Substitution: no destructive cleanup", () => {
  const { result } = simulateSubstitution("[nome] em [cidade] paga [tarifa]", { nome: "João" });
  assertEquals(result.includes("João"), true);
  assertEquals(result.includes("&lt;cidade&gt;"), true);
  assertEquals(result.includes("&lt;tarifa&gt;"), true);
});

Deno.test("FileName: complete data", () => {
  const fn = buildProposalFileName({ proposalNumber: "N2025-1795-1", proposalDate: "2026-01-23", customerName: "Maria Luzia De Souza Silva" });
  assertEquals(fn, "Proposta_N2025_1795_1_2026_01_23_Maria_Luzia_De_Souza_Silva.pdf");
});

Deno.test("FileName: strips accents", () => {
  const fn = buildProposalFileName({ proposalNumber: null, proposalDate: "2026-03-15", customerName: "José da Conceição" });
  assertEquals(fn, "Proposta_2026_03_15_Jose_da_Conceicao.pdf");
});

Deno.test("FileName: fallback with no data", () => {
  const fn = buildProposalFileName({ proposalNumber: null, proposalDate: null, customerName: null });
  assertEquals(fn.startsWith("Proposta_"), true);
  assertEquals(fn.endsWith(".pdf"), true);
});
