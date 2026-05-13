/**
 * Utilitário compartilhado de normalização/dedup semântico de documentos.
 * Usado por ProjectDocumentsHub (renderização) e useProjetoDetalheData (badge),
 * garantindo paridade exata entre contador da aba e cards exibidos.
 */

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export function normalizeFilename(name?: string | null): string {
  if (!name) return "";
  let n = safeDecode(name).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  n = n.replace(
    /^\d{4}-\d{2}-\d{2}[_\s-]\d{2}[-:_]\d{2}[-:_]\d{2}[\s_-]*[a-z0-9]{0,12}[\s_-]*/i,
    "",
  );
  n = n.replace(/^\d{10,}[_\s-](?:\d+[_\s-])?/, "");
  n = n.replace(/^\d+[_\s-]\d+[_\s-]/, "");
  n = n.replace(/[\s_-]+/g, "_").replace(/[^\w.]/g, "");
  n = n.replace(/^_+/, "");
  return n;
}

export function logicalSuffix(name: string): string {
  const n = normalizeFilename(name).replace(/\.[a-z0-9]+$/, "");
  const tokens = n.split(/[._]+/).filter(Boolean);
  const KNOWN = ["frente", "verso", "comprovante", "endereco", "rg", "cnh", "cpf", "selfie"];
  const found = tokens.filter((t) => KNOWN.includes(t));
  return found.length ? found.sort().join("_") : tokens.slice(-2).join("_");
}

export interface DedupItem {
  bucket: string;
  storage_path: string;
  file_name: string;
  size_bytes: number | null;
  mime_type: string | null;
  scope: string; // deal_id || projeto_id
}

/** Conta documentos lógicos únicos aplicando a mesma regra do Hub. */
export function countLogicalDocs(items: DedupItem[]): number {
  const byPath = new Set<string>();
  const byFn = new Set<string>();
  const byLogical = new Set<string>();
  let count = 0;
  for (const it of items) {
    const pathKey = `${it.bucket}::${it.storage_path}`;
    if (byPath.has(pathKey)) continue;
    const fnKey = `${it.scope}::${normalizeFilename(it.file_name)}`;
    if (byFn.has(fnKey)) continue;
    const fnSizeKey = it.size_bytes != null ? `${fnKey}::${it.size_bytes}` : null;
    if (fnSizeKey && byFn.has(fnSizeKey)) continue;
    const logKey = `${it.scope}::${logicalSuffix(it.file_name)}::${it.mime_type || ""}`;
    if (byLogical.has(logKey)) continue;
    byPath.add(pathKey);
    byFn.add(fnKey);
    if (fnSizeKey) byFn.add(fnSizeKey);
    byLogical.add(logKey);
    count++;
  }
  return count;
}
