/**
 * chartInjector.ts — Detects chart placeholders in DOCX, resolves configs,
 * renders PNGs via proposal-chart-render, and injects images into the DOCX.
 *
 * Usage: import { injectChartsIntoDocx } from "../_shared/chartInjector.ts";
 *
 * v2 — Hardened: context detection (isolated/inline/table/header-footer),
 *       improved logging with skip reasons, header/footer blocking,
 *       dimension clamping, and structured chart report.
 */

import JSZip from "npm:jszip@3.10.1";

const LOG_PREFIX = "[chartInjector]";

// ── Types ───────────────────────────────────────────────────

interface ChartConfig {
  id: string;
  placeholder: string;
  chart_type: string;
  engine: string;
  data_source: string;
  label_field: string;
  value_field: string;
  title: string;
  subtitle: string | null;
  colors: string[];
  chart_options: Record<string, unknown>;
  width: number;
  height: number;
  show_legend: boolean;
  show_grid: boolean;
  show_labels: boolean;
}

interface RenderedChart {
  placeholder: string;
  chartId: string;
  imageBytes: Uint8Array;
  widthPx: number;
  heightPx: number;
}

type PlaceholderContext = "isolated" | "inline" | "table" | "header" | "footer";

interface ChartInjectionResult {
  output: Uint8Array;
  chartsDetected: string[];
  chartsRendered: string[];
  chartsFailed: string[];
  chartsSkipped: string[];
  reasons: Record<string, string>;
}

type SupabaseClient = {
  from: (table: string) => any;
  functions: { invoke: (name: string, opts: any) => Promise<any> };
};

// ── Placeholder Normalization ───────────────────────────────

export function normalizeChartPlaceholder(input: string): string {
  if (!input) return "";
  return input.trim().replace(/^\[|\]$/g, "").replace(/\s+/g, "_").toLowerCase();
}

// ── Placeholder Detection ───────────────────────────────────

/**
 * Detect [xxx] style placeholders in XML content.
 * Returns normalized placeholder names (without brackets).
 */
export function detectChartPlaceholders(xmlContent: string): string[] {
  const placeholders = new Set<string>();
  const regex = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{2,120})\]/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    placeholders.add(normalizeChartPlaceholder(match[1]));
  }
  return Array.from(placeholders);
}

// ── Data Resolution ─────────────────────────────────────────

export function resolveDataFromSnapshot(
  snapshot: Record<string, unknown>,
  dataSourcePath: string,
): Record<string, unknown>[] | null {
  const parts = dataSourcePath.split(".");
  let current: unknown = snapshot;

  for (const part of parts) {
    if (current && typeof current === "object" && part in (current as Record<string, unknown>)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return null;
    }
  }

  if (Array.isArray(current)) {
    return current as Record<string, unknown>[];
  }
  return null;
}

export function buildChartDataset(
  chart: ChartConfig,
  rawData: Record<string, unknown>[],
): { labels: string[]; datasets: any[] } {
  const labels = rawData.map((row) => String(row[chart.label_field] ?? ""));
  const values = rawData.map((row) => Number(row[chart.value_field] ?? 0));

  const opts = (chart.chart_options ?? {}) as Record<string, string>;
  let backgroundColor: string | string[];

  if (opts.negativeColor && opts.positiveColor) {
    backgroundColor = values.map((v) =>
      v < 0 ? opts.negativeColor : opts.positiveColor
    );
  } else if (
    chart.colors?.length > 1 &&
    (chart.chart_type === "pie" || chart.chart_type === "doughnut")
  ) {
    backgroundColor = chart.colors;
  } else {
    backgroundColor = chart.colors?.[0] ?? "#3b82f6";
  }

  return {
    labels,
    datasets: [
      {
        label: chart.title,
        data: values,
        backgroundColor,
        borderColor: "transparent",
        borderWidth: 0,
      },
    ],
  };
}

// ── Context Detection ───────────────────────────────────────

/**
 * Determine the context of a placeholder within a paragraph XML.
 * Returns whether the placeholder is the sole content of the paragraph ("isolated")
 * or mixed with other text ("inline").
 */
function detectParagraphContext(
  paraXml: string,
  bracketPlaceholder: string,
  normalizedPlaceholder: string,
): PlaceholderContext {
  // Extract visible text from all runs
  const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let tMatch;
  const texts: string[] = [];
  while ((tMatch = tPattern.exec(paraXml)) !== null) {
    texts.push(tMatch[1]);
  }
  const fullText = texts.join("").trim();

  if (fullText === bracketPlaceholder || fullText === normalizedPlaceholder) {
    return "isolated";
  }
  return "inline";
}

/**
 * Determine if an XML file is a header or footer.
 */
function getFileContext(fileName: string): "header" | "footer" | "body" {
  const lower = fileName.toLowerCase();
  if (lower.includes("header")) return "header";
  if (lower.includes("footer")) return "footer";
  return "body";
}

// ── DOCX Image Injection ────────────────────────────────────

// EMU constants: 1 inch = 914400 EMU, 1 cm = 360000 EMU
const MAX_WIDTH_EMU = 5_400_000; // ~15cm — fits A4 with margins
const MAX_HEIGHT_EMU = 7_200_000; // ~20cm — reasonable max height
const TABLE_MAX_WIDTH_EMU = 4_800_000; // ~13.3cm — leave margin in table cells

function buildInlineDrawingXml(
  rId: string,
  widthEmu: number,
  heightEmu: number,
  imageId: number,
  name: string,
): string {
  return (
    `<w:r>` +
    `<w:rPr/>` +
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${widthEmu}" cy="${heightEmu}"/>` +
    `<wp:docPr id="${imageId}" name="${name}"/>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">` +
    `<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:nvPicPr>` +
    `<pic:cNvPr id="0" name="${name}.png"/>` +
    `<pic:cNvPicPr/>` +
    `</pic:nvPicPr>` +
    `<pic:blipFill>` +
    `<a:blip r:embed="${rId}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/>` +
    `<a:stretch><a:fillRect/></a:stretch>` +
    `</pic:blipFill>` +
    `<pic:spPr>` +
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>` +
    `</pic:spPr>` +
    `</pic:pic>` +
    `</a:graphicData>` +
    `</a:graphic>` +
    `</wp:inline>` +
    `</w:drawing>` +
    `</w:r>`
  );
}

function addRelationship(relsXml: string, rId: string, target: string): string {
  const relTag =
    `<Relationship Id="${rId}" ` +
    `Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" ` +
    `Target="${target}"/>`;
  return relsXml.replace("</Relationships>", `${relTag}</Relationships>`);
}

function addContentType(contentTypesXml: string): string {
  if (contentTypesXml.includes('Extension="png"')) return contentTypesXml;
  const pngType = `<Default Extension="png" ContentType="image/png"/>`;
  return contentTypesXml.replace(/<Types[^>]*>/, (match) => `${match}${pngType}`);
}

function getNextRid(relsXml: string): number {
  const pattern = /Id="rId(\d+)"/g;
  let max = 0;
  let m;
  while ((m = pattern.exec(relsXml)) !== null) {
    const n = parseInt(m[1], 10);
    if (n > max) max = n;
  }
  return max + 1;
}

/**
 * Calculate EMU dimensions preserving aspect ratio and respecting max bounds.
 */
function calculateEmuDimensions(
  widthPx: number,
  heightPx: number,
  isTable: boolean,
): { widthEmu: number; heightEmu: number } {
  const maxW = isTable ? TABLE_MAX_WIDTH_EMU : MAX_WIDTH_EMU;
  const aspectRatio = heightPx / widthPx;
  let widthEmu = maxW;
  let heightEmu = Math.round(widthEmu * aspectRatio);

  // Clamp height
  if (heightEmu > MAX_HEIGHT_EMU) {
    heightEmu = MAX_HEIGHT_EMU;
    widthEmu = Math.round(heightEmu / aspectRatio);
  }

  return { widthEmu, heightEmu };
}

/**
 * Check if a paragraph is inside a table cell (<w:tc>).
 * We do a rough check by looking at the broader XML context.
 */
function isParagraphInTable(xmlContent: string, paraStartIndex: number): boolean {
  // Look backwards from the paragraph start for the nearest <w:tc> or </w:tc>
  const before = xmlContent.substring(Math.max(0, paraStartIndex - 500), paraStartIndex);
  const lastTcOpen = before.lastIndexOf("<w:tc");
  const lastTcClose = before.lastIndexOf("</w:tc>");
  return lastTcOpen > lastTcClose;
}

// ── Main Entry Point ────────────────────────────────────────

export async function injectChartsIntoDocx(opts: {
  docxBytes: Uint8Array;
  snapshot: Record<string, unknown> | null;
  tenantId: string;
  adminClient: SupabaseClient;
  authHeader: string;
  supabaseUrl: string;
  proposalId?: string;
}): Promise<ChartInjectionResult> {
  const { docxBytes, snapshot, tenantId, adminClient, authHeader, supabaseUrl, proposalId } = opts;

  const chartsDetected: string[] = [];
  const chartsRendered: string[] = [];
  const chartsFailed: string[] = [];
  const chartsSkipped: string[] = [];
  const reasons: Record<string, string> = {};

  const logCtx = proposalId ? `proposal=${proposalId} tenant=${tenantId}` : `tenant=${tenantId}`;

  if (!snapshot) {
    console.log(`${LOG_PREFIX} [${logCtx}] No snapshot — skipping chart injection`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped, reasons };
  }

  // ── 1. Load DOCX ZIP ──────────────────────────────────────
  const zip = await JSZip.loadAsync(docxBytes);

  // ── 2. Read XML files to detect placeholders ──────────────
  const xmlFiles: string[] = [];
  zip.forEach((path) => {
    if (
      path.startsWith("word/") &&
      path.endsWith(".xml") &&
      !path.includes("/_rels/") &&
      !path.startsWith("word/media/") &&
      !path.startsWith("word/theme/") &&
      !path.startsWith("word/charts/") &&
      !path.startsWith("word/drawings/") &&
      !path.startsWith("word/glossary/") &&
      !path.startsWith("word/embeddings/")
    ) {
      xmlFiles.push(path);
    }
  });

  // Collect all placeholders across all XML files
  const allPlaceholders = new Set<string>();
  const xmlContents = new Map<string, string>();

  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;
    const content = await file.async("string");
    xmlContents.set(fileName, content);
    for (const ph of detectChartPlaceholders(content)) {
      allPlaceholders.add(ph);
    }
  }

  if (allPlaceholders.size === 0) {
    console.log(`${LOG_PREFIX} [${logCtx}] No bracket placeholders found — skipping`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped, reasons };
  }

  // ── 3. Fetch active charts for this tenant ────────────────
  const { data: activeCharts, error: chartsErr } = await adminClient
    .from("proposal_charts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (chartsErr || !activeCharts || activeCharts.length === 0) {
    console.log(`${LOG_PREFIX} [${logCtx}] No active charts in catalog — skipping`);
    return { output: docxBytes, chartsDetected: Array.from(allPlaceholders), chartsRendered, chartsFailed, chartsSkipped: Array.from(allPlaceholders), reasons };
  }

  // Build lookup: normalized placeholder → chart config
  const chartLookup = new Map<string, ChartConfig>();
  for (const chart of activeCharts) {
    const normalizedPh = normalizeChartPlaceholder(chart.placeholder);
    chartLookup.set(normalizedPh, chart as ChartConfig);
  }

  // ── 4. Filter placeholders to only chart-matching ones ────
  // Only placeholders that exist in the catalog are treated as chart placeholders.
  // All others are regular variables — do NOT log them as skipped.
  const matchedCharts: Array<{ placeholder: string; chart: ChartConfig }> = [];

  for (const ph of allPlaceholders) {
    const normalized = normalizeChartPlaceholder(ph);
    const chart = chartLookup.get(normalized);
    if (!chart) continue; // Not a chart placeholder — ignore silently

    chartsDetected.push(ph);

    if (chart.engine !== "rendered_image") {
      const reason = `engine "${chart.engine}" not supported in this phase (only rendered_image)`;
      console.log(`${LOG_PREFIX} [${logCtx}] [${ph}] → chart "${chart.id}" — ${reason}`);
      chartsSkipped.push(ph);
      reasons[ph] = reason;
      continue;
    }

    matchedCharts.push({ placeholder: ph, chart });
    console.log(`${LOG_PREFIX} [${logCtx}] Matched [${ph}] → "${chart.title}" (${chart.chart_type}, source: ${chart.data_source})`);
  }

  if (matchedCharts.length === 0) {
    console.log(`${LOG_PREFIX} [${logCtx}] No chart placeholders matched catalog — skipping`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped, reasons };
  }

  // ── 5. Resolve datasets + render PNGs ─────────────────────
  const renderedCharts: RenderedChart[] = [];

  for (const { placeholder, chart } of matchedCharts) {
    try {
      // Resolve data from snapshot
      const rawData = resolveDataFromSnapshot(snapshot, chart.data_source);
      if (!rawData || rawData.length === 0) {
        const reason = `data_source "${chart.data_source}" empty or missing in snapshot`;
        console.warn(`${LOG_PREFIX} [${logCtx}] [${placeholder}] ${reason}`);
        chartsSkipped.push(placeholder);
        reasons[placeholder] = reason;
        continue;
      }

      const dataset = buildChartDataset(chart, rawData);
      console.log(`${LOG_PREFIX} [${logCtx}] [${placeholder}] dataset: ${dataset.labels.length} points, chart_id=${chart.id}`);

      // Call proposal-chart-render edge function
      const renderPayload = {
        chart_config: {
          chart_type: chart.chart_type,
          title: chart.title,
          subtitle: chart.subtitle,
          width: chart.width || 1600,
          height: chart.height || 900,
          colors: chart.colors,
          show_legend: chart.show_legend,
          show_grid: chart.show_grid,
          show_labels: chart.show_labels,
        },
        dataset,
      };

      const renderUrl = `${supabaseUrl}/functions/v1/proposal-chart-render`;
      const renderResp = await fetch(renderUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: authHeader,
        },
        body: JSON.stringify(renderPayload),
      });

      if (!renderResp.ok) {
        const errText = await renderResp.text();
        const reason = `render HTTP ${renderResp.status}: ${errText.substring(0, 200)}`;
        console.error(`${LOG_PREFIX} [${logCtx}] [${placeholder}] ${reason}`);
        chartsFailed.push(placeholder);
        reasons[placeholder] = reason;
        continue;
      }

      const renderResult = await renderResp.json();
      if (!renderResult.success || !renderResult.image_base64) {
        const reason = `render error: ${renderResult.error || "no image_base64"}`;
        console.error(`${LOG_PREFIX} [${logCtx}] [${placeholder}] ${reason}`);
        chartsFailed.push(placeholder);
        reasons[placeholder] = reason;
        continue;
      }

      // Decode base64 to bytes
      const binaryStr = atob(renderResult.image_base64);
      const imageBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        imageBytes[i] = binaryStr.charCodeAt(i);
      }

      renderedCharts.push({
        placeholder,
        chartId: chart.id,
        imageBytes,
        widthPx: chart.width || 1600,
        heightPx: chart.height || 900,
      });

      chartsRendered.push(placeholder);
      console.log(`${LOG_PREFIX} [${logCtx}] [${placeholder}] rendered OK — ${(imageBytes.length / 1024).toFixed(1)} KB`);
    } catch (err: any) {
      const reason = `exception: ${err.message}`;
      console.error(`${LOG_PREFIX} [${logCtx}] [${placeholder}] ${reason}`);
      chartsFailed.push(placeholder);
      reasons[placeholder] = reason;
    }
  }

  if (renderedCharts.length === 0) {
    console.log(`${LOG_PREFIX} [${logCtx}] No charts rendered — returning original DOCX`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped, reasons };
  }

  // ── 6. Inject images into DOCX ────────────────────────────

  // Read rels file
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile ? await relsFile.async("string") : "";
  if (!relsXml) {
    console.error(`${LOG_PREFIX} [${logCtx}] Cannot find ${relsPath} — cannot inject images`);
    return { output: docxBytes, chartsDetected, chartsRendered: [], chartsFailed: [...chartsRendered], chartsSkipped, reasons };
  }

  // Update [Content_Types].xml
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ctXml = await ctFile.async("string");
    ctXml = addContentType(ctXml);
    zip.file("[Content_Types].xml", ctXml);
  }

  let nextRid = getNextRid(relsXml);
  let imageIdCounter = 100;

  // Track which charts were actually injected vs skipped at injection phase
  const injectedPlaceholders = new Set<string>();

  for (const chart of renderedCharts) {
    const rId = `rId${nextRid++}`;
    const normalizedPh = normalizeChartPlaceholder(chart.placeholder);
    const mediaFileName = `chart_${normalizedPh}.png`;
    const mediaPath = `media/${mediaFileName}`;
    const fullMediaPath = `word/${mediaPath}`;

    // Add image to zip
    zip.file(fullMediaPath, chart.imageBytes);

    // Add relationship
    relsXml = addRelationship(relsXml, rId, mediaPath);

    // Track injection success for this chart
    let chartInjected = false;

    // Reconstruct bracket form for searching
    const bracketPlaceholder = `[${chart.placeholder}]`;
    // Also check for the normalized lowercase form with brackets
    const bracketNormalized = `[${normalizedPh}]`;

    for (const [fileName, content] of xmlContents) {
      // Check if file contains the placeholder (case-insensitive check)
      const contentLower = content.toLowerCase();
      const hasBracket = content.includes(bracketPlaceholder) || contentLower.includes(bracketNormalized);
      if (!hasBracket) continue;

      const fileCtx = getFileContext(fileName);

      // ── Header/Footer blocking ──
      if (fileCtx === "header" || fileCtx === "footer") {
        const reason = `placeholder in ${fileCtx} — not supported in this phase (risk of layout corruption)`;
        console.warn(`${LOG_PREFIX} [${logCtx}] [${chart.placeholder}] in ${fileName}: ${reason}`);
        if (!reasons[chart.placeholder]) {
          reasons[chart.placeholder] = reason;
        }
        // Don't inject into headers/footers in this phase
        continue;
      }

      // Calculate EMU dimensions once per chart per file
      // (table detection is per-paragraph)
      const imageId = imageIdCounter++;

      let newContent = content;
      const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;
      let paraMatch;
      const replacements: Array<{ original: string; replacement: string }> = [];

      while ((paraMatch = paraPattern.exec(content)) !== null) {
        const paraXml = paraMatch[0];
        const paraIndex = paraMatch.index;

        // Check if this paragraph contains the placeholder
        if (!paraXml.includes(bracketPlaceholder) && !paraXml.toLowerCase().includes(bracketNormalized)) {
          continue;
        }

        const context = detectParagraphContext(paraXml, bracketPlaceholder, chart.placeholder);
        const inTable = isParagraphInTable(content, paraIndex);
        const { widthEmu, heightEmu } = calculateEmuDimensions(chart.widthPx, chart.heightPx, inTable);
        const drawingXml = buildInlineDrawingXml(rId, widthEmu, heightEmu, imageId, `chart_${normalizedPh}`);

        if (context === "isolated") {
          // ✅ CANONICAL PATH: placeholder alone in paragraph → replace entire paragraph
          const pPrMatch = paraXml.match(/<w:pPr>[^]*?<\/w:pPr>/);
          const pPr = pPrMatch ? pPrMatch[0] : "";
          const newPara = `<w:p>${pPr}${drawingXml}</w:p>`;

          replacements.push({ original: paraXml, replacement: newPara });
          chartInjected = true;

          const locationLabel = inTable ? "table cell" : "body";
          console.log(`${LOG_PREFIX} [${logCtx}] ✅ Injected [${chart.placeholder}] in ${fileName} (${locationLabel}, isolated paragraph)`);
        } else {
          // ⚠️ INLINE: placeholder mixed with text — skip injection for safety
          const reason = `placeholder mixed with text in paragraph — skipped for safety (place placeholder alone in its own paragraph)`;
          console.warn(`${LOG_PREFIX} [${logCtx}] ⚠️ [${chart.placeholder}] in ${fileName}: ${reason}`);
          if (!reasons[chart.placeholder]) {
            reasons[chart.placeholder] = reason;
          }
          // Do NOT inject inline — risk of XML corruption
        }
      }

      // Apply all replacements for this file
      for (const { original, replacement } of replacements) {
        newContent = newContent.replace(original, replacement);
      }

      if (newContent !== content) {
        xmlContents.set(fileName, newContent);
        zip.file(fileName, newContent);
      }
    }

    if (chartInjected) {
      injectedPlaceholders.add(chart.placeholder);
    } else if (!reasons[chart.placeholder]) {
      // Rendered but not injected (placeholder not found in safe context)
      reasons[chart.placeholder] = "rendered but placeholder not found in an injectable context";
    }
  }

  // Reconcile: charts that were "rendered" but not actually injected should move to "failed"
  const finalRendered: string[] = [];
  const finalFailed = [...chartsFailed];
  for (const ph of chartsRendered) {
    if (injectedPlaceholders.has(ph)) {
      finalRendered.push(ph);
    } else {
      finalFailed.push(ph);
      if (!reasons[ph]) reasons[ph] = "rendered but injection failed";
    }
  }

  // Save updated rels
  zip.file(relsPath, relsXml);

  // ── 7. Generate output ────────────────────────────────────
  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  console.log(`${LOG_PREFIX} [${logCtx}] Injection complete: ${finalRendered.length} rendered, ${finalFailed.length} failed, ${chartsSkipped.length} skipped`);
  if (Object.keys(reasons).length > 0) {
    console.log(`${LOG_PREFIX} [${logCtx}] Reasons:`, JSON.stringify(reasons));
  }

  return {
    output,
    chartsDetected,
    chartsRendered: finalRendered,
    chartsFailed: finalFailed,
    chartsSkipped,
    reasons,
  };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
