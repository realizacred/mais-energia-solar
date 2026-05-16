import { type ProjectDocument } from "@/hooks/useProjectDocuments";

/**
 * Utilitário compartilhado de normalização/dedup semântico de documentos.
 * Garante paridade entre contador da aba e cards exibidos.
 */

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Limpa nomes técnicos de arquivos para facilitar dedup por nome base quando path falha.
 */
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

/**
 * Returns a suffix for deduplication visualization (e.g. "(2)")
 * This is now managed by the normalization logic but we keep the helper for UI labels.
 */
export function logicalSuffix(count: number): string {
  if (count <= 1) return "";
  return ` (${count})`;
}

/**
 * Heuristic count of logical documents based on categories.
 */
export function countLogicalDocs(docs: ProjectDocument[]): number {
  const norm = normalizeProjectDocuments(docs);
  return norm.totalUnique;
}


/**
 * Resolve a categoria canônica baseada na prioridade definida.
 */
export function resolveDocumentCategory(doc: ProjectDocument): string {
  if (doc.categoria && !["Outros", "Manual", "Anexos manuais"].includes(doc.categoria)) {
    return doc.categoria;
  }
  if (doc.metadata?.field_title) {
    return doc.metadata.field_title;
  }
  const lowerName = (doc.file_name || "").toLowerCase();
  if (lowerName.includes("identidade") || lowerName.includes("rg") || lowerName.includes("cnh")) return "Identidade";
  if (lowerName.includes("comprovante") || lowerName.includes("endereco")) return "Comprovante de endereço";
  if (lowerName.includes("iptu")) return "IPTU";
  if (lowerName.includes("conta_luz")) return "Conta de luz";
  return "Outros";
}

/**
 * Consolida múltiplos registros que apontam para o mesmo arquivo lógico.
 */
export function normalizeProjectDocuments(rawDocs: ProjectDocument[]): {
  documents: ProjectDocument[];
  totalUnique: number;
  totalSize: number;
  groupedByCategory: Record<string, ProjectDocument[]>;
} {
  const byStorageKey = new Map<string, ProjectDocument>();
  const byChecksum = new Map<string, ProjectDocument>();
  const byHeuristic = new Map<string, ProjectDocument>();

  const uniqueDocs: ProjectDocument[] = [];

  for (const doc of rawDocs) {
    const storageKey = `${doc.bucket}::${doc.storage_path}`;
    const heuristicKey = doc.file_name;

    let existing = byStorageKey.get(storageKey) || 
                   (doc.checksum ? byChecksum.get(doc.checksum) : undefined) ||
                   byHeuristic.get(heuristicKey);

    if (existing) {
      existing.metadata = {
        ...(existing.metadata || {}),
        ...(doc.metadata || {}),
        _merged_from: [
          ...((existing.metadata as any)?._merged_from || []),
          { id: doc.id, origem: doc.origem, storage_path: doc.storage_path }
        ]
      };
      if (new Date(doc.created_at) < new Date(existing.created_at)) {
        existing.created_at = doc.created_at;
      }
      continue;
    }

    const newDoc = { ...doc };
    byStorageKey.set(storageKey, newDoc);
    if (doc.checksum) byChecksum.set(doc.checksum, newDoc);
    byHeuristic.set(heuristicKey, newDoc);
    uniqueDocs.push(newDoc);
  }

  const grouped: Record<string, ProjectDocument[]> = {};
  let totalSize = 0;
  for (const doc of uniqueDocs) {
    const cat = resolveDocumentCategory(doc);
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(doc);
    totalSize += doc.size_bytes || 0;
  }

  return {
    documents: uniqueDocs,
    totalUnique: uniqueDocs.length,
    totalSize,
    groupedByCategory: grouped
  };
}
