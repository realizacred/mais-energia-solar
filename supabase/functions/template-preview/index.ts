import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";
import { injectChartsIntoDocx } from "../_shared/chartInjector.ts";


const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ═══════════════════════════════════════════════════════════════
// FORENSIC DEBUG TYPES
// ═══════════════════════════════════════════════════════════════

interface MergeEvent {
  file: string;
  paragraphIndex: number;
  location: "regular" | "textbox";
  placeholdersMerged: string[];
  runsBeforeCount: number;
  runsAfterCount: number;
  textBefore: string;
  textAfter: string;
  rPrUsed: string;
}

interface StructureReport {
  wpAnchor: number;
  wpInline: number;
  wDrawing: number;
  wPict: number;
  wTxbx: number;
  tables: number;
  tabs: number;
  repeatedSpaces: number;
  fonts: string[];
  styles: string[];
}

interface ForensicDebugReport {
  timestamp: string;
  templateId: string;
  templateName: string;
  propostaId: string | null;
  tenantId: string;
  // Sizes
  originalDocxSize: number;
  processedDocxSize: number;
  pdfSize: number | null;
  originalDocxHash: string;
  processedDocxHash: string;
  // Structure
  templateStructure: StructureReport;
  postNormalizationStructure: StructureReport;
  structurePreserved: boolean;
  // Merges
  mergeEvents: MergeEvent[];
  totalMerges: number;
  // Placeholders
  totalVarsProvided: number;
  totalPlaceholdersInTemplate: number;
  placeholdersResolved: string[];
  placeholdersMissing: string[];
  placeholdersFragmentedBeforeNorm: string[];
  placeholdersFragmentedAfterNorm: string[];
  // Variable map (full dump for diagnosis)
  variableMap: Record<string, string>;
  // Gotenberg
  gotenbergUrl: string | null;
  gotenbergParams: Record<string, string>;
  gotenbergResponseStatus: number | null;
  gotenbergResponseTime: number | null;
  // Fonts
  fontsInTemplate: string[];
  fontsInAffectedBlocks: string[];
  // XML Samples (truncated for size)
  xmlSamplesBeforeNorm: Record<string, string>;
  xmlSamplesAfterNorm: Record<string, string>;
}

async function hashBytes(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ═══════════════════════════════════════════════════════════════
// DOCX PROCESSING
// ═══════════════════════════════════════════════════════════════

/**
 * Robust DOCX template processor.
 * Step 1: Normalize split placeholders by merging <w:r> runs within each <w:p>.
 * Step 2: Simple [key] → value substitution on the normalized XML.
 * Step 3: Final sweep — missing placeholders stay as-is ([key] or {{key}}), empty→— (NEVER blank).
 *
 * "Empty" means: null, undefined, or whitespace-only string in vars map.
 * 0, "0", 0.00, false are NOT empty — they are valid values.
 */
async function processDocxTemplate(
  templateBytes: Uint8Array,
  vars: Record<string, string>,
  debugMode = false,
): Promise<{
  output: Uint8Array;
  missingVars: string[];
  emptyVars: string[];
  mergeEvents: MergeEvent[];
  xmlBefore: Record<string, string>;
  xmlAfter: Record<string, string>;
  structureBefore: StructureReport;
  structureAfter: StructureReport;
  fontsInAffectedBlocks: string[];
}> {
  const zip = await JSZip.loadAsync(templateBytes);
  const missingVars: string[] = [];
  const emptyVars: string[] = [];
  const mergeEvents: MergeEvent[] = [];
  const xmlBefore: Record<string, string> = {};
  const xmlAfter: Record<string, string> = {};
  let structureBefore: StructureReport = emptyStructure();
  let structureAfter: StructureReport = emptyStructure();
  const fontsInAffectedBlocks = new Set<string>();

  // Build a set of keys that exist in vars but are effectively empty
  const emptyKeysSet = new Set<string>();
  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined || (typeof value === "string" && value.trim() === "")) {
      emptyKeysSet.add(key);
    }
  }

  // Process ALL word/*.xml files (headers, footers, document, etc.)
  // IMPORTANT: Only exclude non-content XML files. Headers/footers MUST be processed.
  // "settings" excluded via exact filename match to avoid matching "header1Settings" etc.
  const excludePatterns = /\/(theme\d*|media|_rels|fontTable|webSettings|styles|numbering|glossary|settings)\.(xml|rels)$/i;
  const excludeExact = new Set([
    "word/theme/theme1.xml", "word/fontTable.xml", "word/settings.xml",
    "word/webSettings.xml", "word/styles.xml", "word/numbering.xml",
  ]);
  const xmlFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (
      relativePath.startsWith("word/") &&
      relativePath.endsWith(".xml") &&
      !relativePath.includes("/_rels/") &&
      !relativePath.startsWith("word/media/") &&
      !relativePath.startsWith("word/theme/") &&
      !relativePath.startsWith("word/glossary/") &&
      // Exclude charts and drawings — they never contain placeholders
      // and processing them risks corrupting chart/drawing XML structure
      !relativePath.startsWith("word/charts/") &&
      !relativePath.startsWith("word/drawings/") &&
      !relativePath.startsWith("word/diagrams/") &&
      !relativePath.startsWith("word/embeddings/") &&
      !excludeExact.has(relativePath)
    ) {
      xmlFiles.push(relativePath);
    }
  });
  // Log which files are processed (headers/footers MUST appear here)
  console.log("[template-preview] XML files to process:", xmlFiles);

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;

    let content = await file.async("string");
    let modified = false;

    // ── DEBUG: Capture structure before normalization ──
    if (debugMode && fileName === "word/document.xml") {
      structureBefore = analyzeStructure(content);
      xmlBefore[fileName] = content.substring(0, 50000);
    }

    // ── STEP 1a: Normalize runs inside text boxes FIRST ──
    content = normalizeTextBoxRuns(content, debugMode ? mergeEvents : null, fileName);

    // ── STEP 1b: Normalize split runs in regular paragraphs ──
    content = normalizeParagraphRuns(content, debugMode ? mergeEvents : null, fileName, debugMode ? fontsInAffectedBlocks : null);

    // ── STEP 1c: AGGRESSIVE CLEANUP — catch any remaining fragmented placeholders ──
    // Word sometimes splits variables across runs in ways that targeted merge misses
    // (e.g., proofing runs, revision marks, empty runs between characters).
    // This pass does a full-paragraph text consolidation for paragraphs that STILL
    // contain partial bracket patterns after targeted normalization.
    content = cleanupRemainingFragments(content);

    // ── DEBUG: Capture structure after normalization ──
    if (debugMode && fileName === "word/document.xml") {
      structureAfter = analyzeStructure(content);
      xmlAfter[fileName] = content.substring(0, 50000);
    }

    // ── STEP 2: Direct substitution for keys with valid (non-empty) values ──
    for (const [key, value] of Object.entries(vars)) {
      // Skip empty-value keys; they'll be handled in Step 3
      if (emptyKeysSet.has(key)) continue;

      const safeValue = escapeXml(String(value));
      const legacyPattern = `[${key}]`;
      if (content.includes(legacyPattern)) {
        content = content.replaceAll(legacyPattern, safeValue);
        modified = true;
      }
      const canonicalPattern = `{{${key}}}`;
      if (content.includes(canonicalPattern)) {
        content = content.replaceAll(canonicalPattern, safeValue);
        modified = true;
      }
    }

    // ── STEP 2b: Replace empty-value placeholders with em-dash "—" ──
    for (const key of emptyKeysSet) {
      const legacyPattern = `[${key}]`;
      if (content.includes(legacyPattern)) {
        content = content.replaceAll(legacyPattern, escapeXml("—"));
        modified = true;
        if (!emptyVars.includes(key)) emptyVars.push(key);
      }
      const canonicalPattern = `{{${key}}}`;
      if (content.includes(canonicalPattern)) {
        content = content.replaceAll(canonicalPattern, escapeXml("—"));
        modified = true;
        if (!emptyVars.includes(key)) emptyVars.push(key);
      }
    }

    // ── STEP 3: Final sweep — remaining placeholders are MISSING (not in vars) ──
    // KEEP them exactly as-is ([varName] or {{varName}}) to preserve layout,
    // enable easy identification, and avoid introducing different characters
    // that change text width. Only collect them for logging/auditing.
    const localMissing: string[] = [];

    const remainingBracket = /\[([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\]/g;
    let remaining;
    while ((remaining = remainingBracket.exec(content)) !== null) {
      const varName = remaining[1];
      if (!localMissing.includes(varName)) localMissing.push(varName);
    }

    const remainingMustache = /\{\{([a-zA-Z_][a-zA-Z0-9_.-]{0,120})\}\}/g;
    while ((remaining = remainingMustache.exec(content)) !== null) {
      const varName = remaining[1];
      if (!localMissing.includes(varName)) localMissing.push(varName);
    }

    // Do NOT replace — just register for audit
    for (const varName of localMissing) {
      if (!missingVars.includes(varName)) {
        missingVars.push(varName);
      }
    }

    if (modified) {
      const xmlValid = isValidXmlDocument(content);
      if (!xmlValid) {
        console.warn(`[template-preview] XML validation warning in ${fileName}`);
      }
      zip.file(fileName, content);
    }

    // ── DEBUG: Capture final XML after substitution ──
    if (debugMode && fileName === "word/document.xml") {
      xmlAfter[`${fileName}_final`] = content.substring(0, 50000);
    }
  }

  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return {
    output,
    missingVars,
    emptyVars,
    mergeEvents,
    xmlBefore,
    xmlAfter,
    structureBefore,
    structureAfter,
    fontsInAffectedBlocks: Array.from(fontsInAffectedBlocks),
  };
}

// ═══════════════════════════════════════════════════════════════
// STRUCTURE ANALYSIS
// ═══════════════════════════════════════════════════════════════

function emptyStructure(): StructureReport {
  return { wpAnchor: 0, wpInline: 0, wDrawing: 0, wPict: 0, wTxbx: 0, tables: 0, tabs: 0, repeatedSpaces: 0, fonts: [], styles: [] };
}

function analyzeStructure(xml: string): StructureReport {
  const fonts = new Set<string>();
  const fontPattern = /<w:rFonts\s[^>]*w:ascii="([^"]+)"/g;
  let fm;
  while ((fm = fontPattern.exec(xml)) !== null) fonts.add(fm[1]);

  const styles = new Set<string>();
  const stylePattern = /<w:pStyle\s+w:val="([^"]+)"/g;
  let sm;
  while ((sm = stylePattern.exec(xml)) !== null) styles.add(sm[1]);

  // Count repeated spaces (3+ in a row inside <w:t> tags)
  const textPattern = /<w:t[^>]*>([^<]+)<\/w:t>/g;
  let repeatedSpaces = 0;
  let tm;
  while ((tm = textPattern.exec(xml)) !== null) {
    if (/\s{3,}/.test(tm[1])) repeatedSpaces++;
  }

  return {
    wpAnchor: (xml.match(/<wp:anchor/g) || []).length,
    wpInline: (xml.match(/<wp:inline/g) || []).length,
    wDrawing: (xml.match(/<w:drawing/g) || []).length,
    wPict: (xml.match(/<w:pict/g) || []).length,
    wTxbx: (xml.match(/<w:txbx/g) || []).length,
    tables: (xml.match(/<w:tbl[\s>]/g) || []).length,
    tabs: (xml.match(/<w:tab\/>/g) || []).length,
    repeatedSpaces,
    fonts: Array.from(fonts),
    styles: Array.from(styles),
  };
}

function extractFontsFromRuns(runsXml: string): string[] {
  const fonts = new Set<string>();
  const fontPattern = /<w:rFonts\s[^>]*?w:ascii="([^"]+)"/g;
  let m;
  while ((m = fontPattern.exec(runsXml)) !== null) fonts.add(m[1]);
  // Also check w:cs and w:hAnsi
  const csPattern = /<w:rFonts\s[^>]*?w:cs="([^"]+)"/g;
  while ((m = csPattern.exec(runsXml)) !== null) fonts.add(m[1]);
  return Array.from(fonts);
}

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

function normalizeTextBoxRuns(
  xml: string,
  mergeEvents: MergeEvent[] | null,
  fileName: string,
): string {
  return xml.replace(/<w:txbxContent[^>]*>([^]*?)<\/w:txbxContent>/g, (_match, innerContent) => {
    const processed = normalizeParagraphRunsInner(innerContent, mergeEvents, fileName);
    return `<w:txbxContent>${processed}</w:txbxContent>`;
  });
}

function normalizeParagraphRunsInner(
  xml: string,
  mergeEvents: MergeEvent[] | null,
  fileName: string,
): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;
  let paraIndex = 0;

  return xml.replace(paraPattern, (paraXml) => {
    paraIndex++;
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
      // Extract ALL <w:t> text nodes (a run can have multiple)
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
    const placeholdersMerged: string[] = [];

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
        placeholdersMerged.push(phMatch[0]);
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
        placeholdersMerged.push(phMatch[0]);
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

    // Record merge event for debug
    if (mergeEvents) {
      mergeEvents.push({
        file: fileName,
        paragraphIndex: paraIndex,
        location: "textbox",
        placeholdersMerged,
        runsBeforeCount: runs.length,
        runsAfterCount: runs.length - merged.reduce((acc, s) => acc + (s[1] - s[0]), 0),
        textBefore: fullText.substring(0, 200),
        textAfter: fullText.substring(0, 200), // same text, just restructured runs
        rPrUsed: runs[merged[0][0]]?.rPr || "",
      });
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
        // Preserve inter-run XML inside merged spans (bookmarks, tabs, breaks, proof marks)
        // to avoid layout shifts while still collapsing split placeholders.
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

function normalizeParagraphRuns(
  xml: string,
  mergeEvents: MergeEvent[] | null,
  fileName: string,
  fontsCollector: Set<string> | null,
): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;
  let paraIndex = 0;

  return xml.replace(paraPattern, (paraXml) => {
    paraIndex++;
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
    const placeholdersMerged: string[] = [];

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
        placeholdersMerged.push(phMatch[0]);
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
        placeholdersMerged.push(phMatch[0]);
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

    // Record merge event for debug + collect fonts from affected blocks
    if (mergeEvents) {
      mergeEvents.push({
        file: fileName,
        paragraphIndex: paraIndex,
        location: "regular",
        placeholdersMerged,
        runsBeforeCount: textRuns.length,
        runsAfterCount: textRuns.length - merged.reduce((acc, s) => acc + (s[1] - s[0]), 0),
        textBefore: fullText.substring(0, 200),
        textAfter: fullText.substring(0, 200),
        rPrUsed: textRuns[merged[0][0]]?.rPr || "",
      });
    }

    if (fontsCollector) {
      for (const span of merged) {
        for (let i = span[0]; i <= span[1]; i++) {
          const runFonts = extractFontsFromRuns(textRuns[i].full);
          for (const f of runFonts) fontsCollector.add(f);
        }
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
        // Preserve inter-run XML inside merged spans (bookmarks, tabs, breaks, proof marks)
        // to prevent layout loss while merging split placeholders.
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
// After targeted merge, some paragraphs may still have placeholders
// split across runs (e.g., due to proofing marks, revision runs, or
// empty intermediate runs). This function consolidates ALL text runs
// in such paragraphs into a single run, preserving the first run's
// formatting. Only applies to paragraphs that still contain partial
// bracket patterns (orphan "[" without matching "]" in the same run).

function cleanupRemainingFragments(xml: string): string {
  const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;

  return xml.replace(paraPattern, (paraXml) => {
    // Skip if no placeholders, or if paragraph has fields/graphics
    if (!paraXml.includes("[") && !paraXml.includes("{{")) return paraXml;
    if (paraXml.includes("<w:fldChar") || paraXml.includes("<w:instrText")) return paraXml;
    if (hasSensitiveGraphicMarkup(paraXml)) return paraXml;
    // Keep tabs and explicit line breaks untouched to avoid positional drift.
    if (paraXml.includes("<w:tab") || paraXml.includes("<w:br")) return paraXml;

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
    let m;
    while ((m = runPattern.exec(paraXml)) !== null) {
      const full = m[0];
      const isGraphic = hasSensitiveGraphicMarkup(full);

      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
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
    let pm;

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

    console.log(`[template-preview] CLEANUP: normalizing ${stillFragmented.length} fragmented placeholders: ${stillFragmented.join(", ")}`);

    // SAFE cleanup: keep all runs/inter-run XML intact, only rewrite <w:t> contents.
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

function escapeXml(str: string): string {
  return str
    // Strip hidden line breaks, carriage returns, and tabs that corrupt XML layout
    .replace(/\r\n/g, " ")
    .replace(/\r/g, " ")
    .replace(/\n/g, " ")
    .replace(/\t/g, " ")
    // Collapse multiple spaces into one (prevents layout push)
    .replace(/ {2,}/g, " ")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function isValidXmlDocument(xml: string): boolean {
  try {
    const parsed = new DOMParser().parseFromString(xml, "application/xml");
    return !parsed.querySelector("parsererror");
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// FILE NAMING HELPERS
// ═══════════════════════════════════════════════════════════════

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

// ─── Main handler ─────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH + TENANT ──────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !user) return jsonError("Token inválido", 401);
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();
    if (!profile?.tenant_id || !profile.ativo) return jsonError("Usuário inativo ou sem tenant", 403);
    const tenantId = profile.tenant_id;

    // ── 2. PARSE BODY ─────────────────────────────────────
    const body = await req.json();
    const { template_id, proposta_id, lead_id: bodyLeadId, diagnostic, debug_docx_pdf } = body;

    if (!template_id) {
      return jsonError("template_id é obrigatório", 400);
    }

    // ── DIAGNOSTIC MODE (existing) ────────────────────────
    if (diagnostic === true) {
      return await handleDiagnostic(adminClient, template_id, tenantId);
    }

    // ── DEBUG MODE FLAG ───────────────────────────────────
    const debugMode = debug_docx_pdf === true;
    if (debugMode) {
      console.log("[template-preview] 🔬 FORENSIC DEBUG MODE ENABLED");
    }

    if (!proposta_id && !bodyLeadId) {
      return jsonError("proposta_id ou lead_id é obrigatório", 400);
    }

    // ── 3. BUSCAR TEMPLATE ────────────────────────────────
    const { data: template, error: tmplErr } = await adminClient
      .from("proposta_templates")
      .select("id, nome, tipo, file_url, template_html")
      .eq("id", template_id)
      .eq("tenant_id", tenantId)
      .single();

    if (tmplErr || !template) return jsonError("Template não encontrado neste tenant", 404);
    if (template.tipo !== "docx" || !template.file_url) {
      return jsonError("Template não é DOCX ou não tem arquivo", 400);
    }

    // ── 4. RESOLVER PROPOSTA → LEAD/CLIENTE/PROJETO ───────
    let leadId = bodyLeadId;
    let propostaData: any = null;
    let versaoData: any = null;

    if (proposta_id) {
      const { data: proposta, error: propErr } = await adminClient
        .from("propostas_nativas")
        .select("id, titulo, codigo, status, lead_id, cliente_id, consultor_id, projeto_id")
        .eq("id", proposta_id)
        .eq("tenant_id", tenantId)
        .single();

      if (propErr || !proposta) return jsonError("Proposta não encontrada neste tenant", 404);
      propostaData = proposta;
      leadId = proposta.lead_id;

      const { data: versao } = await adminClient
        .from("proposta_versoes")
        .select("snapshot, valor_total, potencia_kwp, economia_mensal, payback_meses, validade_dias, versao_numero")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      versaoData = versao;
    }

    // ── 5. BUSCAR DADOS RELACIONADOS ──────────────────────
    const [leadRes, clienteRes, projetoRes, consultorRes, tenantRes, brandSettingsRes] = await Promise.all([
      leadId
        ? adminClient
            .from("leads")
            .select("id, nome, telefone, cidade, estado, media_consumo, valor_estimado, cep, rua, numero, bairro, area, tipo_telhado, rede_atendimento, consumo_previsto, observacoes")
            .eq("id", leadId)
            .eq("tenant_id", tenantId)
            .single()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.cliente_id
        ? adminClient
            .from("clientes")
            .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto, empresa, complemento, data_nascimento, numero_placas, modelo_inversor, data_instalacao, observacoes")
            .eq("id", propostaData.cliente_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.projeto_id
        ? adminClient
            .from("projetos")
            .select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento, created_at, observacoes, titulo")
            .eq("id", propostaData.projeto_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.consultor_id
        ? adminClient
            .from("consultores")
            .select("nome, telefone, email, codigo")
            .eq("id", propostaData.consultor_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      // OPT-4: tenant name fetched in parallel instead of sequentially
      adminClient
        .from("tenants")
        .select("nome")
        .eq("id", tenantId)
        .maybeSingle(),
      // Brand settings for commercial variables (empresa_*, representante_*)
      adminClient
        .from("brand_settings")
        .select("logo_url, representante_legal, representante_cpf, representante_cargo")
        .eq("tenant_id", tenantId)
        .maybeSingle(),
    ]);

    const lead = leadRes.data;
    const cliente = clienteRes.data;
    const projeto = projetoRes.data as any;
    const consultor = consultorRes.data as any;
    const tenantInfo = tenantRes.data;

    // ── 6. MONTAR MAPA DE VARIÁVEIS via Domain Resolvers ──
    const snapshot = versaoData?.snapshot as Record<string, any> | null;

    const vars = flattenSnapshot(snapshot as Record<string, unknown>, {
      lead,
      cliente,
      projeto,
      consultor,
      tenantNome: tenantInfo?.nome,
      versaoData: versaoData as Record<string, unknown>,
      propostaData: propostaData as Record<string, unknown>,
      brandSettings: (brandSettingsRes.data ?? {}) as Record<string, unknown>,
      projetoData: (projeto ?? {}) as Record<string, unknown>,
      clienteData: (cliente ?? {}) as Record<string, unknown>,
    });

    console.log(`[template-preview] Variables resolved via domain resolvers: ${Object.keys(vars).length} keys`);

    // ── 6b. POST-PROCESSING: fix cover-page variable issues ──

    // FIX 1: potencia_sistema — strip unit suffix to avoid "6,00 kWp kWp"
    if (vars["potencia_sistema"]) {
      vars["potencia_sistema"] = vars["potencia_sistema"]
        .replace(/\s*kWp\s*$/i, "")
        .trim();
    }

    // FIX 2: subgrupo / grupo_tarifario — ensure top-level keys exist
    const ucsArr = Array.isArray((snapshot as any)?.ucs) ? (snapshot as any).ucs : [];
    const uc1 = ucsArr[0] ?? {};
    if (!vars["subgrupo"]) {
      const sg = (snapshot as any)?.subgrupo ?? (snapshot as any)?.grupo_tarifario
        ?? uc1.subgrupo ?? uc1.grupo_tarifario ?? uc1.grupo
        ?? (lead as any)?.subgrupo_tarifario;
      if (sg) vars["subgrupo"] = String(sg);
    }
    if (!vars["grupo_tarifario"]) {
      vars["grupo_tarifario"] = vars["subgrupo"] ?? "";
    }

    // FIX 3: estrutura / tipo_telhado — ensure top-level key exists
    if (!vars["estrutura"]) {
      const est = uc1.tipo_telhado ?? (snapshot as any)?.tecnico?.tipo_telhado
        ?? (snapshot as any)?.tipo_telhado ?? vars["tipo_telhado"]
        ?? vars["estrutura_tipo"];
      if (est) vars["estrutura"] = String(est);
    }

    // FIX 4: vc_observacao — never show "N/A" literally
    if (!vars["vc_observacao"] || vars["vc_observacao"] === "N/A" || vars["vc_observacao"] === "n/a") {
      vars["vc_observacao"] = "";
    }

    // ── 7. DOWNLOAD TEMPLATE DOCX ─────────────────────────
    let templateBuffer: Uint8Array;
    try {
      let storagePath: string;

      if (template.file_url.startsWith("http")) {
        // Extract storage path from the public URL
        const fileUrlStr = template.file_url as string;
        const storageMarker = "/proposta-templates/";
        const markerIdx = fileUrlStr.indexOf(storageMarker);
        if (markerIdx === -1) {
          return jsonError("Caminho do template inválido na URL", 400);
        }
        const rawPath = fileUrlStr.slice(markerIdx + storageMarker.length);
        storagePath = decodeURIComponent(rawPath).replace(/\+/g, " ");
      } else {
        storagePath = template.file_url;
      }

      console.log("[template-preview] downloading template from storage path:", storagePath);

      // Use createSignedUrl + fetch to avoid SDK encoding issues with spaces in filenames
      const { data: signedData, error: signedError } = await adminClient.storage
        .from("proposta-templates")
        .createSignedUrl(storagePath, 300);

      if (signedError || !signedData?.signedUrl) {
        console.error("[template-preview] Signed URL error:", signedError?.message, "path:", storagePath);

        // Fallback: try direct SDK download
        console.log("[template-preview] Fallback: trying direct SDK download");
        const { data: fallbackBlob, error: fallbackErr } = await adminClient.storage
          .from("proposta-templates")
          .download(storagePath);

        if (fallbackErr || !fallbackBlob) {
          console.error("[template-preview] Fallback download also failed:", fallbackErr?.message);
          return jsonError(
            `Erro ao baixar template: ${signedError?.message || fallbackErr?.message || "arquivo não encontrado"} — path: ${storagePath}`,
            500,
          );
        }

        templateBuffer = new Uint8Array(await fallbackBlob.arrayBuffer());
      } else {
        // Fetch via signed URL (avoids path encoding issues)
        const fetchResp = await fetch(signedData.signedUrl);
        if (!fetchResp.ok) {
          console.error("[template-preview] Signed URL fetch error: HTTP", fetchResp.status, "path:", storagePath);
          return jsonError(`Erro ao baixar template: HTTP ${fetchResp.status} — path: ${storagePath}`, 500);
        }
        templateBuffer = new Uint8Array(await fetchResp.arrayBuffer());
      }

      console.log(`[template-preview] DOCX downloaded: ${templateBuffer.byteLength} bytes`);
    } catch (fetchErr: any) {
      console.error("[template-preview] Download error:", fetchErr?.message, fetchErr?.stack);
      return jsonError(`Erro ao baixar template: ${fetchErr?.message}`, 500);
    }

    // ── 8. PROCESSAR TEMPLATE ─────────────────────────────
    console.log(`[template-preview] Processing DOCX with JSZip-based replacer${debugMode ? " [DEBUG MODE]" : ""}`);
    const originalSize = templateBuffer.byteLength;

    let report: Uint8Array;
    let processedMissingVars: string[] = [];
    let processedEmptyVars: string[] = [];
    let debugResult: Awaited<ReturnType<typeof processDocxTemplate>> | null = null;

    try {
      const result = await processDocxTemplate(templateBuffer, vars, debugMode);
      report = result.output;
      processedMissingVars = result.missingVars;
      processedEmptyVars = result.emptyVars;
      if (debugMode) debugResult = result;

      const outputSize = report.length;
      const ratio = originalSize > 0 ? ((outputSize / originalSize) * 100).toFixed(1) : "N/A";
      console.log(`[template-preview] Size comparison: original=${originalSize}B → output=${outputSize}B (${ratio}%)`);
      if (originalSize > 0 && outputSize < originalSize * 0.95) {
        console.warn(`[template-preview] ⚠️ Output is <95% of original — possible content loss!`);
      }

      const totalVars = Object.keys(vars).length;
      const missingCount = result.missingVars.length;
      const emptyCount = result.emptyVars.length;
      const substituted = totalVars - missingCount - emptyCount;
      console.log(`[template-preview] Substitution stats: ${substituted} replaced, ${missingCount} missing, ${emptyCount} empty out of ${totalVars} total vars`);
      if (result.missingVars.length > 0) {
        console.warn(`[template-preview] missing_placeholders (kept as-is in output):`, result.missingVars);
      }
      if (result.emptyVars.length > 0) {
        console.warn(`[template-preview] Empty variables (→ —):`, result.emptyVars.slice(0, 30));
      }
    } catch (processErr: any) {
      console.error("[template-preview] Processing error:", processErr?.message, processErr?.stack);
      return jsonError(`Erro ao processar template DOCX: ${processErr?.message || "unknown"}`, 500);
    }

    // ── 8b. CHART INJECTION ───────────────────────────────
    // After variable substitution, inject rendered chart images
    // into the DOCX before uploading and converting to PDF.
    let chartInjectionResult: Awaited<ReturnType<typeof injectChartsIntoDocx>> | null = null;
    try {
      chartInjectionResult = await injectChartsIntoDocx({
        docxBytes: report,
        snapshot: snapshot as Record<string, unknown> | null,
        tenantId,
        adminClient,
        authHeader: authHeader!,
        supabaseUrl,
        proposalId: proposta_id || undefined,
      });

      if (chartInjectionResult.chartsRendered.length > 0) {
        report = chartInjectionResult.output;
        console.log(`[template-preview] Charts injected: ${chartInjectionResult.chartsRendered.join(", ")}`);
      }
      if (chartInjectionResult.chartsFailed.length > 0) {
        console.warn(`[template-preview] Charts failed: ${chartInjectionResult.chartsFailed.join(", ")}`);
      }
      if (chartInjectionResult.chartsSkipped.length > 0) {
        console.log(`[template-preview] Charts skipped: ${chartInjectionResult.chartsSkipped.join(", ")}`);
      }
    } catch (chartErr: any) {
      console.error(`[template-preview] Chart injection error (non-blocking): ${chartErr?.message}`);
      // Non-blocking — proposal continues without charts
    }

    // ── 8c. BACKEND AUDIT: Build audit report + block on critical errors ──
    const CRITICAL_VARIABLES = new Set([
      "nome", "cliente_nome", "potencia_kwp", "valor_total",
      "cidade", "estado", "distribuidora",
      "modulo_fabricante", "modulo_modelo", "numero_modulos",
    ]);

    const auditItems: Array<{
      variable: string;
      status: string;
      severity: string;
      value: string | null;
      origin: string;
      message: string;
      suggestion?: string;
    }> = [];

    for (const v of processedMissingVars) {
      const clean = v.replace(/[[\]{}]/g, "");
      const isCritical = CRITICAL_VARIABLES.has(clean);
      auditItems.push({
        variable: clean,
        status: "error_unresolved",
        severity: isCritical ? "error" : "warning",
        value: null,
        origin: "template",
        message: isCritical
          ? `Variável crítica "${clean}" não foi resolvida`
          : `Placeholder "${clean}" não encontrado nos resolvers`,
        suggestion: isCritical
          ? "Verificar dados de entrada da proposta"
          : "Verificar se a variável existe no catálogo ou é custom",
      });
    }

    for (const v of processedEmptyVars) {
      const clean = v.replace(/[[\]{}]/g, "");
      const isCritical = CRITICAL_VARIABLES.has(clean);
      auditItems.push({
        variable: clean,
        status: "warning_null",
        severity: isCritical ? "error" : "warning",
        value: "",
        origin: "resolver",
        message: isCritical
          ? `Variável crítica "${clean}" está vazia`
          : `Variável "${clean}" resolveu como vazia`,
        suggestion: isCritical
          ? "Verificar se os dados foram preenchidos no formulário"
          : undefined,
      });
    }

    const auditErrorCount = auditItems.filter(i => i.severity === "error").length;
    const auditWarningCount = auditItems.filter(i => i.severity === "warning").length;
    const resolvedVarsCountAudit = Object.keys(vars).length - processedMissingVars.length - processedEmptyVars.length;
    const totalPlaceholders = resolvedVarsCountAudit + processedMissingVars.length;
    const healthScore = totalPlaceholders > 0
      ? Math.max(0, Math.min(100, Math.round(((totalPlaceholders - auditErrorCount * 2 - auditWarningCount) / totalPlaceholders) * 100)))
      : 100;

    const auditHealth = (healthScore < 80 || auditErrorCount > 0)
      ? "critica"
      : (healthScore < 95 || auditWarningCount > 0)
        ? "atencao"
        : "saudavel";

    const generationAuditJson = {
      templateId: template_id,
      templateName: template.nome,
      propostaId: proposta_id || "",
      generatedAt: new Date().toISOString(),
      totalPlaceholders,
      resolved: resolvedVarsCountAudit,
      resolvedViaSnapshot: 0,
      unresolvedPlaceholders: processedMissingVars.map((v: string) => v.replace(/[[\]{}]/g, "")),
      nullValues: processedEmptyVars.map((v: string) => v.replace(/[[\]{}]/g, "")),
      emptyValues: processedEmptyVars.map((v: string) => v.replace(/[[\]{}]/g, "")),
      items: auditItems,
      healthScore,
      health: auditHealth,
      errorCount: auditErrorCount,
      warningCount: auditWarningCount,
      okCount: Math.max(0, resolvedVarsCountAudit - processedEmptyVars.length),
    };

    // Check if generation should be blocked (critical errors)
    const hasCriticalErrors = auditItems.some(
      i => i.severity === "error" && (i.status === "error_unresolved" || i.status === "error_expression")
    );

    // Persist audit to proposta_versoes (backend-side, not fire-and-forget)
    if (proposta_id) {
      const { data: auditVersao } = await adminClient
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (auditVersao) {
        const { error: auditPersistErr } = await adminClient
          .from("proposta_versoes")
          .update({ generation_audit_json: generationAuditJson } as any)
          .eq("id", auditVersao.id);
        if (auditPersistErr) {
          console.error("[template-preview] Failed to persist audit:", auditPersistErr.message);
        } else {
          console.log(`[template-preview] Audit persisted to proposta_versoes ${auditVersao.id}`);
        }
      }
    }

    // ── BLOCK if critical errors detected ──
    if (hasCriticalErrors) {
      const criticalVars = auditItems
        .filter(i => i.severity === "error" && (i.status === "error_unresolved" || i.status === "error_expression"))
        .map(i => i.variable);

      console.error(`[template-preview] ❌ GENERATION BLOCKED — ${criticalVars.length} critical variable(s): ${criticalVars.join(", ")}`);

      // Upload DOCX only (for debugging), but do NOT generate PDF or promote status
      await adminClient.storage
        .from("proposta-documentos")
        .upload(
          `${tenantId}/propostas/${proposta_id || "draft"}/${Date.now()}_blocked_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}.docx`,
          report,
          {
            contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            upsert: true,
          }
        );

      return new Response(
        JSON.stringify({
          success: false,
          blocked_by_audit: true,
          critical_variables: criticalVars,
          audit: generationAuditJson,
          error: `Geração bloqueada: ${criticalVars.length} variável(is) crítica(s) não resolvida(s): ${criticalVars.join(", ")}`,
          missing_vars: processedMissingVars,
          empty_vars: processedEmptyVars,
          resolved_vars_count: resolvedVarsCountAudit,
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`[template-preview] Audit passed: health=${auditHealth}, score=${healthScore}, errors=${auditErrorCount}, warnings=${auditWarningCount}`);

    // ── 9. BUILD FILE NAME + PERSIST TO STORAGE ──────────
    const clienteNome = cliente?.nome || lead?.nome || "preview";
    const proposalNumber = propostaData?.codigo || null;
    const proposalDate = versaoData?.snapshot?.data_proposta || new Date().toISOString().slice(0, 10);
    const outputFileName = buildProposalFileName({
      proposalNumber,
      proposalDate,
      customerName: clienteNome,
    });
    const outputDocxFileName = outputFileName.replace(/\.pdf$/, ".docx");

    const timestamp = Date.now();
    const docxStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_${outputDocxFileName}`;
    const pdfStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_${outputFileName}`;
    const debugStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_debug_forensic.json`;

    // 9a. Upload DOCX to storage (in parallel with PDF conversion — OPT-5)
    console.log(`[template-preview] Uploading DOCX to storage: ${docxStoragePath}`);
    const docxUploadPromise = adminClient.storage
      .from("proposta-documentos")
      .upload(docxStoragePath, report, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    // Don't await — will be awaited after Gotenberg finishes

    // 9b. Convert DOCX to PDF via Gotenberg
    let pdfBytes: Uint8Array | null = null;
    let pdfConversionError: string | null = null;
    let gotenbergUrl: string | null = null;
    let gotenbergResponseStatus: number | null = null;
    let gotenbergResponseTime: number | null = null;
    // Gotenberg params — ONLY LibreOffice-relevant fields.
    // skipNetworkIdleEvent is Chromium-only and must NOT be sent to LibreOffice route.
    const gotenbergParams: Record<string, string> = {
      landscape: "false",
      nativePageRanges: "1-",
      losslessImageCompression: "true",
      reduceImageResolution: "false",
      quality: "100",
      exportFormFields: "false",
      skipEmptyPages: "true",
    };

    try {
      gotenbergUrl = await resolveGotenbergUrl(adminClient, tenantId);
      console.log(`[template-preview] Converting to PDF via Gotenberg: ${gotenbergUrl}`);

      // Hash the DOCX bytes to prove binary integrity
      const docxHashForGotenberg = await hashBytes(report);
      console.log(`[template-preview] DOCX hash sent to Gotenberg: ${docxHashForGotenberg} (${report.length} bytes)`);

      const formData = new FormData();
      const blob = new Blob([report], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      formData.append("files", blob, "proposta.docx");
      // Append only LibreOffice-relevant params (no Chromium params like skipNetworkIdleEvent)
      for (const [key, val] of Object.entries(gotenbergParams)) {
        formData.append(key, val);
      }

      const conversionUrl = `${gotenbergUrl}/forms/libreoffice/convert`;
      console.log(`[template-preview] Conversion URL: ${conversionUrl}`);

      const gotenbergStart = Date.now();
      const pdfResp = await fetch(conversionUrl, {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(90000),
      });
      gotenbergResponseTime = Date.now() - gotenbergStart;
      gotenbergResponseStatus = pdfResp.status;

      if (pdfResp.ok) {
        const pdfBuffer = await pdfResp.arrayBuffer();
        pdfBytes = new Uint8Array(pdfBuffer);
        console.log(`[template-preview] PDF generated: ${pdfBytes.length} bytes (${gotenbergResponseTime}ms)`);

        const { error: pdfUploadErr } = await adminClient.storage
          .from("proposta-documentos")
          .upload(pdfStoragePath, pdfBytes, {
            contentType: "application/pdf",
            upsert: true,
          });
        if (pdfUploadErr) {
          console.error("[template-preview] PDF upload error:", pdfUploadErr.message);
          pdfConversionError = `PDF upload failed: ${pdfUploadErr.message}`;
        }
      } else {
        const errText = await pdfResp.text();
        pdfConversionError = `Gotenberg error ${pdfResp.status}: ${errText}`;
        console.error("[template-preview] PDF conversion failed:", pdfConversionError);
      }
    } catch (pdfErr: any) {
      pdfConversionError = pdfErr?.message || "Unknown PDF conversion error";
      console.error("[template-preview] PDF conversion error:", pdfConversionError);
    }

    // OPT-5: Await DOCX upload that ran in parallel with Gotenberg
    const { error: docxUploadErr } = await docxUploadPromise;
    if (docxUploadErr) {
      console.error("[template-preview] DOCX upload error:", docxUploadErr.message);
    }

    // ═══════════════════════════════════════════════════════
    // 9c. FORENSIC DEBUG: Persist debug report to storage
    // ═══════════════════════════════════════════════════════
    if (debugMode && debugResult) {
      // Count placeholders in template
      const allPlaceholders: string[] = [];
      for (const [, xmlContent] of Object.entries(debugResult.xmlBefore)) {
        const phPat = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
        let pm;
        while ((pm = phPat.exec(xmlContent)) !== null) {
          if (!allPlaceholders.includes(pm[0])) allPlaceholders.push(pm[0]);
        }
        const mPat = /\{\{([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\}\}/g;
        while ((pm = mPat.exec(xmlContent)) !== null) {
          if (!allPlaceholders.includes(pm[0])) allPlaceholders.push(pm[0]);
        }
      }

      // Find fragmented placeholders before/after
      const fragmentedBefore: string[] = [];
      const fragmentedAfter: string[] = [];
      for (const evt of debugResult.mergeEvents) {
        for (const ph of evt.placeholdersMerged) {
          if (!fragmentedBefore.includes(ph)) fragmentedBefore.push(ph);
        }
      }

      const resolvedKeys = Object.keys(vars).filter(k => {
        const bracket = `[${k}]`;
        const mustache = `{{${k}}}`;
        return allPlaceholders.includes(bracket) || allPlaceholders.includes(mustache);
      });

      const originalHash = await hashBytes(templateBuffer);
      const processedHash = await hashBytes(report);

      const forensicReport: ForensicDebugReport = {
        timestamp: new Date().toISOString(),
        templateId: template_id,
        templateName: template.nome,
        propostaId: proposta_id || null,
        tenantId,
        originalDocxSize: originalSize,
        processedDocxSize: report.length,
        pdfSize: pdfBytes?.length || null,
        originalDocxHash: originalHash,
        processedDocxHash: processedHash,
        templateStructure: debugResult.structureBefore,
        postNormalizationStructure: debugResult.structureAfter,
        structurePreserved:
          debugResult.structureBefore.wpAnchor === debugResult.structureAfter.wpAnchor &&
          debugResult.structureBefore.wDrawing === debugResult.structureAfter.wDrawing &&
          debugResult.structureBefore.wTxbx === debugResult.structureAfter.wTxbx,
        mergeEvents: debugResult.mergeEvents,
        totalMerges: debugResult.mergeEvents.length,
        totalVarsProvided: Object.keys(vars).length,
        totalPlaceholdersInTemplate: allPlaceholders.length,
        placeholdersResolved: resolvedKeys,
        placeholdersMissing: processedMissingVars,
        placeholdersFragmentedBeforeNorm: fragmentedBefore,
        placeholdersFragmentedAfterNorm: fragmentedAfter,
        variableMap: vars,
        gotenbergUrl,
        gotenbergParams,
        gotenbergResponseStatus,
        gotenbergResponseTime,
        fontsInTemplate: debugResult.structureBefore.fonts,
        fontsInAffectedBlocks: debugResult.fontsInAffectedBlocks,
        xmlSamplesBeforeNorm: debugResult.xmlBefore,
        xmlSamplesAfterNorm: debugResult.xmlAfter,
      };

      console.log("[template-preview] 🔬 FORENSIC DEBUG REPORT:", JSON.stringify({
        totalMerges: forensicReport.totalMerges,
        structurePreserved: forensicReport.structurePreserved,
        fontsInTemplate: forensicReport.fontsInTemplate,
        fontsInAffectedBlocks: forensicReport.fontsInAffectedBlocks,
        placeholdersMissing: forensicReport.placeholdersMissing.length,
        placeholdersFragmented: forensicReport.placeholdersFragmentedBeforeNorm.length,
        gotenbergResponseTime: forensicReport.gotenbergResponseTime,
        pdfSize: forensicReport.pdfSize,
      }, null, 2));

      // Upload debug report to storage
      const debugBlob = new TextEncoder().encode(JSON.stringify(forensicReport, null, 2));
      const { error: debugUploadErr } = await adminClient.storage
        .from("proposta-documentos")
        .upload(debugStoragePath, debugBlob, {
          contentType: "application/json",
          upsert: true,
        });
      if (debugUploadErr) {
        console.error("[template-preview] Debug report upload error:", debugUploadErr.message);
      } else {
        console.log(`[template-preview] 🔬 Debug report saved: ${debugStoragePath}`);
      }
    }

    // 9d. Update proposta_versoes with artifact paths
    if (proposta_id) {
      const { data: latestVersao } = await adminClient
        .from("proposta_versoes")
        .select("id")
        .eq("proposta_id", proposta_id)
        .order("versao_numero", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestVersao) {
        const updatePayload: Record<string, unknown> = {
          output_docx_path: docxUploadErr ? null : docxStoragePath,
          output_pdf_path: (pdfBytes && !pdfConversionError) ? pdfStoragePath : null,
          generation_status: (pdfBytes && !pdfConversionError) ? "ready" : (docxUploadErr ? "error" : "docx_only"),
          generation_error: pdfConversionError || (docxUploadErr ? docxUploadErr.message : null),
          template_id_used: template_id,
          generated_at: new Date().toISOString(),
        };

        const { error: updateErr } = await adminClient
          .from("proposta_versoes")
          .update(updatePayload)
          .eq("id", latestVersao.id);

        if (updateErr) {
          console.error("[template-preview] Failed to update proposta_versoes:", updateErr.message);
        } else {
          console.log(`[template-preview] proposta_versoes ${latestVersao.id} updated with artifact paths`);

          // ── PROMOTE STATUS: Only promote to "gerada" after artifact is persisted ──
          const hasArtifact = !!(pdfBytes && !pdfConversionError) || (!docxUploadErr && docxStoragePath);
          if (hasArtifact) {
            await adminClient
              .from("propostas_nativas")
              .update({ status: "gerada" })
              .eq("id", proposta_id)
              .eq("tenant_id", tenantId);
            console.log(`[template-preview] propostas_nativas ${proposta_id} status promoted to "gerada"`);
          }
        }
      }
    }

    // ── 10. RETURN RESPONSE ──────────────────────────────
    const resolvedVarsCount = Object.keys(vars).length - processedMissingVars.length - processedEmptyVars.length;

    console.log("[template-preview] proposal_generation_completed", JSON.stringify({
      proposalId: proposta_id,
      proposalNumber,
      templateName: template.nome,
      outputFileName,
      missingVars: processedMissingVars,
      emptyVars: processedEmptyVars,
      resolvedVarsCount,
      gotenbergElapsedMs: gotenbergResponseTime,
    }));

    const responsePayload: Record<string, unknown> = {
      success: true,
      output_docx_path: docxUploadErr ? null : docxStoragePath,
      output_pdf_path: (pdfBytes && !pdfConversionError) ? pdfStoragePath : null,
      generation_status: (pdfBytes && !pdfConversionError) ? "ready" : (docxUploadErr ? "error" : "docx_only"),
      generation_error: pdfConversionError || (docxUploadErr ? docxUploadErr.message : null),
      missing_vars: processedMissingVars,
      empty_vars: processedEmptyVars,
      resolved_vars_count: resolvedVarsCount,
      file_name: outputFileName,
      file_name_docx: outputDocxFileName,
      template_name: template.nome,
      generated_at: new Date().toISOString(),
      charts: chartInjectionResult ? {
        detected: chartInjectionResult.chartsDetected,
        rendered: chartInjectionResult.chartsRendered,
        failed: chartInjectionResult.chartsFailed,
        skipped: chartInjectionResult.chartsSkipped,
        reasons: chartInjectionResult.reasons || {},
      } : null,
      audit: generationAuditJson,
    };

    // Include debug path in response if debug mode
    if (debugMode) {
      responsePayload.debug_report_path = debugStoragePath;
      responsePayload.debug_summary = {
        total_merges: debugResult?.mergeEvents.length || 0,
        structure_preserved: debugResult
          ? debugResult.structureBefore.wpAnchor === debugResult.structureAfter.wpAnchor
          : null,
        fonts_in_template: debugResult?.structureBefore.fonts || [],
        fonts_in_affected_blocks: debugResult?.fontsInAffectedBlocks || [],
        gotenberg_response_time_ms: gotenbergResponseTime,
        pdf_size_bytes: pdfBytes?.length || null,
      };
    }

    const acceptHeader = req.headers.get("Accept") || "";
    const wantJson = acceptHeader.includes("application/json") || body.response_format === "json";

    if (wantJson) {
      return new Response(JSON.stringify(responsePayload), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[template-preview] Returning ${report.length} bytes as ${outputDocxFileName}`);

    return new Response(report, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputDocxFileName}"`,
        "X-Output-Docx-Path": docxStoragePath,
        "X-Output-Pdf-Path": (pdfBytes && !pdfConversionError) ? pdfStoragePath : "",
        "X-Generation-Status": (pdfBytes && !pdfConversionError) ? "ready" : "docx_only",
        "X-File-Name": outputFileName,
        "X-Debug-Report-Path": debugMode ? debugStoragePath : "",
      },
    });
  } catch (err: any) {
    console.error("[template-preview] Error:", err?.message, err?.stack);
    return jsonError(err?.message ?? "Erro interno", 500);
  }
});

function jsonError(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Diagnostic handler ──────────────────────────────────
async function handleDiagnostic(
  adminClient: ReturnType<typeof createClient>,
  templateId: string,
  tenantId: string,
) {
  const corsJson = { ...corsHeaders, "Content-Type": "application/json" };

  const { data: tmpl, error: tmplErr } = await adminClient
    .from("proposta_templates")
    .select("id, nome, tipo, file_url")
    .eq("id", templateId)
    .eq("tenant_id", tenantId)
    .single();

  if (tmplErr || !tmpl || !tmpl.file_url) {
    return new Response(JSON.stringify({ error: "Template não encontrado ou sem file_url", tmplErr }), { status: 404, headers: corsJson });
  }

  const fileUrl = tmpl.file_url.startsWith("http")
    ? tmpl.file_url
    : (() => {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const bucket = "proposta-templates";
        return `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${tmpl.file_url}`;
      })();

  let templateBytes: Uint8Array;
  if (tmpl.file_url.startsWith("http")) {
    const resp = await fetch(fileUrl);
    if (!resp.ok) return new Response(JSON.stringify({ error: `Download failed: ${resp.status}` }), { status: 500, headers: corsJson });
    templateBytes = new Uint8Array(await resp.arrayBuffer());
  } else {
    const { data: dlData, error: dlErr } = await adminClient.storage
      .from("proposta-templates")
      .download(tmpl.file_url);
    if (dlErr || !dlData) return new Response(JSON.stringify({ error: `Storage download failed: ${dlErr?.message}` }), { status: 500, headers: corsJson });
    templateBytes = new Uint8Array(await dlData.arrayBuffer());
  }

  const zip = await JSZip.loadAsync(templateBytes);
  const docFile = zip.file("word/document.xml");
  if (!docFile) {
    return new Response(JSON.stringify({ error: "word/document.xml not found in ZIP" }), { status: 500, headers: corsJson });
  }
  const docXml = await docFile.async("string");

  const txbxPattern = /<w:txbx[^>]*>[^]*?<\/w:txbx>/g;
  const textBoxes: Array<{
    index: number;
    visibleText: string;
    runsCount: number;
    placeholdersIntact: string[];
    placeholdersFragmented: string[];
    rawSnippet: string;
  }> = [];

  let txbxMatch;
  let txbxIdx = 0;
  while ((txbxMatch = txbxPattern.exec(docXml)) !== null) {
    const txbxXml = txbxMatch[0];
    const runPattern = /<w:r[\s>][^]*?<\/w:r>/g;
    const runs: Array<{ text: string; xml: string }> = [];
    let runMatch;
    while ((runMatch = runPattern.exec(txbxXml)) !== null) {
      const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
      let tMatch;
      const texts: string[] = [];
      while ((tMatch = tPattern.exec(runMatch[0])) !== null) {
        texts.push(tMatch[1]);
      }
      runs.push({ text: texts.join(""), xml: runMatch[0] });
    }

    const fullText = runs.map(r => r.text).join("");

    const intactPlaceholders: string[] = [];
    const phPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
    for (const run of runs) {
      let pm;
      while ((pm = phPattern.exec(run.text)) !== null) {
        intactPlaceholders.push(pm[0]);
      }
    }

    const fragmentedPlaceholders: string[] = [];
    let fpm;
    const fullPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
    while ((fpm = fullPhPattern.exec(fullText)) !== null) {
      if (!intactPlaceholders.includes(fpm[0])) {
        fragmentedPlaceholders.push(fpm[0]);
      }
    }

    textBoxes.push({
      index: txbxIdx++,
      visibleText: fullText,
      runsCount: runs.length,
      placeholdersIntact: intactPlaceholders,
      placeholdersFragmented: fragmentedPlaceholders,
      rawSnippet: txbxXml.length > 2000 ? txbxXml.substring(0, 2000) + "..." : txbxXml,
    });
  }

  const allPlaceholders: string[] = [];
  const docPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
  let dpm;
  while ((dpm = docPhPattern.exec(docXml)) !== null) {
    if (!allPlaceholders.includes(dpm[0])) allPlaceholders.push(dpm[0]);
  }

  const anchorCount = (docXml.match(/<wp:anchor/g) || []).length;
  const inlineCount = (docXml.match(/<wp:inline/g) || []).length;
  const drawingCount = (docXml.match(/<w:drawing/g) || []).length;
  const pictCount = (docXml.match(/<w:pict/g) || []).length;

  let normalizedXml = normalizeTextBoxRuns(docXml, null, "word/document.xml");
  normalizedXml = normalizeParagraphRuns(normalizedXml, null, "word/document.xml", null);

  const postAnchorCount = (normalizedXml.match(/<wp:anchor/g) || []).length;
  const postDrawingCount = (normalizedXml.match(/<w:drawing/g) || []).length;
  const postTxbxCount = (normalizedXml.match(/<w:txbx/g) || []).length;

  const postPlaceholders: string[] = [];
  const postPhPattern = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{0,120})\]/g;
  let ppm;
  while ((ppm = postPhPattern.exec(normalizedXml)) !== null) {
    if (!postPlaceholders.includes(ppm[0])) postPlaceholders.push(ppm[0]);
  }

  const diagReport = {
    template: { id: tmpl.id, nome: tmpl.nome, file_url: tmpl.file_url },
    originalSize: templateBytes.length,
    documentXmlSize: docXml.length,
    normalizedXmlSize: normalizedXml.length,
    xmlStructure: { wpAnchor: anchorCount, wpInline: inlineCount, wDrawing: drawingCount, wPict: pictCount },
    postNormalization: {
      wpAnchor: postAnchorCount, wDrawing: postDrawingCount, wTxbx: postTxbxCount,
      anchorsPreserved: anchorCount === postAnchorCount, drawingsPreserved: drawingCount === postDrawingCount,
    },
    textBoxes: { count: textBoxes.length, details: textBoxes },
    placeholders: { beforeNormalization: allPlaceholders, afterNormalization: postPlaceholders, totalBefore: allPlaceholders.length, totalAfter: postPlaceholders.length },
    fragmentationSummary: {
      hasFragmentedPlaceholders: textBoxes.some(tb => tb.placeholdersFragmented.length > 0),
      fragmented: textBoxes.filter(tb => tb.placeholdersFragmented.length > 0).map(tb => ({
        textBox: tb.index, text: tb.visibleText, fragmentedVars: tb.placeholdersFragmented,
      })),
    },
  };

  console.log("[template-preview] DIAGNOSTIC REPORT:", JSON.stringify(diagReport, null, 2));
  return new Response(JSON.stringify(diagReport, null, 2), { status: 200, headers: corsJson });
}
