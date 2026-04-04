import { strFromU8, strToU8, unzipSync, zipSync } from "npm:fflate@0.8.2";

/**
 * Defragment XML runs inside DOCX paragraphs.
 * Word often splits text like [ cliente_nome ] across multiple <w:r> elements,
 * making regex-based variable detection impossible.
 * This function merges adjacent <w:t> text nodes within the same paragraph
 * by stripping intermediate </w:r><w:r> boundaries (preserving formatting of first run).
 */
export function defragmentXml(xml: string): string {
  // Step 1: Remove truly empty runs (runs with rPr but no w:t content)
  xml = xml.replace(
    /<w:r\b[^>]*>\s*<w:rPr>[\s\S]*?<\/w:rPr>\s*<\/w:r>/g,
    ""
  );

  // Step 2: Merge consecutive w:t text content within the same paragraph.
  // Strategy: For each paragraph, extract all text from w:t elements,
  // concatenate them, then put back in a single run.
  // This is done by collapsing </w:t></w:r><w:r><w:t> sequences.
  // We handle optional xml:space="preserve" and rPr blocks.
  xml = xml.replace(
    /<\/w:t>\s*<\/w:r>\s*<w:r(?:\s[^>]*)?>(?:\s*<w:rPr>[\s\S]*?<\/w:rPr>)?\s*<w:t(?:\s[^>]*)?>/g,
    ""
  );

  return xml;
}

export function normalizeVariableFormat(text: string): string {
  // Handle [ variable ] with optional spaces and optional XML fragments inside brackets
  let normalized = text.replace(
    /\[\s*(?:<[^>]*>\s*)*([a-zA-Z_][a-zA-Z0-9_.]*)\s*(?:<[^>]*>\s*)*\]/g,
    "{{$1}}"
  );
  // Fallback: simple [ variable ] without XML
  normalized = normalized.replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_.]*)\s*\]/g, "{{$1}}");
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