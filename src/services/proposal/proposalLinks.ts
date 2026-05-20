/**
 * proposalLinks.ts — SSOT de URLs da proposta.
 *
 * Regras (AGENTS.md):
 *  - QR Code / link público compartilhado → SEMPRE landing /pl/:token.
 *  - PDF direto → rota mascarada /p/pdf/:token.
 *  - Toda URL pública deve carregar `?src=` com a origem (qr, copy_link, copy_pdf,
 *    whatsapp, email, direct) para alimentar `proposal_events` via
 *    `register_proposal_event`.
 *
 * Nenhum componente deve montar URLs com string solta — usar SEMPRE estes helpers.
 * NUNCA vazar signedUrl do Supabase para o cliente final.
 */

import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

/** Origens controladas (espelha whitelist da RPC register_proposal_event). */
export type ProposalLinkSrc =
  | "qr"
  | "copy_link"
  | "copy_pdf"
  | "whatsapp"
  | "email"
  | "direct";

function appendSrc(url: string, src?: ProposalLinkSrc | null): string {
  if (!src) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}src=${encodeURIComponent(src)}`;
}

/** Landing de alta conversão (rota canônica). */
export function getProposalWebUrl(token: string, src?: ProposalLinkSrc | null): string {
  return appendSrc(`${getPublicUrl()}/pl/${token}`, src);
}

/** Link do PDF mascarado (proxy SSOT). Esconde a URL do storage. */
export function getMaskedPdfUrl(token: string, src?: ProposalLinkSrc | null): string {
  return appendSrc(`${getPublicUrl()}/p/pdf/${token}`, src);
}

/** Link rastreável: mesma landing, abre tracking via token. */
export function getTrackedPdfUrl(token: string, src?: ProposalLinkSrc | null): string {
  return getProposalWebUrl(token, src);
}

/**
 * Signed URL direta para o PDF no Storage.
 * @deprecated Use getMaskedPdfUrl(token) para clientes finais.
 */
export async function getProposalPdfSignedUrl(
  outputPdfPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("proposta-documentos")
    .createSignedUrl(outputPdfPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/**
 * PDF direto SSOT.
 * @deprecated Use getMaskedPdfUrl(token) para fluxos de cliente.
 */
export async function getDirectPdfUrl(
  outputPdfPath: string | null,
  externalPdfUrl?: string | null,
): Promise<string | null> {
  if (outputPdfPath) {
    const signed = await getProposalPdfSignedUrl(outputPdfPath);
    if (signed) return signed;
  }
  return externalPdfUrl || null;
}

/** Link da simulação financeira. Retorna null se não houver financiamento. */
export function getSimulationUrl(
  token: string,
  hasFinancing: boolean,
): string | null {
  if (!hasFinancing) return null;
  return `${getProposalWebUrl(token)}?view=simulacao`;
}
