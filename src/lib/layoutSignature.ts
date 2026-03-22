/**
 * layoutSignature — Gera assinatura determinística de layout de fatura.
 * Baseada em concessionária + labels presentes + estrutura do documento.
 * Não usa IA. Auditável.
 */

const KNOWN_LABELS = [
  "consumo kwh", "energia eletrica", "valor total", "vencimento",
  "referencia", "numero do cliente", "numero da uc", "codigo de barras",
  "energia injetada", "energia compensada", "saldo anterior", "saldo atual",
  "leitura anterior", "leitura atual", "proxima leitura",
  "tarifa", "tusd", "icms", "pis", "cofins", "bandeira",
  "demanda contratada", "demanda medida", "ultrapassagem",
  "classe", "subgrupo", "tipo de ligacao", "modalidade tarifaria",
];

/**
 * Gera hash simples e estável a partir de string.
 */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Normaliza texto para comparação de labels.
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detecta quais labels conhecidas estão presentes no texto.
 */
function detectLabels(normalizedText: string): string[] {
  return KNOWN_LABELS.filter(label => normalizedText.includes(label));
}

export interface LayoutSignatureInput {
  concessionariaCode: string;
  rawText: string;
  fileType?: string;
}

export interface LayoutSignatureResult {
  signature: string;
  labelsFound: string[];
  labelsMissing: string[];
  fingerprint: string;
  isTextual: boolean;
}

/**
 * Gera assinatura determinística de layout.
 * Layouts com mesma concessionária e mesmos blocos detectados = mesma assinatura.
 */
export function generateLayoutSignature(input: LayoutSignatureInput): LayoutSignatureResult {
  const normalized = normalizeText(input.rawText);
  const isTextual = normalized.length > 50;

  const labelsFound = detectLabels(normalized);
  const labelsMissing = KNOWN_LABELS.filter(l => !labelsFound.includes(l));

  // Fingerprint = sorted labels joined
  const fingerprint = labelsFound.sort().join("|");

  // Signature = hash of concessionaria + fingerprint + file type
  const signatureInput = [
    input.concessionariaCode.toLowerCase().trim(),
    fingerprint,
    input.fileType || "pdf",
    isTextual ? "text" : "image",
  ].join("::");

  const signature = `${input.concessionariaCode.toLowerCase()}-${simpleHash(signatureInput)}`;

  return {
    signature,
    labelsFound,
    labelsMissing,
    fingerprint,
    isTextual,
  };
}
