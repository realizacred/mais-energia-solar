/**
 * Premium semantic template — uses proposal_* block types
 * instead of raw HTML blobs. Automatically themed via CSS vars + brandBridge.
 */

import type { TemplateBlock, ProposalType } from "./types";

function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

/**
 * Creates a premium template using semantic blocks.
 * Each block renders via React components (SemanticBlockRenderer),
 * not dangerouslySetInnerHTML. Automatically respects branding.
 */
export function createPremiumSemanticTemplate(proposalType: ProposalType = "grid"): TemplateBlock[] {
  const base = { _proposalType: proposalType, isVisible: true };

  return [
    { ...base, id: uid(), type: "proposal_hero", content: "", parentId: null, order: 0, style: {} },
    { ...base, id: uid(), type: "proposal_problem", content: "", parentId: null, order: 1, style: {} },
    { ...base, id: uid(), type: "proposal_kpis", content: "", parentId: null, order: 2, style: {} },
    { ...base, id: uid(), type: "proposal_solution", content: "", parentId: null, order: 3, style: {} },
    { ...base, id: uid(), type: "proposal_comparison", content: "", parentId: null, order: 4, style: {} },
    { ...base, id: uid(), type: "proposal_equipment", content: "", parentId: null, order: 5, style: {} },
    { ...base, id: uid(), type: "proposal_financial", content: "", parentId: null, order: 6, style: {} },
    { ...base, id: uid(), type: "proposal_guarantees", content: "", parentId: null, order: 7, style: {} },
    { ...base, id: uid(), type: "proposal_payment", content: "", parentId: null, order: 8, style: {} },
    { ...base, id: uid(), type: "proposal_cta", content: "", parentId: null, order: 9, style: {} },
    { ...base, id: uid(), type: "proposal_closing", content: "", parentId: null, order: 10, style: {} },
  ];
}
