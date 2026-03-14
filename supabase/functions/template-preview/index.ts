import { createClient } from "npm:@supabase/supabase-js@2";
import JSZip from "npm:jszip@3.10.1";
import { flattenSnapshot } from "../_shared/flattenSnapshot.ts";
import { resolveGotenbergUrl } from "../_shared/resolveGotenbergUrl.ts";


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

// ═══════════════════════════════════════════════════════════════
// DOCX PROCESSING
// ═══════════════════════════════════════════════════════════════

/**
 * Robust DOCX template processor.
 * Step 1: Normalize split placeholders by merging <w:r> runs within each <w:p>.
 * Step 2: Simple [key] → value substitution on the normalized XML.
 * Step 3: Final sweep to blank out any unresolved [placeholder] tags.
 */
async function processDocxTemplate(
  templateBytes: Uint8Array,
  vars: Record<string, string>,
  debugMode = false,
): Promise<{
  output: Uint8Array;
  missingVars: string[];
  mergeEvents: MergeEvent[];
  xmlBefore: Record<string, string>;
  xmlAfter: Record<string, string>;
  structureBefore: StructureReport;
  structureAfter: StructureReport;
  fontsInAffectedBlocks: string[];
}> {
  const zip = await JSZip.loadAsync(templateBytes);
  const missingVars: string[] = [];
  const mergeEvents: MergeEvent[] = [];
  const xmlBefore: Record<string, string> = {};
  const xmlAfter: Record<string, string> = {};
  let structureBefore: StructureReport = emptyStructure();
  let structureAfter: StructureReport = emptyStructure();
  const fontsInAffectedBlocks = new Set<string>();

  // Process ALL word/*.xml files (headers, footers, document, etc.)
  const excludePatterns = /\/(theme|media|_rels|fontTable|settings|webSettings|styles|numbering|glossary)\b/i;
  const xmlFiles: string[] = [];
  zip.forEach((relativePath) => {
    if (
      relativePath.startsWith("word/") &&
      relativePath.endsWith(".xml") &&
      !excludePatterns.test(relativePath)
    ) {
      xmlFiles.push(relativePath);
    }
  });
  console.log("[template-preview] XML files to process:", xmlFiles);

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;

    let content = await file.async("string");
    let modified = false;

    // ── DEBUG: Capture structure before normalization ──
    if (debugMode && fileName === "word/document.xml") {
      structureBefore = analyzeStructure(content);
      // Capture first 50KB of XML before normalization
      xmlBefore[fileName] = content.substring(0, 50000);
    }

    // ── STEP 1a: Normalize runs inside text boxes FIRST ──
    content = normalizeTextBoxRuns(content, debugMode ? mergeEvents : null, fileName);

    // ── STEP 1b: Normalize split runs in regular paragraphs ──
    content = normalizeParagraphRuns(content, debugMode ? mergeEvents : null, fileName, debugMode ? fontsInAffectedBlocks : null);

    // ── DEBUG: Capture structure after normalization ──
    if (debugMode && fileName === "word/document.xml") {
      structureAfter = analyzeStructure(content);
      xmlAfter[fileName] = content.substring(0, 50000);
    }

    // ── STEP 2: Direct substitution for both formats ──
    for (const [key, value] of Object.entries(vars)) {
      const safeValue = escapeXml(value);
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

    // ── STEP 3: Final sweep — blank remaining *valid placeholders* only ──
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

    for (const varName of localMissing) {
      const bracketPattern = `[${varName}]`;
      const mustachePattern = `{{${varName}}}`;
      if (content.includes(bracketPattern)) {
        content = content.replaceAll(bracketPattern, "");
        modified = true;
      }
      if (content.includes(mustachePattern)) {
        content = content.replaceAll(mustachePattern, "");
        modified = true;
      }
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
        const spanInterContent = interRunContent.slice(span[0], span[1] + 1).join("");
        rebuiltRegion += spanInterContent;
        const groupRuns = textRuns.slice(span[0], span[1] + 1);
        const combinedText = groupRuns.map((r) => r.text).join("");
        const rPr = groupRuns[0].rPr;
        rebuiltRegion += `<w:r>${rPr}<w:t xml:space="preserve">${combinedText}</w:t></w:r>`;
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

function escapeXml(str: string): string {
  return str
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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonError("Token inválido", 401);
    const userId = claimsData.claims.sub as string;

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
    const [leadRes, clienteRes, projetoRes, consultorRes] = await Promise.all([
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
            .select("nome, telefone, email, cpf_cnpj, cidade, estado, bairro, rua, numero, cep, potencia_kwp, valor_projeto, empresa, complemento, data_nascimento, numero_placas, modelo_inversor")
            .eq("id", propostaData.cliente_id)
            .eq("tenant_id", tenantId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      propostaData?.projeto_id
        ? adminClient
            .from("projetos")
            .select("codigo, status, potencia_kwp, valor_total, numero_modulos, modelo_inversor, modelo_modulos, data_instalacao, geracao_mensal_media_kwh, tipo_instalacao, forma_pagamento")
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
    ]);

    const lead = leadRes.data;
    const cliente = clienteRes.data;
    const projeto = projetoRes.data as any;
    const consultor = consultorRes.data as any;

    // ── 6. MONTAR MAPA DE VARIÁVEIS ───────────────────────
    // Comprehensive variable resolution covering ALL catalog categories
    const now = new Date();
    const fmtCur = (v: number) =>
      new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
    const fmtNum = (v: number, decimals = 2) =>
      new Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(v);

    const vars: Record<string, string> = {};

    // 6a. Se tiver snapshot, extrair TODOS campos primitivos (evitar objetos complexos)
    const snapshot = versaoData?.snapshot as Record<string, any> | null;
    if (snapshot && typeof snapshot === "object") {
      for (const [key, value] of Object.entries(snapshot)) {
        if (value !== null && value !== undefined && value !== "" && typeof value !== "object") {
          vars[key] = String(value);
        }
        if (value && typeof value === "object" && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value as Record<string, any>)) {
            if (subValue !== null && subValue !== undefined && subValue !== "" && typeof subValue !== "object") {
              vars[`${key}_${subKey}`] = String(subValue);
            }
          }
        }
      }
    }

    // 6b. Helpers
    const set = (legacy: string, value: string | number | null | undefined) => {
      if (value !== null && value !== undefined && value !== "") {
        vars[legacy] = String(value);
      }
    };
    const setIfMissing = (key: string, value: string | number | null | undefined) => {
      if (!vars[key] && value !== null && value !== undefined && value !== "") {
        vars[key] = String(value);
      }
    };
    const setCur = (key: string, value: number | null | undefined) => {
      if (value != null && !isNaN(value)) vars[key] = fmtCur(value);
    };
    const setCurIfMissing = (key: string, value: number | null | undefined) => {
      if (!vars[key] && value != null && !isNaN(value)) vars[key] = fmtCur(value);
    };
    const snapNum = (key: string): number | null => {
      const v = snapshot?.[key];
      if (v == null || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    };

    // ═══════════════════════════════════════════════════════
    // FLATTEN: Nested snapshot → flat vars (shared utility)
    // ═══════════════════════════════════════════════════════
    const flatSnap = flattenSnapshot(snapshot as Record<string, unknown>);
    for (const [k, v] of Object.entries(flatSnap)) {
      if (!vars[k]) vars[k] = v;
    }

    const tecnico = (snapshot?.tecnico && typeof snapshot.tecnico === "object" && !Array.isArray(snapshot.tecnico))
      ? snapshot.tecnico as Record<string, unknown> : {};
    const ucsSnap = Array.isArray(snapshot?.ucs) ? snapshot.ucs as Array<Record<string, unknown>> : [];

    console.log("[template-preview] flattenSnapshot applied — keys injected:", Object.keys(flatSnap).length);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: CLIENTE
    // ═══════════════════════════════════════════════════════
    const nomeCliente = cliente?.nome || lead?.nome;
    set("cliente_nome", nomeCliente);
    set("vc_nome", nomeCliente);
    set("cliente_celular", cliente?.telefone || lead?.telefone);
    set("cliente_email", cliente?.email);
    set("cliente_cnpj_cpf", cliente?.cpf_cnpj);
    set("cliente_empresa", cliente?.empresa);
    set("cliente_cep", cliente?.cep || lead?.cep);
    set("cliente_endereco", cliente?.rua || lead?.rua);
    set("cliente_numero", cliente?.numero || lead?.numero);
    set("cliente_complemento", cliente?.complemento);
    set("cliente_bairro", cliente?.bairro || lead?.bairro);
    set("cliente_cidade", cliente?.cidade || lead?.cidade);
    set("cliente_estado", cliente?.estado || lead?.estado);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: ENTRADA DE DADOS
    // ═══════════════════════════════════════════════════════
    const cidadeVal = cliente?.cidade || lead?.cidade;
    const estadoVal = cliente?.estado || lead?.estado;
    set("cidade", cidadeVal);
    set("estado", estadoVal);
    if (cidadeVal && estadoVal) {
      setIfMissing("cidade_estado", `${cidadeVal} - ${estadoVal}`);
    }

    const consumo = lead?.media_consumo || snapNum("consumo_mensal")
      || (ucsSnap[0] ? Number(ucsSnap[0].consumo_mensal) || null : null)
      || (tecnico.consumo_total_kwh ? Number(tecnico.consumo_total_kwh) : null);
    set("consumo_mensal", consumo);
    set("capo_m", consumo ? `${fmtNum(consumo, 0)} kWh/mês` : undefined);
    set("tipo_telhado", lead?.tipo_telhado || snapshot?.tipo_telhado);
    set("cape_telhado", lead?.tipo_telhado || snapshot?.tipo_telhado);
    set("fase", lead?.rede_atendimento || snapshot?.fase);
    set("tensao_rede", lead?.rede_atendimento || snapshot?.tensao_rede);
    set("area_util", lead?.area ? `${lead.area} m²` : snapshot?.area_util);
    setIfMissing("distancia", snapshot?.distancia);
    setIfMissing("taxa_desempenho", snapshot?.taxa_desempenho);
    setIfMissing("desvio_azimutal", snapshot?.desvio_azimutal);
    setIfMissing("inclinacao", snapshot?.inclinacao);
    setIfMissing("fator_geracao", snapshot?.fator_geracao);
    setIfMissing("tipo_sistema", snapshot?.tipo_sistema);
    setIfMissing("topologia", snapshot?.topologia);
    setIfMissing("fator_simultaneidade", snapshot?.fator_simultaneidade);

    setIfMissing("dis_energia", snapshot?.concessionaria_nome || snapshot?.dis_energia);
    setIfMissing("subgrupo_uc1", snapshot?.subgrupo || snapshot?.grupo_tarifario || snapshot?.subgrupo_uc1);
    setIfMissing("custo_disponibilidade_kwh", snapshot?.custo_disponibilidade_kwh);
    setIfMissing("tarifa_distribuidora", snapshot?.tarifa_distribuidora || snapshot?.tarifa_kwh);

    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    for (const m of meses) {
      setIfMissing(`consumo_${m}`, snapshot?.[`consumo_${m}`]);
      setIfMissing(`fator_geracao_${m}`, snapshot?.[`fator_geracao_${m}`]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: SISTEMA SOLAR
    // ═══════════════════════════════════════════════════════
    const potencia = versaoData?.potencia_kwp || projeto?.potencia_kwp || cliente?.potencia_kwp || snapNum("potencia_kwp") || snapNum("potencia_sistema");
    if (potencia) {
      const potStr = String(potencia);
      const formatted = potStr.includes("kWp") ? potStr : `${fmtNum(potencia)} kWp`;
      set("potencia_sistema", formatted);
      set("potencia_si", formatted);
    }
    setIfMissing("potencia_ideal_total", snapshot?.potencia_ideal_total);

    const numModulos = projeto?.numero_modulos || cliente?.numero_placas || snapshot?.numero_modulos || snapshot?.modulo_quantidade;
    set("modulo_quantidade", numModulos);
    set("vc_total_modulo", numModulos);

    set("modulo_modelo", projeto?.modelo_modulos || snapshot?.modulo_modelo);
    setIfMissing("modulo_fabricante", snapshot?.modulo_fabricante);
    if (snapshot?.modulo_potencia) {
      const mp = String(snapshot.modulo_potencia);
      setIfMissing("modulo_potencia", mp.includes("Wp") ? mp : `${mp} Wp`);
    }
    setIfMissing("vc_modulo_potencia", snapshot?.modulo_potencia);

    set("inversor_modelo", projeto?.modelo_inversor || cliente?.modelo_inversor || snapshot?.inversor_modelo);
    const invFab = snapshot?.inversor_fabricante || snapshot?.inversor_fabricante_1;
    setIfMissing("inversor_fabricante_1", invFab);
    setIfMissing("inversor_fabricante", invFab);
    const invPot = snapshot?.inversor_potencia || snapshot?.inversor_potencia_nominal;
    if (invPot) {
      const ipStr = String(invPot);
      const fmtInvPot = ipStr.includes("W") ? ipStr : `${ipStr} W`;
      setIfMissing("inversor_potencia_nominal", fmtInvPot);
    }
    setIfMissing("inversores_utilizados", snapshot?.inversores_utilizados || (projeto?.modelo_inversor ? `1x ${projeto.modelo_inversor}` : undefined));
    const inversorFields = ["inversor_fabricante", "inversor_modelo", "inversor_quantidade", "inversor_potencia",
      "inversor_potencia_nominal", "inversor_tensao", "inversor_tipo", "inversor_corrente_saida",
      "inversor_mppts_utilizados", "inversor_strings_utilizadas", "inversor_codigo", "inversor_garantia",
      "inversor_sistema", "inversor_corrente_max_carga_cc", "inversor_corrente_max_descarga_cc",
      "inversor_tipo_bateria", "inversor_tensao_bateria_min", "inversor_tensao_bateria_max"];
    for (const k of inversorFields) {
      setIfMissing(k, snapshot?.[k]);
      for (let i = 1; i <= 5; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }
    setIfMissing("inversores_potencia_maxima_total", snapshot?.inversores_potencia_maxima_total);
    setIfMissing("inversor_corrente_max_entrada_1", snapshot?.inversor_corrente_max_entrada_1);
    setIfMissing("inversor_corrente_max_entrada_mppt1_1", snapshot?.inversor_corrente_max_entrada_mppt1_1);

    for (const k of ["otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade"]) {
      setIfMissing(k, snapshot?.[k]);
    }
    setIfMissing("transformador_nome", snapshot?.transformador_nome);
    setIfMissing("transformador_potencia", snapshot?.transformador_potencia);

    const bateriaFields = ["bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia",
      "bateria_quantidade", "bateria_comprimento", "bateria_largura", "bateria_profundidade",
      "bateria_tensao_operacao", "bateria_tensao_carga", "bateria_tensao_nominal",
      "bateria_potencia_maxima_saida", "bateria_corrente_maxima_descarga", "bateria_corrente_maxima_carga",
      "bateria_corrente_recomendada", "bateria_capacidade"];
    for (const k of bateriaFields) {
      setIfMissing(k, snapshot?.[k]);
      for (let i = 1; i <= 3; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }
    const bateriaTemp = ["bateria_temperatura_descarga_min", "bateria_temperatura_descarga_max",
      "bateria_temperatura_carga_min", "bateria_temperatura_carga_max",
      "bateria_temperatura_armazenamento_min", "bateria_temperatura_armazenamento_max"];
    for (const k of bateriaTemp) {
      setIfMissing(k, snapshot?.[k]);
      for (let i = 1; i <= 3; i++) setIfMissing(`${k}_${i}`, snapshot?.[`${k}_${i}`]);
    }

    for (const k of ["autonomia", "energia_diaria_armazenamento", "armazenamento_necessario", "armazenamento_util_adicionado", "p_armazenamento_necessario", "dod"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    for (const k of ["layout_arranjo_linhas", "layout_arranjo_modulos", "layout_arranjo_orientacao",
      "layout_linhas_total", "layout_arranjos_total", "layout_arranjos_total_horizontal",
      "layout_arranjos_total_vertical", "layout_orientacao"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    const geracaoMensal = projeto?.geracao_mensal_media_kwh || snapNum("geracao_mensal")
      || (tecnico.geracao_estimada_kwh ? Number(tecnico.geracao_estimada_kwh) : null);
    set("geracao_mensal", geracaoMensal ? `${fmtNum(Number(geracaoMensal), 0)} kWh/mês` : undefined);
    setIfMissing("geracao_anual", snapshot?.geracao_anual);
    for (const m of meses) setIfMissing(`geracao_${m}`, snapshot?.[`geracao_${m}`]);
    for (let i = 0; i <= 25; i++) {
      setIfMissing(`geracao_anual_${i}`, snapshot?.[`geracao_anual_${i}`]);
    }

    setIfMissing("qtd_ucs", snapshot?.qtd_ucs);
    setIfMissing("creditos_gerados", snapshot?.creditos_gerados);
    setIfMissing("kit_fechado_quantidade", snapshot?.kit_fechado_quantidade);
    setIfMissing("segmentos_utilizados", snapshot?.segmentos_utilizados);
    setIfMissing("area_necessaria", snapshot?.area_necessaria);
    setIfMissing("peso_total", snapshot?.peso_total);
    setIfMissing("estrutura_tipo", snapshot?.estrutura_tipo);
    setIfMissing("kit_codigo", snapshot?.kit_codigo);

    if (consumo && geracaoMensal) {
      const aumento = ((Number(geracaoMensal) - Number(consumo)) / Number(consumo)) * 100;
      if (aumento > 0) {
        setIfMissing("vc_aumento", `${fmtNum(aumento)}%`);
      }
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: FINANCEIRO
    // ═══════════════════════════════════════════════════════
    const finSnap = (snapshot?.financeiro && typeof snapshot.financeiro === "object") ? snapshot.financeiro as Record<string, any> : {};
    const valorTotal = versaoData?.valor_total ?? finSnap?.valor_total ?? projeto?.valor_total ?? lead?.valor_estimado ?? cliente?.valor_projeto ?? snapNum("preco_total") ?? snapNum("preco");
    if (valorTotal != null && Number(valorTotal) > 0) {
      const vt = Number(valorTotal);
      setCur("valor_total", vt);
      setCur("preco_final", vt);
      setCur("preco_total", vt);
      setCur("preco", vt);
      setCur("vc_a_vista", vt);
      setCur("capo_i", vt);
      setCur("kit_fechado_preco_total", vt);

      if (potencia && potencia > 0) {
        set("preco_kwp", fmtCur(vt / potencia));
        set("preco_watt", `${fmtNum(vt / (potencia * 1000), 2)} R$/W`);
        setIfMissing("vc_preco_watt", fmtNum(vt / (potencia * 1000), 2));
      }
    }

    const econMensal = versaoData?.economia_mensal ?? finSnap?.economia_mensal ?? snapNum("economia_mensal");
    if (econMensal) {
      setCur("economia_mensal", Number(econMensal));
      setCurIfMissing("economia_anual", Number(econMensal) * 12);
      setCurIfMissing("roi_25_anos", Number(econMensal) * 12 * 25);
      setCurIfMissing("solar_25_anos", Number(econMensal) * 12 * 25);
      setCurIfMissing("vc_economia_acumulada", Number(econMensal) * 12 * 25);
      setCurIfMissing("vc_economia_conta_total_rs", Number(econMensal) * 12);
    }

    const paybackMeses = versaoData?.payback_meses ?? finSnap?.payback_meses;
    if (paybackMeses != null && Number(paybackMeses) > 0) {
      const pm = Number(paybackMeses);
      const anos = Math.floor(pm / 12);
      const mesesPb = Math.round(pm % 12);
      set("payback", `${anos} anos e ${mesesPb} meses`);
      set("payback_meses", String(pm));
      set("payback_anos", fmtNum(pm / 12, 1));
    } else {
      setIfMissing("payback", "-");
    }

    if (econMensal && valorTotal) {
      const retorno10 = Number(econMensal) * 12 * 10 - Number(valorTotal);
      setCurIfMissing("fluxo_caixa_acumulado_anual_10", Math.max(retorno10, 0));
    }

    if (econMensal && valorTotal && Number(valorTotal) > 0) {
      setIfMissing("vc_roi_primeiro_mes", `${fmtNum((Number(econMensal) / Number(valorTotal)) * 100)}%`);
      setIfMissing("vc_investimento_solar_rendimento", `${fmtNum((Number(econMensal) * 12 / Number(valorTotal)) * 100)}%`);
    }

    const gastoAtual = snapNum("gasto_atual_mensal") || snapNum("gasto_energia_mensal_atual");
    if (gastoAtual && econMensal) {
      setIfMissing("economia_percentual", `${fmtNum((Number(econMensal) / gastoAtual) * 100, 0)}%`);
      setIfMissing("vc_economia_conta_total_pc", `${fmtNum((Number(econMensal) / gastoAtual) * 100, 0)}%`);
    }

    if (valorTotal && geracaoMensal) {
      const tarifaSolar = Number(valorTotal) / (Number(geracaoMensal) * 12 * 25);
      setIfMissing("vc_tarifa_solar", fmtNum(tarifaSolar, 4));
    }

    const finFields = [
      "modulo_custo_un", "modulo_preco_un", "modulo_custo_total", "modulo_preco_total",
      "inversor_custo_un", "inversor_preco_un", "inversor_custo_total", "inversor_preco_total",
      "inversores_custo_total", "inversores_preco_total",
      "otimizador_custo_un", "otimizador_preco_un", "otimizador_custo_total", "otimizador_preco_total",
      "kit_fechado_custo_total",
      "instalacao_custo_total", "instalacao_preco_total",
      "estrutura_custo_total", "estrutura_preco_total",
      "equipamentos_custo_total", "kits_custo_total", "componentes_custo_total",
      "baterias_custo_total", "baterias_preco_total",
      "margem_lucro", "margem_percentual", "desconto_percentual", "desconto_valor",
      "custo_modulos", "custo_inversores", "custo_estrutura", "custo_instalacao", "custo_kit",
      "comissao_percentual", "comissao_valor", "comissao_res", "comissao_rep", "comissao_res_p", "comissao_rep_p",
      "distribuidor_categoria",
    ];
    for (const k of finFields) setIfMissing(k, snapshot?.[k]);
    for (let i = 1; i <= 5; i++) {
      for (const prefix of ["inversor_custo_un_", "inversor_preco_un_", "inversor_preco_total_",
        "transformador_custo_un_", "transformador_preco_un_",
        "bateria_custo_un_", "bateria_preco_un_", "bateria_preco_total_",
        "item_a_nome_", "item_a_custo_", "item_a_preco_"]) {
        setIfMissing(`${prefix}${i}`, snapshot?.[`${prefix}${i}`]);
      }
    }
    setIfMissing("transformadores_custo_total", snapshot?.transformadores_custo_total);
    setIfMissing("transformadores_preco_total", snapshot?.transformadores_preco_total);

    setIfMissing("vpl", snapshot?.vpl);
    setIfMissing("tir", snapshot?.tir);

    for (let i = 1; i <= 5; i++) {
      for (const k of ["f_nome_", "f_entrada_", "f_entrada_p_", "f_valor_", "f_valor_p_",
        "f_prazo_", "f_carencia_", "f_taxa_", "f_parcela_"]) {
        setIfMissing(`${k}${i}`, snapshot?.[`${k}${i}`]);
      }
    }
    for (const k of ["f_ativo_nome", "f_ativo_entrada", "f_ativo_entrada_p", "f_ativo_valor",
      "f_ativo_valor_p", "f_ativo_prazo", "f_ativo_carencia", "f_ativo_taxa", "f_ativo_parcela",
      "f_banco", "f_taxa_juros", "f_parcelas", "f_valor_parcela", "f_entrada", "f_valor_financiado", "f_cet"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    for (let i = 0; i <= 25; i++) {
      for (const prefix of ["investimento_anual_", "economia_anual_valor_", "fluxo_caixa_acumulado_anual_"]) {
        setIfMissing(`${prefix}${i}`, snapshot?.[`${prefix}${i}`]);
      }
    }

    for (const k of ["solar_25", "renda_25", "poupanca_25"]) setIfMissing(k, snapshot?.[k]);
    setIfMissing("preco_por_extenso", snapshot?.preco_por_extenso);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: CONTA DE ENERGIA
    // ═══════════════════════════════════════════════════════
    const contaFields = [
      "gasto_atual_mensal", "gasto_com_solar_mensal", "economia_percentual",
      "creditos_mensal", "tarifa_atual", "imposto_percentual", "bandeira_tarifaria",
      "custo_disponibilidade_valor", "gasto_energia_mensal_atual", "gasto_energia_mensal_novo",
      "gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_novo",
      "gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_novo",
      "gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_novo",
      "gasto_demanda_mensal_atual", "gasto_demanda_mensal_novo",
      "economia_energia_mensal", "economia_energia_mensal_p",
      "economia_demanda_mensal", "economia_demanda_mensal_p",
      "gasto_total_mensal_atual", "gasto_total_mensal_novo",
      "creditos_alocados", "consumo_abatido",
      "valor_imposto_energia", "tarifacao_energia_compensada_bt",
    ];
    for (const k of contaFields) setIfMissing(k, snapshot?.[k]);
    for (const m of meses) {
      setIfMissing(`creditos_${m}`, snapshot?.[`creditos_${m}`]);
      setIfMissing(`creditos_alocados_${m}`, snapshot?.[`creditos_alocados_${m}`]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: PREMISSAS
    // ═══════════════════════════════════════════════════════
    for (const k of ["inflacao_energetica", "inflacao_ipca", "imposto", "vpl_taxa_desconto",
      "perda_eficiencia_anual", "troca_inversor", "troca_inversor_custo",
      "sobredimensionamento", "vida_util_sistema"]) {
      setIfMissing(k, snapshot?.[k]);
    }

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: COMERCIAL
    // ═══════════════════════════════════════════════════════
    set("proposta_data", now.toLocaleDateString("pt-BR"));
    set("proposta_titulo", propostaData?.titulo || nomeCliente);
    set("proposta_identificador", propostaData?.codigo);
    const validadeDias = versaoData?.validade_dias || 15;
    const validade = new Date(now.getTime() + validadeDias * 86400000);
    set("proposta_validade", validade.toLocaleDateString("pt-BR"));
    set("proposta_versao", versaoData?.versao_numero);

    set("responsavel_nome", consultor?.nome);
    set("consultor_nome", consultor?.nome);
    set("consultor_telefone", consultor?.telefone);
    set("consultor_email", consultor?.email);

    // Empresa do tenant
    const { data: tenantInfo } = await adminClient
      .from("tenants")
      .select("nome")
      .eq("id", tenantId)
      .maybeSingle();
    set("empresa_nome", tenantInfo?.nome);

    // ═══════════════════════════════════════════════════════
    // CUSTOMIZADAS LEGADAS (vc_*)
    // ═══════════════════════════════════════════════════════
    setIfMissing("vc_cartao_credito_parcela_1", snapshot?.cartao_parcela_3);
    setIfMissing("vc_cartao_credito_parcela_2", snapshot?.cartao_parcela_6);
    setIfMissing("vc_cartao_credito_parcela_3", snapshot?.cartao_parcela_12);
    setIfMissing("vc_cartao_credito_parcela_4", snapshot?.cartao_parcela_24);
    setIfMissing("vc_parcela_1", snapshot?.parcela_36);
    setIfMissing("vc_parcela_2", snapshot?.parcela_48);
    setIfMissing("vc_parcela_3", snapshot?.parcela_60);

    // ═══════════════════════════════════════════════════════
    // PAGAMENTO_OPCOES → vc_* / f_* mapping (robusto)
    // ═══════════════════════════════════════════════════════
    const rawPagOpcoes = Array.isArray(snapshot?.pagamento_opcoes)
      ? snapshot.pagamento_opcoes as Array<Record<string, unknown>>
      : (Array.isArray(snapshot?.pagamentoOpcoes)
        ? snapshot.pagamentoOpcoes as Array<Record<string, unknown>>
        : []);

    const invalidTokens = new Set(["", "-", "--", "n/a", "na", "null", "undefined"]);
    const parseLocaleNumber = (value: unknown): number | null => {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return Number.isFinite(value) ? value : null;
      const raw = String(value).trim();
      if (!raw) return null;
      if (invalidTokens.has(raw.toLowerCase())) return null;
      let normalized = raw.replace(/R\$/gi, "").replace(/%/g, "").replace(/\s/g, "").replace(/[^\d,.-]/g, "");
      if (!normalized) return null;
      const hasComma = normalized.includes(",");
      const hasDot = normalized.includes(".");
      if (hasComma && hasDot) {
        if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
          normalized = normalized.replace(/\./g, "").replace(",", ".");
        } else {
          normalized = normalized.replace(/,/g, "");
        }
      } else if (hasComma) {
        normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
      } else {
        normalized = normalized.replace(/,/g, "");
      }
      const num = Number(normalized);
      return Number.isFinite(num) ? num : null;
    };

    const pickText = (...values: unknown[]): string | undefined => {
      for (const value of values) {
        if (value === null || value === undefined) continue;
        const txt = String(value).trim();
        if (!txt || invalidTokens.has(txt.toLowerCase())) continue;
        return txt;
      }
      return undefined;
    };

    type NormalizedPagamento = {
      tipo: string;
      nome: string;
      valor_financiado: number | null;
      valor_parcela: number | null;
      entrada: number | null;
      num_parcelas: number | null;
      taxa_mensal: number | null;
      fonte: "pagamento_opcoes" | "pagamentoOpcoes" | "none";
      raw: Record<string, unknown>;
    };

    const rawPagamentoSource: "pagamento_opcoes" | "pagamentoOpcoes" | "none" = Array.isArray(snapshot?.pagamento_opcoes)
      ? "pagamento_opcoes"
      : (Array.isArray(snapshot?.pagamentoOpcoes) ? "pagamentoOpcoes" : "none");

    const normalizedPagOpcoes: NormalizedPagamento[] = rawPagOpcoes.map((p) => {
      const nome = pickText(p.nome, p.banco, p.banco_nome, p.label, p.descricao) || "Opção";
      const rawTipo = pickText(p.tipo, p.metodo, p.forma_pagamento)?.toLowerCase() || "";
      const nomeLower = nome.toLowerCase();
      let tipo = rawTipo;
      if (rawTipo.includes("vista")) tipo = "a_vista";
      else if (rawTipo.includes("cart")) tipo = "cartao";
      else if (rawTipo.includes("financ")) tipo = "financiamento";
      else if (rawTipo.includes("parcel")) tipo = "parcelado";
      if (!tipo) {
        if (/cart[aã]o|cr[eé]dito/i.test(nomeLower)) tipo = "cartao";
        else if (/a vista|à vista/i.test(nomeLower)) tipo = "a_vista";
        else tipo = "outro";
      }
      return {
        tipo,
        nome,
        valor_financiado: parseLocaleNumber(p.valor_financiado ?? p.valorFinanciado ?? p.valor ?? p.valor_total),
        valor_parcela: parseLocaleNumber(p.valor_parcela ?? p.valorParcela ?? p.parcela ?? p.valor_mensal),
        entrada: parseLocaleNumber(p.entrada ?? p.valor_entrada ?? p.entrada_valor),
        num_parcelas: (() => { const n = parseLocaleNumber(p.num_parcelas ?? p.numParcelas ?? p.prazo ?? p.parcelas); return n != null ? Math.round(n) : null; })(),
        taxa_mensal: parseLocaleNumber(p.taxa_mensal ?? p.taxaMensal ?? p.taxa ?? p.juros_mensal),
        fonte: rawPagamentoSource,
        raw: p,
      };
    }).filter((p) =>
      p.tipo === "a_vista" || p.valor_financiado != null || p.valor_parcela != null || p.num_parcelas != null || p.taxa_mensal != null || p.entrada != null
    );

    if (normalizedPagOpcoes.length > 0) {
      const aVista = normalizedPagOpcoes.find((p) => p.tipo === "a_vista")
        || normalizedPagOpcoes.find((p) => /a vista|à vista/i.test(p.nome));
      const aVistaValor = aVista?.valor_financiado ?? aVista?.valor_parcela ?? (valorTotal != null ? Number(valorTotal) : null);
      if (aVistaValor != null) setCur("vc_a_vista", aVistaValor);

      const cartoes = normalizedPagOpcoes
        .filter((p) => p.tipo === "cartao" || /cart[aã]o|cr[eé]dito/i.test(p.nome))
        .sort((a, b) => (a.num_parcelas ?? 999) - (b.num_parcelas ?? 999));
      const financiamentos = normalizedPagOpcoes
        .filter((p) => p.tipo === "financiamento" || p.tipo === "parcelado" || (p.tipo === "outro" && !/cart[aã]o|cr[eé]dito/i.test(p.nome)))
        .sort((a, b) => (a.num_parcelas ?? 999) - (b.num_parcelas ?? 999));

      financiamentos.slice(0, 3).forEach((f, idx) => {
        const i = idx + 1;
        const parcela = f.valor_parcela ?? ((f.valor_financiado != null && f.num_parcelas && f.num_parcelas > 0) ? f.valor_financiado / f.num_parcelas : null);
        if (parcela != null) setCur(`vc_parcela_${i}`, parcela);
        if (f.taxa_mensal != null) setIfMissing(`vc_taxa_${i}`, `${fmtNum(f.taxa_mensal, 2)}%`);
        if (f.entrada != null) setCurIfMissing(`vc_entrada_${i}`, f.entrada);
        if (f.num_parcelas != null) setIfMissing(`vc_prazo_${i}`, String(f.num_parcelas));
      });

      cartoes.slice(0, 4).forEach((c, idx) => {
        const i = idx + 1;
        const parcela = c.valor_parcela ?? ((c.valor_financiado != null && c.num_parcelas && c.num_parcelas > 0) ? c.valor_financiado / c.num_parcelas : null);
        if (parcela != null) setCur(`vc_cartao_credito_parcela_${i}`, parcela);
        if (c.taxa_mensal != null) setIfMissing(`vc_cartao_credito_taxa_${i}`, `${fmtNum(c.taxa_mensal, 2)}%`);
      });

      const fOpcoes = [...financiamentos, ...cartoes].slice(0, 12);
      fOpcoes.forEach((p, idx) => {
        const i = idx + 1;
        const valorFinanciado = p.valor_financiado
          ?? ((p.valor_parcela != null && p.num_parcelas && p.num_parcelas > 0) ? (p.valor_parcela * p.num_parcelas) + (p.entrada ?? 0) : null);
        const parcela = p.valor_parcela ?? ((valorFinanciado != null && p.num_parcelas && p.num_parcelas > 0) ? valorFinanciado / p.num_parcelas : null);
        setIfMissing(`f_nome_${i}`, p.nome);
        if (p.entrada != null) setCurIfMissing(`f_entrada_${i}`, p.entrada);
        if (valorFinanciado != null) setCurIfMissing(`f_valor_${i}`, valorFinanciado);
        if (p.num_parcelas != null) setIfMissing(`f_prazo_${i}`, String(p.num_parcelas));
        if (p.taxa_mensal != null) setIfMissing(`f_taxa_${i}`, `${fmtNum(p.taxa_mensal, 2)}%`);
        if (parcela != null) setCurIfMissing(`f_parcela_${i}`, parcela);
      });
    }

    const pagamentoAuditKeys = [
      "vc_a_vista", "vc_parcela_1", "vc_parcela_2", "vc_parcela_3",
      "vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_2", "vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_4",
      "f_nome_1", "f_nome_2", "f_nome_3", "f_entrada_1", "f_entrada_2", "f_entrada_3",
      "f_valor_1", "f_valor_2", "f_valor_3", "f_prazo_1", "f_prazo_2", "f_prazo_3",
      "f_taxa_1", "f_taxa_2", "f_taxa_3", "f_parcela_1", "f_parcela_2", "f_parcela_3",
    ] as const;
    const pagamentoAuditPayload = Object.fromEntries(pagamentoAuditKeys.map((k) => [k, vars[k] ?? "(MISSING)"]));
    console.log("[template-preview] PAYMENT AUDIT:", JSON.stringify({ source: rawPagamentoSource, raw_count: rawPagOpcoes.length, normalized_count: normalizedPagOpcoes.length, placeholders: pagamentoAuditPayload }, null, 2));

    // ═══════════════════════════════════════════════════════
    // VARIAVEIS_CUSTOM from snapshot
    // ═══════════════════════════════════════════════════════
    if (Array.isArray(snapshot?.variaveis_custom)) {
      for (const vc of snapshot.variaveis_custom as Array<Record<string, any>>) {
        if (vc.nome && vc.valor_calculado != null) {
          setIfMissing(vc.nome, String(vc.valor_calculado));
        }
      }
    }

    setIfMissing("vpl", finSnap?.vpl != null ? fmtCur(Number(finSnap.vpl)) : snapshot?.vpl);
    setIfMissing("tir", finSnap?.tir != null ? `${fmtNum(Number(finSnap.tir), 1)}%` : snapshot?.tir);
    setIfMissing("payback_anos", finSnap?.payback_anos != null ? fmtNum(Number(finSnap.payback_anos), 1) : undefined);

    set("vc_observacao", lead?.observacoes || snapshot?.vc_observacao || snapshot?.observacoes);

    // ═══════════════════════════════════════════════════════
    // CATEGORIA: TARIFA / GD / ANEEL / CÁLCULO
    // ═══════════════════════════════════════════════════════
    for (const k of [
      "tarifa_te_kwh", "tarifa_tusd_total_kwh", "tarifa_fio_b_real_kwh", "tarifa_fio_b_usado_kwh",
      "tarifa_precisao", "tarifa_precisao_motivo", "tarifa_origem", "tarifa_vigencia_inicio", "tarifa_vigencia_fim",
      "gd_regra", "gd_ano_aplicado", "gd_fio_b_percent_cobrado", "gd_fio_b_percent_compensado",
      "aneel_last_sync_at", "aneel_run_id", "aneel_snapshot_hash_curto",
      "calc_consumo_mensal_kwh", "calc_custo_disponibilidade_kwh", "calc_consumo_compensavel_kwh",
      "calc_geracao_mensal_kwh", "calc_energia_compensada_kwh", "calc_valor_credito_kwh", "calc_economia_mensal_rs",
      "alerta_estimado_texto_pdf",
    ]) {
      setIfMissing(k, snapshot?.[k]);
    }

    if (geracaoMensal) {
      const co2Kg = Number(geracaoMensal) * 12 * 0.075;
      setIfMissing("co2_evitado_ano", fmtNum(co2Kg, 0));
    }

    // ═══════════════════════════════════════════════════════
    // DUAL-KEY SUPPORT: Canonical {{grupo.campo}} aliases
    // ═══════════════════════════════════════════════════════
    const canonicalPrefixMap: Record<string, string> = {
      "cliente_": "cliente.", "consumo_": "entrada.consumo_",
      "dis_energia": "entrada.dis_energia", "tarifa_distribuidora": "entrada.tarifa_distribuidora",
      "tipo_telhado": "entrada.tipo_telhado", "fase": "entrada.fase",
      "tensao_rede": "entrada.tensao_rede", "custo_disponibilidade_kwh": "entrada.custo_disponibilidade_kwh",
      "tipo_sistema": "entrada.tipo_sistema", "area_util": "entrada.area_util",
      "potencia_sistema": "sistema_solar.potencia_sistema", "geracao_mensal": "sistema_solar.geracao_mensal",
      "modulo_": "sistema_solar.modulo_", "inversor_": "sistema_solar.inversor_",
      "inversores_": "sistema_solar.inversores_", "otimizador_": "sistema_solar.otimizador_",
      "bateria_": "sistema_solar.bateria_", "transformador_": "sistema_solar.transformador_",
      "preco": "financeiro.preco", "preco_total": "financeiro.preco_total",
      "preco_final": "financeiro.preco_final", "valor_total": "financeiro.valor_total",
      "economia_": "financeiro.economia_", "payback": "financeiro.payback",
      "vpl": "financeiro.vpl", "tir": "financeiro.tir",
      "margem_": "financeiro.margem_", "comissao_": "financeiro.comissao_",
      "gasto_": "conta_energia.gasto_", "creditos_": "conta_energia.creditos_",
      "co2_evitado": "conta_energia.co2_evitado",
      "proposta_": "comercial.proposta_", "consultor_": "comercial.consultor_",
      "responsavel_": "comercial.responsavel_", "empresa_": "comercial.empresa_",
      "inflacao_": "premissas.inflacao_", "perda_eficiencia": "premissas.perda_eficiencia",
      "vida_util_sistema": "premissas.vida_util_sistema",
      "tarifa_te_": "tarifa.tarifa_te_", "tarifa_tusd_": "tarifa.tarifa_tusd_",
      "tarifa_fio_b_": "tarifa.tarifa_fio_b_", "tarifa_precisao": "tarifa.tarifa_precisao",
      "tarifa_origem": "tarifa.tarifa_origem", "gd_": "gd.", "aneel_": "aneel.", "calc_": "calculo.calc_",
    };

    const canonicalEntries: Record<string, string> = {};
    for (const [flatKey, value] of Object.entries(vars)) {
      for (const [prefix, canonicalPrefix] of Object.entries(canonicalPrefixMap)) {
        if (flatKey === prefix || flatKey.startsWith(prefix)) {
          const canonicalKey = flatKey.replace(prefix, canonicalPrefix);
          if (canonicalKey !== flatKey && !vars[canonicalKey]) {
            canonicalEntries[canonicalKey] = value;
          }
          break;
        }
      }
    }
    for (const [flatKey, value] of Object.entries(vars)) {
      if ((flatKey.startsWith("vc_") || flatKey.startsWith("f_")) && !vars[`customizada.${flatKey}`]) {
        canonicalEntries[`customizada.${flatKey}`] = value;
      }
    }
    Object.assign(vars, canonicalEntries);

    if (!vars["vc_financeira_nome"]) {
      const financeiraAtiva = normalizedPagOpcoes.find((p) => p.tipo === "financiamento");
      if (financeiraAtiva) {
        set("vc_financeira_nome", financeiraAtiva.nome);
        setIfMissing("customizada.vc_financeira_nome", financeiraAtiva.nome);
      }
    }

    console.log(`[template-preview] Dual-key canonical aliases added: ${Object.keys(canonicalEntries).length}`);
    console.log(`[template-preview] Variables mapped: ${Object.keys(vars).length} keys (includes canonical)`);

    // ── 7. DOWNLOAD TEMPLATE DOCX ─────────────────────────
    let templateBuffer: Uint8Array;
    try {
      if (template.file_url.startsWith("http")) {
        const resp = await fetch(template.file_url);
        if (!resp.ok) return jsonError(`Erro ao baixar template: HTTP ${resp.status}`, 500);
        templateBuffer = new Uint8Array(await resp.arrayBuffer());
      } else {
        const { data: fileData, error: dlError } = await adminClient.storage
          .from("proposta-templates")
          .download(template.file_url);
        if (dlError || !fileData) {
          console.error("[template-preview] Storage download error:", dlError?.message);
          return jsonError(`Erro ao baixar template DOCX: ${dlError?.message || "arquivo não encontrado"}`, 500);
        }
        templateBuffer = new Uint8Array(await fileData.arrayBuffer());
      }
      console.log(`[template-preview] DOCX downloaded: ${templateBuffer.byteLength} bytes`);
    } catch (fetchErr: any) {
      console.error("[template-preview] Download error:", fetchErr?.message);
      return jsonError(`Erro ao baixar template: ${fetchErr?.message}`, 500);
    }

    // ── 8. PROCESSAR TEMPLATE ─────────────────────────────
    console.log(`[template-preview] Processing DOCX with JSZip-based replacer${debugMode ? " [DEBUG MODE]" : ""}`);
    const originalSize = templateBuffer.byteLength;

    let report: Uint8Array;
    let processedMissingVars: string[] = [];
    let debugResult: Awaited<ReturnType<typeof processDocxTemplate>> | null = null;

    try {
      const result = await processDocxTemplate(templateBuffer, vars, debugMode);
      report = result.output;
      processedMissingVars = result.missingVars;
      if (debugMode) debugResult = result;

      const outputSize = report.length;
      const ratio = originalSize > 0 ? ((outputSize / originalSize) * 100).toFixed(1) : "N/A";
      console.log(`[template-preview] Size comparison: original=${originalSize}B → output=${outputSize}B (${ratio}%)`);
      if (originalSize > 0 && outputSize < originalSize * 0.95) {
        console.warn(`[template-preview] ⚠️ Output is <95% of original — possible content loss!`);
      }

      const totalVars = Object.keys(vars).length;
      const missingCount = result.missingVars.length;
      const substituted = totalVars - missingCount;
      console.log(`[template-preview] Substitution stats: ${substituted} replaced, ${missingCount} missing out of ${totalVars} total vars`);
      if (result.missingVars.length > 0) {
        console.warn(`[template-preview] Missing variables (${missingCount}):`, result.missingVars.slice(0, 30));
      }
    } catch (processErr: any) {
      console.error("[template-preview] Processing error:", processErr?.message, processErr?.stack);
      return jsonError(`Erro ao processar template DOCX: ${processErr?.message || "unknown"}`, 500);
    }

    // ── 9. PERSIST DOCX + PDF TO STORAGE ──────────────────
    const clienteNome = cliente?.nome || lead?.nome || "preview";
    const safeClienteName = clienteNome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
    const timestamp = Date.now();
    const docxStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_proposta.docx`;
    const pdfStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_proposta.pdf`;
    const debugStoragePath = `${tenantId}/propostas/${proposta_id || "draft"}/${timestamp}_debug_forensic.json`;

    // 9a. Upload DOCX to storage
    console.log(`[template-preview] Uploading DOCX to storage: ${docxStoragePath}`);
    const { error: docxUploadErr } = await adminClient.storage
      .from("proposta-documentos")
      .upload(docxStoragePath, report, {
        contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });
    if (docxUploadErr) {
      console.error("[template-preview] DOCX upload error:", docxUploadErr.message);
    }

    // 9b. Convert DOCX to PDF via Gotenberg
    let pdfBytes: Uint8Array | null = null;
    let pdfConversionError: string | null = null;
    let gotenbergUrl: string | null = null;
    let gotenbergResponseStatus: number | null = null;
    let gotenbergResponseTime: number | null = null;
    const gotenbergParams: Record<string, string> = {
      landscape: "false",
      nativePageRanges: "1-",
    };

    try {
      gotenbergUrl = await resolveGotenbergUrl(adminClient, tenantId);
      console.log(`[template-preview] Converting to PDF via Gotenberg: ${gotenbergUrl}`);

      const formData = new FormData();
      const blob = new Blob([report], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });
      formData.append("files", blob, "proposta.docx");
      formData.append("landscape", "false");
      formData.append("nativePageRanges", "1-");

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

      const forensicReport: ForensicDebugReport = {
        timestamp: new Date().toISOString(),
        templateId: template_id,
        templateName: template.nome,
        propostaId: proposta_id || null,
        tenantId,
        originalDocxSize: originalSize,
        processedDocxSize: report.length,
        pdfSize: pdfBytes?.length || null,
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
        }
      }
    }

    // ── 10. RETURN RESPONSE ──────────────────────────────
    const responsePayload: Record<string, unknown> = {
      success: true,
      output_docx_path: docxUploadErr ? null : docxStoragePath,
      output_pdf_path: (pdfBytes && !pdfConversionError) ? pdfStoragePath : null,
      generation_status: (pdfBytes && !pdfConversionError) ? "ready" : (docxUploadErr ? "error" : "docx_only"),
      generation_error: pdfConversionError || (docxUploadErr ? docxUploadErr.message : null),
      missing_vars: processedMissingVars,
      template_name: template.nome,
      generated_at: new Date().toISOString(),
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

    const fileName = `preview_${template.nome.replace(/[^a-zA-Z0-9]/g, "_")}_${safeClienteName}.docx`;
    console.log(`[template-preview] Returning ${report.length} bytes as ${fileName}`);

    return new Response(report, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "X-Output-Docx-Path": docxStoragePath,
        "X-Output-Pdf-Path": (pdfBytes && !pdfConversionError) ? pdfStoragePath : "",
        "X-Generation-Status": (pdfBytes && !pdfConversionError) ? "ready" : "docx_only",
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
