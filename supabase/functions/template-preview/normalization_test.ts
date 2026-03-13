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

    if (
      paraXml.includes("<w:drawing") ||
      paraXml.includes("<mc:AlternateContent") ||
      paraXml.includes("<w:pict") ||
      paraXml.includes("<w:object") ||
      paraXml.includes("<w:fldChar") ||
      paraXml.includes("<w:instrText")
    ) {
      return paraXml;
    }

    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ xml: string; text: string; rPr: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(paraXml)) !== null) {
      const runXml = runMatch[0];
      const rPrMatch = runXml.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      const textMatch = runXml.match(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/);
      const text = textMatch ? textMatch[1] : "";
      runs.push({ xml: runXml, text, rPr });
    }

    if (runs.length < 2) return paraXml;

    const fullText = runs.map((r) => r.text).join("");
    if (!fullText.includes("[")) return paraXml;

    const charRunIdx: number[] = [];
    for (let ri = 0; ri < runs.length; ri++) {
      for (let ci = 0; ci < runs[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    const phPattern = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    let phMatch;
    const mergeSpans: Array<[number, number]> = [];
    while ((phMatch = phPattern.exec(fullText)) !== null) {
      const startChar = phMatch.index;
      const endChar = startChar + phMatch[0].length - 1;
      if (startChar >= charRunIdx.length || endChar >= charRunIdx.length) continue;
      const startRun = charRunIdx[startChar];
      const endRun = charRunIdx[endChar];
      if (startRun !== endRun) {
        mergeSpans.push([startRun, endRun]);
      }
    }

    if (mergeSpans.length === 0) return paraXml;

    mergeSpans.sort((a, b) => a[0] - b[0]);
    const merged: Array<[number, number]> = [mergeSpans[0]];
    for (let i = 1; i < mergeSpans.length; i++) {
      const prev = merged[merged.length - 1];
      if (mergeSpans[i][0] <= prev[1]) {
        prev[1] = Math.max(prev[1], mergeSpans[i][1]);
      } else {
        merged.push(mergeSpans[i]);
      }
    }

    const firstRunIdx = paraXml.indexOf(runs[0].xml);
    const lastRun = runs[runs.length - 1];
    const lastRunIdx = paraXml.lastIndexOf(lastRun.xml);
    const lastRunEnd = lastRunIdx + lastRun.xml.length;

    if (firstRunIdx < 0 || lastRunIdx < 0) return paraXml;

    const before = paraXml.substring(0, firstRunIdx);
    const after = paraXml.substring(lastRunEnd);
    const runsRegion = paraXml.substring(firstRunIdx, lastRunEnd);

    const interRunContent: string[] = [];
    let searchPos = 0;
    for (let i = 0; i < runs.length; i++) {
      const pos = runsRegion.indexOf(runs[i].xml, searchPos);
      if (pos < 0) return paraXml;
      interRunContent.push(runsRegion.substring(searchPos, pos));
      searchPos = pos + runs[i].xml.length;
    }
    const trailingContent = searchPos < runsRegion.length ? runsRegion.substring(searchPos) : "";

    let rebuiltRegion = "";
    let ri = 0;
    while (ri < runs.length) {
      const span = merged.find((s) => s[0] === ri);
      if (span) {
        const spanInterContent = interRunContent.slice(span[0], span[1] + 1).join("");
        rebuiltRegion += spanInterContent;

        const groupRuns = runs.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr;
        rebuiltRegion += `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
        ri = span[1] + 1;
      } else {
        rebuiltRegion += (interRunContent[ri] ?? "") + runs[ri].xml;
        ri += 1;
      }
    }

    rebuiltRegion += trailingContent;

    return before + rebuiltRegion + after;
  });
}

// ── TESTS ──

Deno.test("Case 1: bracket split — ['[', 'responsavel_nome]']", () => {
  const xml = `<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>[</w:t></w:r><w:r><w:t>responsavel_nome]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  // After normalization, should contain [responsavel_nome] in a single run
  assertEquals(result.includes("[responsavel_nome]"), true, "placeholder should be in single run");
  // Should only have one <w:r>
  const runCount = (result.match(/<w:r>/g) || []).length;
  assertEquals(runCount, 1, "should merge into 1 run");
  // Should preserve first run's rPr
  assertEquals(result.includes("<w:b/>"), true, "should preserve bold formatting");
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

Deno.test("Case 9: skip complex drawing paragraph", () => {
  const xml = `<w:p><w:r><w:drawing/></w:r><w:r><w:t>[cliente_nome]</w:t></w:r></w:p>`;
  const result = normalizeParagraphRuns(xml);
  assertEquals(result, xml);
});
