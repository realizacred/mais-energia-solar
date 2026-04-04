import { strFromU8, strToU8, unzipSync, zipSync } from "npm:fflate@0.8.2";

export function normalizeVariableFormat(text: string): string {
  let normalized = text.replace(/\[\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\]/g, "{{$1}}");
  normalized = normalized.replace(/\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g, "{{$1}}");
  return normalized;
}

export function normalizeDocxVariableFormat(docxBytes: Uint8Array): Uint8Array {
  const unzipped = unzipSync(docxBytes);
  const processed: Record<string, Uint8Array> = {};

  for (const [path, data] of Object.entries(unzipped)) {
    if (path.startsWith("word/") && path.endsWith(".xml")) {
      processed[path] = strToU8(normalizeVariableFormat(strFromU8(data)));
    } else {
      processed[path] = data;
    }
  }

  return zipSync(processed, { level: 6 });
}