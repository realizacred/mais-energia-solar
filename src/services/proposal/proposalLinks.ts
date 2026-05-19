/**
 * proposalLinks.ts — SSOT de URLs da proposta.
 *
 * Regras (AGENTS.md):
 *  - QR Code / link público compartilhado → SEMPRE landing de alta conversão (/pl/:token).
 *  - PDF rastreável → mesma rota /pl/:token (o tracking acontece via token, não via /proposta).
 *  - PDF direto → rota mascarada (/p/pdf/:token).
 *  - Simulação financeira → /pl/:token?view=simulacao (somente se houver financiamento ativo).
 *
 * ⚠️ NUNCA apontar QR/link público para /proposta/:token (PropostaPublica.tsx).
 * Essa rota é mantida como REDIRECT inteligente para /pl/:token apenas por
 * compatibilidade de tokens históricos. Não é a experiência canônica.
 *
 * Nenhum componente deve montar URLs com string solta — usar SEMPRE estes helpers.
 * NUNCA vazar signedUrl do Supabase para o cliente final.
 */

import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";

const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

/** Landing de alta conversão (rota canônica para QR / WhatsApp / e-mail / link público). */
export function getProposalWebUrl(token: string): string {
  return `${getPublicUrl()}/pl/${token}`;
}

/** Link do PDF mascarado (Proxy/SSOT). Esconde a URL do storage. */
export function getMaskedPdfUrl(token: string): string {
  return `${getPublicUrl()}/p/pdf/${token}`;
}

/** Link rastreável: mesma landing, abre tracking via token. */
export function getTrackedPdfUrl(token: string): string {
  return getProposalWebUrl(token);
}

/** 
 * Signed URL direta para o PDF no Storage. 
 * @deprecated Use getMaskedPdfUrl(token) para clientes finais.
 * Útil apenas para consumo interno (servidor ou admin direto se necessário).
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
