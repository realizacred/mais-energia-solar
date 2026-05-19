/**
 * proposalLinks.ts — SSOT de URLs da proposta.
 *
 * Regras (AGENTS.md):
 *  - QR Code / link público compartilhado → SEMPRE landing de alta conversão (/pl/:token).
 *  - PDF rastreável → mesma rota /pl/:token (o tracking acontece via token, não via /proposta).
 *  - PDF direto → signed URL do storage (sem token, sem tracking).
 *  - Simulação financeira → /pl/:token?view=simulacao (somente se houver financiamento ativo).
 *
 * ⚠️ NUNCA apontar QR/link público para /proposta/:token (PropostaPublica.tsx).
 * Essa rota é a tela genérica antiga, mantida só por compatibilidade de tokens
 * históricos e para o fluxo de assinatura/decisão. Não é a experiência canônica.
 *
 * Nenhum componente deve montar URLs com string solta — usar SEMPRE estes helpers.
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

/** Signed URL direta para o PDF no Storage. Sem tracking, sem token. */
export async function getProposalPdfSignedUrl(
  outputPdfPath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("proposta-documentos")
    .createSignedUrl(outputPdfPath, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** PDF direto: prioriza signed URL fresh; aceita externalPdfUrl como fallback. */
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
