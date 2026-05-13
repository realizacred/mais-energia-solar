/**
 * proposalTotals.ts — SSOT canônico do valor total de uma proposta
 *
 * ⚠️ NÃO RECALCULE TOTAL DE PROPOSTA EM OUTRO LUGAR.
 *    Card, listagem, editor, web pública, PDF/DOCX e header devem usar
 *    `getCanonicalProposalTotal(versao)` para garantir paridade visual.
 *
 * Causa raiz histórica (caso Adriano R$ 15.076 vs R$ 21.876):
 *   `proposta_versoes.valor_total` pode ficar dessincronizado quando a
 *   geração antiga não persistiu `custo_instalacao` no payload. O valor real
 *   está sempre no snapshot (itens + servicos + venda) — usamos `calcPrecoFinal`
 *   (já SSOT do editor em `wizard/types.ts`) para recompor o total quando
 *   o snapshot é confiável, e caímos para `valor_total` apenas como fallback.
 *
 * Regra: snapshot completo > valor_total persistido.
 */

import {
  calcPrecoFinal,
  type KitItemRow,
  type ServicoItem,
  type VendaData,
} from "@/components/admin/propostas-nativas/wizard/types";

/** Subset mínimo aceito (versão pode vir com snapshot opcional). */
export interface VersaoLike {
  valor_total?: number | null;
  snapshot?: Record<string, any> | null;
}

/** Verifica se o snapshot tem o mínimo para recomputar com confiança. */
function snapshotIsComputable(snap: Record<string, any> | null | undefined): boolean {
  if (!snap || typeof snap !== "object") return false;
  const itens = Array.isArray(snap.itens) ? snap.itens : null;
  const venda = snap.venda && typeof snap.venda === "object" ? snap.venda : null;
  if (!itens || itens.length === 0) return false;
  if (!venda) return false;
  // Precisa ter pelo menos custo_kit (resolvido) ou itens com preço para somar
  const hasKitCost =
    Number(venda.custo_kit ?? venda.custo_kit_override ?? 0) > 0 ||
    itens.some((i: any) => Number(i?.preco_unitario ?? 0) > 0);
  return hasKitCost;
}

/** Normaliza venda do snapshot para `VendaData` aceito por `calcPrecoFinal`. */
function normalizeVenda(rawVenda: any, servicosFallback: any[]): VendaData {
  const v = rawVenda || {};
  const fallbackInstalacao = (servicosFallback || [])
    .filter((s: any) => s?.categoria === "instalacao" && s?.incluso_no_preco !== false)
    .reduce((sum: number, s: any) => sum + (Number(s?.valor) || 0), 0);

  return {
    custo_kit: Number(v.custo_kit) || 0,
    custo_instalacao:
      Number(v.custo_instalacao) > 0 ? Number(v.custo_instalacao) : fallbackInstalacao,
    custo_comissao: Number(v.custo_comissao) || 0,
    custo_outros: Number(v.custo_outros) || 0,
    margem_percentual: Number(v.margem_percentual) || 0,
    desconto_percentual: Number(v.desconto_percentual) || 0,
    observacoes: v.observacoes || "",
    custo_kit_override: v.custo_kit_override ?? null,
  };
}

/**
 * SSOT — total canônico de uma versão de proposta.
 * Card, listagem, header, web e PDF DEVEM consumir este helper.
 */
export function getCanonicalProposalTotal(versao: VersaoLike | null | undefined): number {
  if (!versao) return 0;
  const persisted = Number(versao.valor_total ?? 0);
  const snap = (versao.snapshot ?? null) as Record<string, any> | null;

  if (snapshotIsComputable(snap)) {
    try {
      const itens = (snap!.itens as KitItemRow[]) ?? [];
      const servicos = (Array.isArray(snap!.servicos) ? snap!.servicos : []) as ServicoItem[];
      const venda = normalizeVenda(snap!.venda, servicos);
      const recomputed = calcPrecoFinal(itens, servicos, venda);
      // Se a recomposição for coerente (>0), prevalece sobre o persistido.
      if (recomputed > 0) return recomputed;
    } catch {
      // Snapshot corrompido — cai no fallback persistido.
    }
  }

  return persisted > 0 ? persisted : 0;
}

/**
 * Retorna o total canônico ou null quando não há nenhum dado utilizável.
 * Útil para listagens que diferenciam "—" de R$ 0,00.
 */
export function getCanonicalProposalTotalOrNull(
  versao: VersaoLike | null | undefined,
): number | null {
  const total = getCanonicalProposalTotal(versao);
  if (total > 0) return total;
  // Se persisted está explicitamente em 0 e snapshot não compõe, devolve null
  return versao?.valor_total != null && Number(versao.valor_total) > 0
    ? Number(versao.valor_total)
    : null;
}
