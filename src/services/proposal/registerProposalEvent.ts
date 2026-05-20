/**
 * registerProposalEvent — cliente fino para a RPC `register_proposal_event`.
 *
 * Best-effort: erros são silenciados (apenas logados) para nunca quebrar UX pública.
 * A RPC valida tipo/src/token e injeta proposta_id+tenant_id a partir do token.
 */

import { supabase } from "@/integrations/supabase/client";
import type { ProposalLinkSrc } from "@/services/proposal/proposalLinks";

export type ProposalPublicEvent = "web_open" | "pdf_open" | "pdf_download";

const ALLOWED_SRC: ProposalLinkSrc[] = [
  "qr",
  "copy_link",
  "copy_pdf",
  "whatsapp",
  "email",
  "direct",
];

function normalizeSrc(raw?: string | null): ProposalLinkSrc {
  const v = (raw || "").toLowerCase() as ProposalLinkSrc;
  return ALLOWED_SRC.includes(v) ? v : "direct";
}

/** Lê `?src=` da URL atual e devolve uma origem válida (default `direct`). */
export function readSrcFromLocation(search?: string): ProposalLinkSrc {
  try {
    const sp = new URLSearchParams(search ?? window.location.search);
    return normalizeSrc(sp.get("src"));
  } catch {
    return "direct";
  }
}

export async function registerProposalEvent(
  token: string,
  tipo: ProposalPublicEvent,
  src: ProposalLinkSrc | string | null | undefined,
  payload: Record<string, unknown> = {},
): Promise<void> {
  try {
    await (supabase as any).rpc("register_proposal_event", {
      p_token: token,
      p_tipo: tipo,
      p_src: normalizeSrc(typeof src === "string" ? src : null),
      p_payload: payload as any,
    });
  } catch (err) {
    // Best-effort — nunca derruba UX pública.
    // eslint-disable-next-line no-console
    console.warn("[registerProposalEvent] failed:", err);
  }
}
