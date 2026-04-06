/**
 * docxProcessor.ts — Shared DOCX XML processing pipeline.
 * 
 * SSOT for variable substitution in DOCX templates.
 * Used by both template-preview and generate-document.
 * 
 * Pipeline (RB-39):
 * 1. normalizeTextBoxRuns() — handle text boxes (w:txbxContent)
 * 2. normalizeParagraphRuns() — targeted run merging for fragmented placeholders
 * 3. cleanupRemainingFragments() — aggressive cleanup for still-fragmented placeholders
 * 4. normalizeVariableFormat() — [ var ] and [var] → {{var}}
 * 5. Clean XML tags inside {{ }}
 * 6. replaceVars() with escapeXml() — substitute values
 * 7. evaluateInlineFormulas() — IF()/SWITCH() post-substitution
 * 8. Clean residual placeholders
 * 
 * DA-21: Uses fflate nativo, not docxtemplater/PizZip.
 */

// ═══════════════════════════════════════════════════════════════
// XML ESCAPE
// ═══════════════════════════════════════════════════════════════

export function escapeXml(str: string): string {
  return str
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ═══════════════════════════════════════════════════════════════
// GRAPHIC MARKUP DETECTION
// ═══════════════════════════════════════════════════════════════

function hasSensitiveGraphicMarkup(xml: string): boolean {
  return (
    xml.includes("<w:drawing") ||
    xml.includes("<w:pict") ||
    xml.includes("<mc:AlternateContent") ||
    xml.includes("<w:object") ||
    xml.includes("<wp:anchor") ||
    xml.includes("<wp:inline")
  );
}

// ═══════════════════════════════════════════════════════════════
// TEXT BOX NORMALIZATION
// ═══════════════════════════════════════════════════════════════

export function normalizeTextBoxRuns(xml: string): string {
  return xml.replace(/<w:txbxContent[^>]*>([^]*?)<\/w:txbxContent>/g, (_match, innerContent) => {
    const processed = normalizeParagraphRunsInner(innerContent);
    return `<w:txbxContent>${processed}</w:txbxContent>`;
  });
}

function normalizeParagraphRunsInner(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    if (!paraXml.includes("[") && !paraXml.includes("{{")) return paraXml;
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) return paraXml;
    if (hasSensitiveGraphicMarkup(paraXml)) return paraXml;

    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ xml: string; text: string; rPr: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(paraXml)) !== null) {
      const runXml = runMatch[0];
      const rPrMatch = runXml.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";
      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const textParts: string[] = [];
      while ((tMatch = tPattern.exec(runXml)) !== null) {
        textParts.push(tMatch[1]);
      }
      const text = textParts.join("");
      runs.push({ xml: runXml, text, rPr });
    }

    if (runs.length < 2) return paraXml;

    const fullText = runs.map((r) => r.text).join("");
    if (!fullText.includes("[") && !fullText.includes("{{")) return paraXml;

    const charRunIdx: number[] = [];
    for (let ri = 0; ri < runs.length; ri++) {
      for (let ci = 0; ci < runs[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    const mergeSpans: Array<[number, number]> = [];

    const phPattern = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    let phMatch;
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

    const mustachePh = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
    while ((phMatch = mustachePh.exec(fullText)) !== null) {
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
        rebuiltRegion += (interRunContent[span[0]] ?? "");
        const groupRuns = runs.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr;
        rebuiltRegion += `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
        for (let j = span[0] + 1; j <= span[1]; j++) {
          rebuiltRegion += (interRunContent[j] ?? "");
        }
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

// ═══════════════════════════════════════════════════════════════
// PARAGRAPH NORMALIZATION (main document)
// ═══════════════════════════════════════════════════════════════

export function normalizeParagraphRuns(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    const hasLegacy = paraXml.includes("[");
    const hasMustache = paraXml.includes("{{");
    if (!hasLegacy && !hasMustache) return paraXml;

    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) {
      return paraXml;
    }
    if (hasSensitiveGraphicMarkup(paraXml)) {
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
      rPr: string;
    }
    const allRuns: RunInfo[] = [];
    let m;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];
      const isGraphic = hasSensitiveGraphicMarkup(full);

      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const textParts: string[] = [];
      while ((tMatch = tPattern.exec(full)) !== null) {
        textParts.push(tMatch[1]);
      }
      const text = textParts.join("");
      const hasText = textParts.length > 0;
      const rPrMatch = full.match(/<w:rPr>[^]*?<\/w:rPr>/);
      const rPr = rPrMatch ? rPrMatch[0] : "";

      allRuns.push({ full, start: m.index, end: m.index + full.length, isGraphic, hasText, text, rPr });
    }

    const textRuns = allRuns.filter((r) => !r.isGraphic && r.hasText);
    if (textRuns.length < 2) return paraXml;

    const fullText = textRuns.map((r) => r.text).join("");
    if (!fullText.includes("[") && !fullText.includes("{{")) return paraXml;

    const charRunIdx: number[] = [];
    for (let ri = 0; ri < textRuns.length; ri++) {
      for (let ci = 0; ci < textRuns[ri].text.length; ci++) {
        charRunIdx.push(ri);
      }
    }

    const mergeSpans: Array<[number, number]> = [];

    const legacyPh = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    let phMatch;
    while ((phMatch = legacyPh.exec(fullText)) !== null) {
      const startChar = phMatch.index;
      const endChar = startChar + phMatch[0].length - 1;
      if (startChar >= charRunIdx.length || endChar >= charRunIdx.length) continue;
      const startRun = charRunIdx[startChar];
      const endRun = charRunIdx[endChar];
      if (startRun !== endRun) {
        mergeSpans.push([startRun, endRun]);
      }
    }

    const mustachePh = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
    while ((phMatch = mustachePh.exec(fullText)) !== null) {
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

    const firstRunIdx = paraXml.indexOf(textRuns[0].full);
    const lastRun = textRuns[textRuns.length - 1];
    const lastRunIdx = paraXml.lastIndexOf(lastRun.full);
    const lastRunEnd = lastRunIdx + lastRun.full.length;

    if (firstRunIdx < 0 || lastRunIdx < 0) return paraXml;

    const before = paraXml.substring(0, firstRunIdx);
    const after = paraXml.substring(lastRunEnd);
    const runsRegion = paraXml.substring(firstRunIdx, lastRunEnd);

    const interRunContent: string[] = [];
    let searchPos = 0;
    for (let i = 0; i < textRuns.length; i++) {
      const pos = runsRegion.indexOf(textRuns[i].full, searchPos);
      if (pos < 0) return paraXml;
      interRunContent.push(runsRegion.substring(searchPos, pos));
      searchPos = pos + textRuns[i].full.length;
    }
    const trailingContent = searchPos < runsRegion.length ? runsRegion.substring(searchPos) : "";

    let rebuiltRegion = "";
    let ri = 0;
    while (ri < textRuns.length) {
      const span = merged.find((s) => s[0] === ri);
      if (span) {
        rebuiltRegion += (interRunContent[span[0]] ?? "");
        const groupRuns = textRuns.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr;
        rebuiltRegion += `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
        for (let j = span[0] + 1; j <= span[1]; j++) {
          rebuiltRegion += (interRunContent[j] ?? "");
        }
        ri = span[1] + 1;
      } else {
        rebuiltRegion += (interRunContent[ri] ?? "") + textRuns[ri].full;
        ri += 1;
      }
    }

    rebuiltRegion += trailingContent;
    return before + rebuiltRegion + after;
  });
}

// ═══════════════════════════════════════════════════════════════
// AGGRESSIVE FRAGMENT CLEANUP
// ═══════════════════════════════════════════════════════════════

export function cleanupRemainingFragments(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    if (!paraXml.includes("[") && !paraXml.includes("{{")) return paraXml;
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) return paraXml;
    if (hasSensitiveGraphicMarkup(paraXml)) return paraXml;

    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    interface RunInfo {
      full: string;
      start: number;
      end: number;
      text: string;
      hasText: boolean;
      isGraphic: boolean;
    }

    const allRuns: RunInfo[] = [];
    let m: RegExpExecArray | null;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];
      const isGraphic = hasSensitiveGraphicMarkup(full);

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
        isGraphic,
      });
    }

    const textRuns = allRuns.filter((r) => !r.isGraphic && r.hasText);
    if (textRuns.length < 2) return paraXml;

    const fullText = textRuns.map((r) => r.text).join("");

    const completePh = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
    const mustachePh = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
    const allComplete: string[] = [];
    let pm: RegExpExecArray | null;

    while ((pm = completePh.exec(fullText)) !== null) allComplete.push(pm[0]);
    while ((pm = mustachePh.exec(fullText)) !== null) allComplete.push(pm[0]);
    if (allComplete.length === 0) return paraXml;

    const intactInRuns = new Set<string>();
    for (const run of textRuns) {
      const rPh = /\[[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\]/g;
      const rMu = /\{\{[a-zA-Z_][a-zA-Z0-9_.\-]{0,120}\}\}/g;
      while ((pm = rPh.exec(run.text)) !== null) intactInRuns.add(pm[0]);
      while ((pm = rMu.exec(run.text)) !== null) intactInRuns.add(pm[0]);
    }

    const stillFragmented = allComplete.filter((ph) => !intactInRuns.has(ph));
    if (stillFragmented.length === 0) return paraXml;

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

// ═══════════════════════════════════════════════════════════════
// VARIABLE SUBSTITUTION
// ═══════════════════════════════════════════════════════════════

export function replaceVars(text: string, ctx: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (_match, key: string) => {
    const k = key.trim();
    const value = ctx[k] ?? ctx[k.replace(/\./g, "_")] ?? ctx[k.replace(/_/g, ".")] ?? "";
    return escapeXml(String(value));
  });
}

// ═══════════════════════════════════════════════════════════════
// INLINE FORMULA EVALUATOR — IF()/SWITCH()
// ═══════════════════════════════════════════════════════════════

export function evaluateInlineFormulas(text: string): string {
  const MAX_PASSES = 10;
  let result = text;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const ifIdx = findIFStart(result);
    if (ifIdx === -1) break;
    const openParen = result.indexOf("(", ifIdx);
    if (openParen === -1) break;
    const closeParen = findMatchingParen(result, openParen);
    if (closeParen === -1) break;
    const argsStr = result.substring(openParen + 1, closeParen);
    const evaluated = evaluateSingleIF(argsStr);
    result = result.substring(0, ifIdx) + evaluated + result.substring(closeParen + 1);
  }
  return result;
}

function findIFStart(text: string): number {
  const lower = text.toLowerCase();
  let idx = 0;
  while (idx < text.length) {
    const pos = lower.indexOf("if", idx);
    if (pos === -1) return -1;
    let j = pos + 2;
    while (j < text.length && text[j] === " ") j++;
    if (j < text.length && text[j] === "(") return pos;
    idx = pos + 1;
  }
  return -1;
}

function findMatchingParen(text: string, openPos: number): number {
  let depth = 0;
  let inQuote = false;
  let quoteChar = "";
  for (let i = openPos; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function evaluateSingleIF(argsStr: string): string {
  const resolved = evaluateInlineFormulas(argsStr);
  const parts = splitFormulaParts(resolved);
  if (parts.length < 3) return argsStr;

  const condition = parts[0].trim();
  const thenVal = unquote(parts[1].trim());
  const elseVal = unquote(parts[2].trim());

  const neqMatch = condition.match(/^(.+?)<>(.+)$/);
  const eqMatch = condition.match(/^(.+?)=(.+)$/);

  if (neqMatch) {
    const left = unquote(neqMatch[1].trim());
    const right = unquote(neqMatch[2].trim());
    return left !== right ? thenVal : elseVal;
  }
  if (eqMatch) {
    const left = unquote(eqMatch[1].trim());
    const right = unquote(eqMatch[2].trim());
    return left === right ? thenVal : elseVal;
  }

  const condClean = unquote(condition);
  if (condClean && condClean !== "0" && condClean.toLowerCase() !== "false") {
    return thenVal;
  }
  return elseVal;
}

function splitFormulaParts(s: string): string[] {
  const parts: string[] = [];
  let current = "";
  let inQuote = false;
  let quoteChar = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuote) {
      if (ch === quoteChar) inQuote = false;
      current += ch;
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
      current += ch;
    } else if (ch === ";" || ch === ",") {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  parts.push(current);
  return parts;
}

function unquote(s: string): string {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if (s.startsWith("&quot;") && s.endsWith("&quot;")) {
    return s.slice(6, -6);
  }
  return s;
}

// ═══════════════════════════════════════════════════════════════
// XML TAGS CLEANUP INSIDE PLACEHOLDERS
// ═══════════════════════════════════════════════════════════════

export function cleanXmlTagsInsidePlaceholders(xmlStr: string): string {
  return xmlStr.replace(
    /\{\{((?:[^}]|(?:\}[^}]))*?)\}\}/g,
    (fullMatch) => {
      const cleaned = fullMatch.replace(/<[^>]+>/g, "");
      return cleaned;
    },
  );
}

// ═══════════════════════════════════════════════════════════════
// RESIDUAL PLACEHOLDER CLEANUP
// ═══════════════════════════════════════════════════════════════

export function cleanResidualPlaceholders(xmlStr: string): string {
  xmlStr = xmlStr.replace(/\{\{[^}]+\}\}/g, "");
  xmlStr = xmlStr.replace(/\[[a-zA-Z_][a-zA-Z0-9_.]*\]/g, "");
  return xmlStr;
}

// ═══════════════════════════════════════════════════════════════
// HIGH-LEVEL PIPELINE — processXmlContent
// ═══════════════════════════════════════════════════════════════

import { normalizeVariableFormat } from "./normalizeVariableFormat.ts";

/**
 * Process a single XML string through the full DOCX pipeline.
 * This is the SSOT for variable substitution in DOCX XML.
 */
export function processXmlContent(
  xmlStr: string,
  vars: Record<string, string>,
): string {
  // Step 1a: Normalize runs inside text boxes
  xmlStr = normalizeTextBoxRuns(xmlStr);

  // Step 1b: Normalize split runs in regular paragraphs
  xmlStr = normalizeParagraphRuns(xmlStr);

  // Step 1c: Aggressive cleanup for still-fragmented placeholders
  xmlStr = cleanupRemainingFragments(xmlStr);

  // Step 2: Normalize [ var ] → {{var}}
  xmlStr = normalizeVariableFormat(xmlStr);

  // Step 3: Clean XML tags trapped inside {{ }}
  xmlStr = cleanXmlTagsInsidePlaceholders(xmlStr);

  // Step 4: Replace variables
  xmlStr = replaceVars(xmlStr, vars);

  // Step 5: Evaluate inline IF()/SWITCH() formulas
  xmlStr = evaluateInlineFormulas(xmlStr);

  // Step 6: Clean residual placeholders
  xmlStr = cleanResidualPlaceholders(xmlStr);

  return xmlStr;
}

/**
 * Determine if an XML file inside a DOCX should be processed for variable substitution.
 */
export function shouldProcessXmlFile(relativePath: string): boolean {
  if (!relativePath.startsWith("word/")) return false;
  if (!relativePath.endsWith(".xml")) return false;
  if (relativePath.includes("/_rels/")) return false;
  if (relativePath.startsWith("word/media/")) return false;
  if (relativePath.startsWith("word/theme/")) return false;
  if (relativePath.startsWith("word/glossary/")) return false;
  if (relativePath.startsWith("word/charts/")) return false;
  if (relativePath.startsWith("word/drawings/")) return false;
  if (relativePath.startsWith("word/diagrams/")) return false;
  if (relativePath.startsWith("word/embeddings/")) return false;

  const excludeExact = new Set([
    "word/theme/theme1.xml", "word/fontTable.xml", "word/settings.xml",
    "word/webSettings.xml", "word/styles.xml", "word/numbering.xml",
  ]);
  if (excludeExact.has(relativePath)) return false;

  return true;
}
