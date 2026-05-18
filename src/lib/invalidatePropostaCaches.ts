/**
 * invalidatePropostaCaches.ts
 *
 * SSOT de invalidação de caches relacionados a propostas.
 * Use SEMPRE este helper após qualquer escrita em:
 *   propostas_nativas | proposta_versoes | proposta_aceite_tokens |
 *   proposta_kits | proposta_versao_ucs | generated_documents |
 *   proposal_events | comissoes (quando origem = aceite)
 *
 * Por que centralizado:
 * - Os caminhos antigos (proposal-transition, proposal_update_status RPC,
 *   handleRender, send, copyLink, validade) invalidavam subconjuntos diferentes
 *   das mesmas queryKeys, causando UI stale (badge azul "gerada" não virava
 *   "aceita", CTAs sumindo/aparecendo, drawer com dados antigos).
 *
 * Não causa request adicional para queries que não estão montadas (React Query
 * apenas marca como stale; refetch só dispara em consumidores ativos).
 */

import type { QueryClient } from "@tanstack/react-query";

export interface InvalidateScope {
  propostaId?: string | null;
  dealId?: string | null;
  versaoId?: string | null;
}

export function invalidatePropostaCaches(
  qc: QueryClient,
  scope: InvalidateScope = {},
): void {
  const { propostaId, dealId, versaoId } = scope;

  // ── Listagens / projeções / pipelines ──────────────────
  qc.invalidateQueries({ queryKey: ["propostas-listagem"] });
  qc.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
  qc.invalidateQueries({ queryKey: ["deal-propostas"] });
  qc.invalidateQueries({ queryKey: ["deal-proposals-count"] });
  qc.invalidateQueries({ queryKey: ["deal-pipeline"] });
  qc.invalidateQueries({ queryKey: ["deal-pipeline-stages"] });
  qc.invalidateQueries({ queryKey: ["projetos-pipeline"] });

  // ── Detalhe de projeto ─────────────────────────────────
  qc.invalidateQueries({ queryKey: ["projeto-detalhe"] });
  qc.invalidateQueries({ queryKey: ["projeto-detalhe-data"] });

  // ── Gates / regras de negócio ──────────────────────────
  qc.invalidateQueries({ queryKey: ["proposta-aceita-gate"] });

  // ── Por propostaId ─────────────────────────────────────
  if (propostaId) {
    qc.invalidateQueries({ queryKey: ["proposal-detail", propostaId] });
    qc.invalidateQueries({ queryKey: ["proposta-events", propostaId] });
    qc.invalidateQueries({ queryKey: ["proposta-audit-logs", propostaId] });
  }

  // ── Por versaoId (drawer expandido) ────────────────────
  if (versaoId) {
    qc.invalidateQueries({ queryKey: ["proposal-detail", versaoId] });
    qc.invalidateQueries({ queryKey: ["proposta-expanded-snapshot", versaoId] });
    qc.invalidateQueries({ queryKey: ["proposta-expanded-ucs", versaoId] });
    qc.invalidateQueries({ queryKey: ["proposta-expanded-kit-items", versaoId] });
  }

  // ── Escopo por deal (se conhecido) ─────────────────────
  if (dealId) {
    qc.invalidateQueries({ queryKey: ["projeto-detalhe", dealId] });
    qc.invalidateQueries({ queryKey: ["projeto-detalhe-data", dealId] });
    qc.invalidateQueries({ queryKey: ["deal-pipeline", dealId] });
    qc.invalidateQueries({ queryKey: ["deal-pipeline-stages", dealId] });
    qc.invalidateQueries({ queryKey: ["proposta-aceita-gate", dealId] });
  }
}
