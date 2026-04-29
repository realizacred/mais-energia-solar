/**
 * qrInjector.ts — Generates QR Code PNG on demand and injects it
 * into a DOCX wherever the {qr_code} / {{qr_code}} / [qr_code] placeholder
 * appears in an isolated paragraph.
 *
 * Usage:
 *   import { injectQrCodeIntoDocx } from "../_shared/qrInjector.ts";
 *   const { output, injected, reason } = await injectQrCodeIntoDocx({
 *     docxBytes,
 *     publicUrl,        // URL the QR will point to
 *     tenantId,
 *     proposalId,
 *   });
 *
 * Behaviour:
 *  - If the template has no qr_code placeholder → returns docxBytes unchanged.
 *  - If publicUrl is empty → skips with reason="no public_url".
 *  - Generates QR PNG (300x300) via the `qrcode` npm lib (Deno-compatible).
 *  - Injects only in **isolated** paragraphs (placeholder alone), to avoid
 *    XML corruption — same safety rule as chartInjector.
 */

import JSZip from "npm:jszip@3.10.1";
import QRCode from "npm:qrcode@1.5.4";

const LOG_PREFIX = "[qrInjector]";

// QR placeholder accepted forms (case-insensitive)
// {qr_code}, {{qr_code}}, [qr_code]
const QR_TOKENS = ["{qr_code}", "{{qr_code}}", "[qr_code]"];

interface InjectResult {
  output: Uint8Array;
  injected: boolean;
  reason?: string;
}

// ── EMU constants (mirror chartInjector defaults) ─────────────
const QR_SIZE_EMU = 1_800_000; // ~5cm — good for both screen and print

// ── Helpers reused (kept local to avoid coupling) ─────────────

function buildInlineDrawingXml(
  rId: string,
  sizeEmu: number,
  imageId: number,
  name: string,
): string {
  return (
    `<w:r>` +
    `<w:rPr/>` +
    `<w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing">` +
    `<wp:extent cx="${sizeEmu}" cy="${sizeEmu}"/>` +
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
    `<a:xfrm><a:off x="0" y="0"/><a:ext cx="${sizeEmu}" cy="${sizeEmu}"/></a:xfrm>` +
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
 * Returns the visible text of a single <w:p>, joining all <w:t> runs.
 */
function paragraphPlainText(paraXml: string): string {
  const tPattern = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
  let m;
  const out: string[] = [];
  while ((m = tPattern.exec(paraXml)) !== null) {
    out.push(m[1]);
  }
  return out.join("").trim();
}

/**
 * Detects whether any of the QR placeholder forms exist in the visible text
 * of a paragraph in **isolated** form (placeholder alone, no other text).
 */
function isIsolatedQrParagraph(paraXml: string): boolean {
  const text = paragraphPlainText(paraXml).toLowerCase();
  if (!text) return false;
  return QR_TOKENS.includes(text);
}

/**
 * Quick check: does this xml contain ANY QR token (case-insensitive)?
 */
function xmlContainsQrToken(xml: string): boolean {
  const lower = xml.toLowerCase();
  return QR_TOKENS.some((tok) => lower.includes(tok));
}

// ── Main entry point ──────────────────────────────────────────

export async function injectQrCodeIntoDocx(opts: {
  docxBytes: Uint8Array;
  publicUrl: string | null | undefined;
  tenantId: string;
  proposalId?: string;
}): Promise<InjectResult> {
  const { docxBytes, publicUrl, tenantId, proposalId } = opts;
  const logCtx = proposalId ? `proposal=${proposalId} tenant=${tenantId}` : `tenant=${tenantId}`;

  // ── 1. Load DOCX ZIP (cheap) ──────────────────────────────
  const zip = await JSZip.loadAsync(docxBytes);

  // ── 2. Scan body XML files for QR placeholder presence ────
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

  const xmlContents = new Map<string, string>();
  let anyQrSeen = false;
  for (const fileName of xmlFiles) {
    const file = zip.file(fileName);
    if (!file || file.dir) continue;
    const content = await file.async("string");
    xmlContents.set(fileName, content);
    if (xmlContainsQrToken(content)) anyQrSeen = true;
  }

  if (!anyQrSeen) {
    // Nothing to do — template doesn't use {qr_code}
    return { output: docxBytes, injected: false, reason: "no_qr_placeholder" };
  }

  if (!publicUrl) {
    console.warn(`${LOG_PREFIX} [${logCtx}] qr_code placeholder found but publicUrl is empty — skipping`);
    return { output: docxBytes, injected: false, reason: "no_public_url" };
  }

  // ── 3. Generate the QR PNG (Uint8Array) ───────────────────
  let qrBytes: Uint8Array;
  try {
    // toBuffer returns a Node Buffer; in Deno it's a Uint8Array compatible.
    const buf = await QRCode.toBuffer(publicUrl, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 600, // px — high-res so it scales cleanly when sized via EMU
      color: { dark: "#000000", light: "#FFFFFF" },
    });
    qrBytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf as ArrayBuffer);
  } catch (err: any) {
    console.error(`${LOG_PREFIX} [${logCtx}] QR generation failed: ${err?.message}`);
    return { output: docxBytes, injected: false, reason: `qr_generation_failed: ${err?.message}` };
  }

  // ── 4. Inject image into the DOCX ─────────────────────────
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  let relsXml = relsFile ? await relsFile.async("string") : "";
  if (!relsXml) {
    console.error(`${LOG_PREFIX} [${logCtx}] document.xml.rels not found — cannot inject`);
    return { output: docxBytes, injected: false, reason: "rels_missing" };
  }

  // Update [Content_Types].xml
  const ctFile = zip.file("[Content_Types].xml");
  if (ctFile) {
    let ctXml = await ctFile.async("string");
    ctXml = addContentType(ctXml);
    zip.file("[Content_Types].xml", ctXml);
  }

  const rId = `rId${getNextRid(relsXml)}`;
  const mediaPath = `media/qr_code.png`;
  zip.file(`word/${mediaPath}`, qrBytes);
  relsXml = addRelationship(relsXml, rId, mediaPath);
  zip.file(relsPath, relsXml);

  let imageId = 9001;
  let injectedCount = 0;

  for (const [fileName, content] of xmlContents) {
    if (!xmlContainsQrToken(content)) continue;

    let newContent = content;
    const paraPattern = /<w:p[\s>][^]*?<\/w:p>/g;
    let paraMatch;
    const replacements: Array<{ original: string; replacement: string }> = [];

    while ((paraMatch = paraPattern.exec(content)) !== null) {
      const paraXml = paraMatch[0];
      if (!xmlContainsQrToken(paraXml)) continue;

      if (!isIsolatedQrParagraph(paraXml)) {
        // Mixed with text — skip for safety (same rule as chartInjector)
        console.warn(
          `${LOG_PREFIX} [${logCtx}] qr_code placeholder mixed with other text in ${fileName} — skipped (place {qr_code} alone in its own line)`,
        );
        continue;
      }

      const pPrMatch = paraXml.match(/<w:pPr>[^]*?<\/w:pPr>/);
      const pPr = pPrMatch ? pPrMatch[0] : "";
      const drawing = buildInlineDrawingXml(rId, QR_SIZE_EMU, imageId++, "qr_code");
      const newPara = `<w:p>${pPr}${drawing}</w:p>`;

      replacements.push({ original: paraXml, replacement: newPara });
      injectedCount++;
    }

    for (const { original, replacement } of replacements) {
      newContent = newContent.replace(original, replacement);
    }
    if (newContent !== content) {
      zip.file(fileName, newContent);
    }
  }

  if (injectedCount === 0) {
    return { output: docxBytes, injected: false, reason: "qr_placeholder_inline_only" };
  }

  console.log(`${LOG_PREFIX} [${logCtx}] QR injected ${injectedCount}x → ${publicUrl}`);

  const output = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { output, injected: true };
}
