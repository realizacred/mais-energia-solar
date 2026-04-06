import { strFromU8, strToU8, unzipSync, zipSync } from "npm:fflate@0.8.2";

/**
 * Robust defragmentation of DOCX XML runs.
 * Word splits text like [ cliente_nome ] across multiple <w:r> elements:
 *   <w:r><w:t>[</w:t></w:r><w:r><w:t> cliente_nome </w:t></w:r><w:r><w:t>]</w:t></w:r>
 *
 * This function uses the same approach as template-preview's cleanupRemainingFragments:
 * For each paragraph that contains fragmented bracket/mustache placeholders,
 * consolidate ALL text into the first run's <w:t> and empty subsequent runs.
 */
export function defragmentXml(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    // Skip paragraphs without potential placeholders
    if (!paraXml.includes("[") && !paraXml.includes("{{")) return paraXml;
    // Skip paragraphs with fields or graphics that shouldn't be touched
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) return paraXml;
    if (paraXml.includes("<w:drawing") || paraXml.includes("<mc:AlternateContent")) return paraXml;

    // ── Step 0: Strip intermediate non-text XML elements that break run adjacency ──
    // Word inserts proofErr, bookmarkStart/End, rPrChange etc. BETWEEN runs,
    // fragmenting placeholders. Remove them before extracting text runs.
    let cleanedPara = paraXml;
    // Remove proofing error markers (spell check boundaries)
    cleanedPara = cleanedPara.replace(/<w:proofErr[^/]*\/>/g, "");
    // Remove bookmark start/end markers (they don't contain text)
    cleanedPara = cleanedPara.replace(/<w:bookmarkStart[^/]*\/>/g, "");
    cleanedPara = cleanedPara.replace(/<w:bookmarkEnd[^/]*\/>/g, "");
    // Remove revision property changes inside runs that split text
    // (rPrChange tracks formatting history — safe to strip for text extraction)

    // Extract all text runs
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    interface RunInfo {
      full: string;
      start: number;
      end: number;
      text: string;
      hasText: boolean;
      hasTab: boolean;
      hasBr: boolean;
    }

    const allRuns: RunInfo[] = [];
    let m: RegExpExecArray | null;
    while ((m = runPattern.exec(cleanedPara)) !== null) {
      const full = m[0];
      // Skip graphic runs
      if (full.includes("<w:drawing") || full.includes("<mc:AlternateContent")) {
        continue;
      }

      const hasTab = full.includes("<w:tab");
      const hasBr = full.includes("<w:br");

      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((tMatch = tPattern.exec(full)) !== null) {
        parts.push(tMatch[1]);
      }

      allRuns.push({
        full,
        start: m.index,
        end: m.index + full.length,
        text: parts.join(""),
        hasText: parts.length > 0,
        hasTab,
        hasBr,
      });
    }

    // Filter to text-only runs (skip tab/br runs — they stay untouched)
    const textRuns = allRuns.filter((r) => r.hasText && !r.hasTab && !r.hasBr);
    if (textRuns.length < 2) return paraXml;

    // Concatenate all text to check for complete placeholders
    const fullText = textRuns.map((r) => r.text).join("");

    const completePh = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    const mustachePh = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
    const allComplete: string[] = [];
    let pm: RegExpExecArray | null;

    while ((pm = completePh.exec(fullText)) !== null) allComplete.push(pm[0]);
    while ((pm = mustachePh.exec(fullText)) !== null) allComplete.push(pm[0]);
    if (allComplete.length === 0) return paraXml;

    // Check which placeholders are already intact in individual runs
    const intactInRuns = new Set<string>();
    for (const run of textRuns) {
      const rPh = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
      const rMu = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
      while ((pm = rPh.exec(run.text)) !== null) intactInRuns.add(pm[0]);
      while ((pm = rMu.exec(run.text)) !== null) intactInRuns.add(pm[0]);
    }

    const stillFragmented = allComplete.filter((ph) => !intactInRuns.has(ph));
    if (stillFragmented.length === 0) return paraXml;

    // Consolidate: put all text into first run, empty all others
    // IMPORTANT: Apply changes to the ORIGINAL paraXml (not cleanedPara)
    // so we preserve proofErr/bookmark in output — we only cleaned for analysis
    let result = paraXml;

    // Re-extract runs from ORIGINAL paraXml for offset-correct replacement
    const origRunPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const origRuns: { full: string; start: number; end: number; text: string; hasText: boolean; hasTab: boolean; hasBr: boolean }[] = [];
    while ((m = origRunPattern.exec(paraXml)) !== null) {
      const full = m[0];
      if (full.includes("<w:drawing") || full.includes("<mc:AlternateContent")) continue;
      const hasTab = full.includes("<w:tab");
      const hasBr = full.includes("<w:br");
      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch: RegExpExecArray | null;
      const parts: string[] = [];
      while ((tMatch = tPattern.exec(full)) !== null) parts.push(tMatch[1]);
      origRuns.push({
        full,
        start: m.index,
        end: m.index + full.length,
        text: parts.join(""),
        hasText: parts.length > 0,
        hasTab,
        hasBr,
      });
    }

    const origTextRuns = origRuns.filter((r) => r.hasText && !r.hasTab && !r.hasBr);
    if (origTextRuns.length < 2) return paraXml;

    let offset = 0;

    for (let i = 0; i < origTextRuns.length; i++) {
      const run = origTextRuns[i];
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

export function normalizeVariableFormat(text: string): string {
  // Handle [ variable ] with optional spaces
  let normalized = text.replace(
    /\[\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\]/g,
    "{{$1}}"
  );
  return normalized;
}

export function normalizeDocxVariableFormat(docxBytes: Uint8Array): Uint8Array {
  const unzipped = unzipSync(docxBytes);
  const processed: Record<string, Uint8Array> = {};

  for (const [path, data] of Object.entries(unzipped)) {
    if (path.startsWith("word/") && path.endsWith(".xml")) {
      let xmlStr = strFromU8(data);
      xmlStr = defragmentXml(xmlStr);
      xmlStr = normalizeVariableFormat(xmlStr);
      processed[path] = strToU8(xmlStr);
    } else {
      processed[path] = data;
    }
  }

  return zipSync(processed, { level: 6 });
}
