/**
 * chartInjector.ts — Detects chart placeholders in DOCX, resolves configs,
 * renders PNGs via proposal-chart-render, and injects images into the DOCX.
 *
 * Usage: import { injectChartsIntoDocx } from "../_shared/chartInjector.ts";
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

interface ChartInjectionResult {
  output: Uint8Array;
  chartsDetected: string[];
  chartsRendered: string[];
  chartsFailed: string[];
  chartsSkipped: string[];
}

type SupabaseClient = {
  from: (table: string) => any;
  functions: { invoke: (name: string, opts: any) => Promise<any> };
};

// ── Placeholder Normalization ───────────────────────────────

export function normalizeChartPlaceholder(input: string): string {
  if (!input) return "";
  return input.trim().replace(/^\[|\]$/g, "").replace(/\s+/g, "_");
}

// ── Placeholder Detection ───────────────────────────────────

/**
 * Known chart placeholder prefixes. We detect any [xxx] placeholder
 * and then match against the proposal_charts catalog.
 */
export function detectChartPlaceholders(xmlContent: string): string[] {
  const placeholders = new Set<string>();
  // Match [word_chars] patterns — we'll filter against DB later
  const regex = /\[([a-zA-Z_][a-zA-Z0-9_.\-]{2,120})\]/g;
  let match;
  while ((match = regex.exec(xmlContent)) !== null) {
    placeholders.add(match[1]); // without brackets
  }
  return Array.from(placeholders);
}

// ── Data Resolution ─────────────────────────────────────────

function resolveDataFromSnapshot(
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

function buildChartDataset(
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

// ── DOCX Image Injection ────────────────────────────────────

// EMU constants: 1 inch = 914400 EMU, 1 cm = 360000 EMU
const MAX_WIDTH_EMU = 5_400_000; // ~15cm — fits A4 with margins

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

  // Insert before closing </Relationships>
  return relsXml.replace("</Relationships>", `${relTag}</Relationships>`);
}

function addContentType(contentTypesXml: string): string {
  // Only add if not already present
  if (contentTypesXml.includes('Extension="png"')) return contentTypesXml;
  const pngType = `<Default Extension="png" ContentType="image/png"/>`;
  return contentTypesXml.replace("<Types", `<Types`) // keep as-is
    .replace(">", `>${pngType}`); // add after first >
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

  if (!snapshot) {
    console.log(`${LOG_PREFIX} No snapshot — skipping chart injection`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped };
  }

  // ── 1. Load DOCX ZIP ──────────────────────────────────────
  const zip = await JSZip.loadAsync(docxBytes);

  // ── 2. Read document.xml + headers/footers to detect placeholders
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
    console.log(`${LOG_PREFIX} No placeholders found — skipping`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped };
  }

  // ── 3. Fetch active charts for this tenant ────────────────
  const { data: activeCharts, error: chartsErr } = await adminClient
    .from("proposal_charts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true);

  if (chartsErr || !activeCharts || activeCharts.length === 0) {
    console.log(`${LOG_PREFIX} No active charts in catalog — skipping`);
    return { output: docxBytes, chartsDetected: Array.from(allPlaceholders), chartsRendered, chartsFailed, chartsSkipped: Array.from(allPlaceholders) };
  }

  // Build lookup: normalized placeholder → chart config
  const chartLookup = new Map<string, ChartConfig>();
  for (const chart of activeCharts) {
    const normalizedPh = normalizeChartPlaceholder(chart.placeholder);
    chartLookup.set(normalizedPh, chart as ChartConfig);
  }

  // ── 4. Match placeholders to chart configs ────────────────
  const matchedCharts: Array<{ placeholder: string; chart: ChartConfig }> = [];

  for (const ph of allPlaceholders) {
    const normalized = normalizeChartPlaceholder(ph);
    const chart = chartLookup.get(normalized);
    if (chart) {
      if (chart.engine !== "rendered_image") {
        console.log(`${LOG_PREFIX} Placeholder [${ph}] → chart "${chart.id}" uses engine "${chart.engine}" — skipping (only rendered_image supported)`);
        chartsSkipped.push(ph);
        continue;
      }
      chartsDetected.push(ph);
      matchedCharts.push({ placeholder: ph, chart });
      console.log(`${LOG_PREFIX} Matched [${ph}] → chart "${chart.title}" (${chart.chart_type}, source: ${chart.data_source})`);
    }
    // Not a chart placeholder — could be a regular variable. Don't log as skipped.
  }

  if (matchedCharts.length === 0) {
    console.log(`${LOG_PREFIX} No chart placeholders matched catalog — skipping injection`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped };
  }

  // ── 5. Resolve datasets + render PNGs ─────────────────────
  const renderedCharts: RenderedChart[] = [];

  for (const { placeholder, chart } of matchedCharts) {
    try {
      // Resolve data from snapshot
      const rawData = resolveDataFromSnapshot(snapshot, chart.data_source);
      if (!rawData || rawData.length === 0) {
        console.warn(`${LOG_PREFIX} [${placeholder}] data_source "${chart.data_source}" → empty/null in snapshot — skipping`);
        chartsSkipped.push(placeholder);
        continue;
      }

      const dataset = buildChartDataset(chart, rawData);
      console.log(`${LOG_PREFIX} [${placeholder}] dataset: ${dataset.labels.length} points`);

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
        console.error(`${LOG_PREFIX} [${placeholder}] render failed (${renderResp.status}): ${errText}`);
        chartsFailed.push(placeholder);
        continue;
      }

      const renderResult = await renderResp.json();
      if (!renderResult.success || !renderResult.image_base64) {
        console.error(`${LOG_PREFIX} [${placeholder}] render returned error: ${renderResult.error}`);
        chartsFailed.push(placeholder);
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
      console.log(`${LOG_PREFIX} [${placeholder}] rendered OK — ${(imageBytes.length / 1024).toFixed(1)} KB`);
    } catch (err: any) {
      console.error(`${LOG_PREFIX} [${placeholder}] error: ${err.message}`);
      chartsFailed.push(placeholder);
    }
  }

  if (renderedCharts.length === 0) {
    console.log(`${LOG_PREFIX} No charts rendered — returning original DOCX`);
    return { output: docxBytes, chartsDetected, chartsRendered, chartsFailed, chartsSkipped };
  }

  // ── 6. Inject images into DOCX ────────────────────────────

  // Read rels file
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile ? await relsFile.async("string") : "";
  if (!relsXml) {
    console.error(`${LOG_PREFIX} Cannot find ${relsPath} — cannot inject images`);
    return { output: docxBytes, chartsDetected, chartsRendered: [], chartsFailed: chartsRendered, chartsSkipped };
  }

  // Update [Content_Types].xml
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ctXml = await ctFile.async("string");
    ctXml = addContentType(ctXml);
    zip.file("[Content_Types].xml", ctXml);
  }

  let nextRid = getNextRid(relsXml);
  let imageIdCounter = 100; // Start high to avoid conflicts

  for (const chart of renderedCharts) {
    const rId = `rId${nextRid++}`;
    const mediaFileName = `chart_${normalizeChartPlaceholder(chart.placeholder)}.png`;
    const mediaPath = `media/${mediaFileName}`;
    const fullMediaPath = `word/${mediaPath}`;

    // Add image to zip
    zip.file(fullMediaPath, chart.imageBytes);

    // Add relationship
    relsXml = addRelationship(relsXml, rId, mediaPath);

    // Calculate EMU dimensions (fit to page width)
    const aspectRatio = chart.heightPx / chart.widthPx;
    const widthEmu = MAX_WIDTH_EMU;
    const heightEmu = Math.round(widthEmu * aspectRatio);

    const imageId = imageIdCounter++;
    const drawingXml = buildInlineDrawingXml(rId, widthEmu, heightEmu, imageId, `chart_${chart.placeholder}`);

    // Replace placeholder in all XML files
    const bracketPlaceholder = `[${chart.placeholder}]`;

    for (const [fileName, content] of xmlContents) {
      if (!content.includes(bracketPlaceholder)) continue;

      // Strategy: find the <w:p> containing the placeholder and replace the
      // entire paragraph's text runs with the drawing.
      // We look for paragraphs where the visible text matches the placeholder.
      let newContent = content;
      const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;
      newContent = newContent.replace(paraPattern, (paraXml) => {
        // Extract visible text from all runs
        const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
        let tMatch;
        const texts: string[] = [];
        while ((tMatch = tPattern.exec(paraXml)) !== null) {
          texts.push(tMatch[1]);
        }
        const fullText = texts.join("").trim();

        // Check if this paragraph contains ONLY the chart placeholder
        // (possibly with surrounding whitespace)
        if (fullText === bracketPlaceholder || fullText === chart.placeholder) {
          // Extract paragraph properties (pPr) to preserve formatting/alignment
          const pPrMatch = paraXml.match(/<w:pPr>[^]*?<\/w:pPr>/);
          const pPr = pPrMatch ? pPrMatch[0] : "";

          // Replace entire paragraph with one containing the image
          const newPara = `<w:p>${pPr}${drawingXml}</w:p>`;
          console.log(`${LOG_PREFIX} Injected chart image for [${chart.placeholder}] in ${fileName}`);
          return newPara;
        }

        // If the placeholder is part of a larger text, replace just the text
        // (less ideal but still works — image will be inline with text)
        if (fullText.includes(bracketPlaceholder)) {
          // Replace text runs containing the placeholder
          const replaced = paraXml.replace(
            new RegExp(escapeRegex(bracketPlaceholder), "g"),
            "",
          );
          // Insert drawing run before closing </w:p>
          const withDrawing = replaced.replace("</w:p>", `${drawingXml}</w:p>`);
          console.log(`${LOG_PREFIX} Injected chart image (inline) for [${chart.placeholder}] in ${fileName}`);
          return withDrawing;
        }

        return paraXml;
      });

      if (newContent !== content) {
        xmlContents.set(fileName, newContent);
        zip.file(fileName, newContent);
      }
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

  console.log(`${LOG_PREFIX} Injection complete: ${chartsRendered.length} rendered, ${chartsFailed.length} failed, ${chartsSkipped.length} skipped`);

  return { output, chartsDetected, chartsRendered, chartsFailed, chartsSkipped };
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
