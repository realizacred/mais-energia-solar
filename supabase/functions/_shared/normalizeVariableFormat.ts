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
    // Keep tabs and explicit line breaks untouched
    if (paraXml.includes("<w:tab") || paraXml.includes("<w:br")) return paraXml;

    // Extract all text runs
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    interface RunInfo {
      full: string;
      start: number;
      end: number;
      text: string;
      hasText: boolean;
    }

    const allRuns: RunInfo[] = [];
    let m: RegExpExecArray | null;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];
      // Skip graphic runs
      if (full.includes("<w:drawing") || full.includes("<mc:AlternateContent")) {
        continue;
      }

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
      });
    }

    const textRuns = allRuns.filter((r) => r.hasText);
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
