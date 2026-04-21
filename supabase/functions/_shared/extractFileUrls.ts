// Detector genérico de URLs de arquivo em payloads JSON arbitrários.
// Usado pela importação SolarMarket (e outras) para internalizar anexos
// no Storage canônico via `import-file-from-url`.
//
// Estratégia:
//   1) Procura recursivamente strings que sejam http(s)://...
//   2) Filtra por extensão de arquivo conhecida OU por chave sugestiva
//      (file_url, attachment_url, image_url, document_link, *_url, *_link...).
//   3) Deduplica.

const FILE_EXT_RE =
  /\.(pdf|jpe?g|png|webp|gif|bmp|tiff?|svg|heic|doc|docx|xls|xlsx|ppt|pptx|csv|txt|zip|rar|7z|dwg|dxf|kml|kmz)(\?|#|$)/i;

const SUGGESTIVE_KEYS = [
  "file_url",
  "attachment_url",
  "image_url",
  "document_link",
  "anexo",
  "anexo_url",
  "arquivo",
  "arquivo_url",
  "comprovante",
  "comprovante_url",
  "identidade",
  "identidade_url",
  "fatura",
  "fatura_url",
  "logo",
  "logo_url",
  "foto",
  "photo",
  "url",
  "link",
];

function isLikelyFileKey(key: string): boolean {
  const k = key.toLowerCase();
  if (SUGGESTIVE_KEYS.includes(k)) return true;
  return /(_url|_link|_file|_attachment|_image|_photo|_doc|_docx|_pdf)$/i.test(k);
}

function isHttpUrl(value: string): boolean {
  if (typeof value !== "string") return false;
  if (value.length < 10 || value.length > 2048) return false;
  return /^https?:\/\//i.test(value);
}

export interface ExtractedFileUrl {
  url: string;
  /** Chave do payload onde a URL foi encontrada (último segmento). */
  key: string;
  /** Caminho completo (ex: "cliente.documents.0.file_url") para auditoria. */
  path: string;
}

export function extractFileUrls(payload: unknown): ExtractedFileUrl[] {
  const found = new Map<string, ExtractedFileUrl>();

  function visit(node: unknown, key: string, path: string) {
    if (node == null) return;
    if (typeof node === "string") {
      if (!isHttpUrl(node)) return;
      const looksLikeFile = FILE_EXT_RE.test(node) || isLikelyFileKey(key);
      if (!looksLikeFile) return;
      if (!found.has(node)) {
        found.set(node, { url: node, key, path });
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach((item, idx) => visit(item, key, `${path}.${idx}`));
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        visit(v, k, path ? `${path}.${k}` : k);
      }
    }
  }

  visit(payload, "", "");
  return Array.from(found.values());
}
