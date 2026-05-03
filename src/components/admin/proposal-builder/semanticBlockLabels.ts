/**
 * Friendly labels + descriptions for semantic proposal_* blocks.
 * These blocks render automatically via SEMANTIC_RENDERERS using
 * proposal data — they do NOT accept manual content.
 */

export const SEMANTIC_BLOCK_LABELS: Record<string, { label: string; icon: string; description: string }> = {
  proposal_hero: { label: "Hero (capa da proposta)", icon: "🎯", description: "Capa com nome do cliente, empresa e KPIs principais" },
  proposal_problem: { label: "Problema / Dor", icon: "⚠️", description: "Apresenta o problema do alto custo de energia" },
  proposal_kpis: { label: "KPIs principais", icon: "📊", description: "Indicadores: economia, payback, geração" },
  proposal_solution: { label: "Solução proposta", icon: "💡", description: "Sistema fotovoltaico dimensionado" },
  proposal_comparison: { label: "Comparativo antes/depois", icon: "⚖️", description: "Conta atual vs. com solar" },
  proposal_equipment: { label: "Equipamentos", icon: "🔧", description: "Módulos, inversores e itens do kit" },
  proposal_financial: { label: "Resumo financeiro", icon: "💰", description: "Investimento, economia, payback, TIR, VPL" },
  proposal_guarantees: { label: "Garantias", icon: "🛡️", description: "Garantias de produto, performance e instalação" },
  proposal_payment: { label: "Condições de pagamento", icon: "💳", description: "Modalidades de pagamento disponíveis" },
  proposal_cta: { label: "Chamada para ação", icon: "🚀", description: "Botão e mensagem de fechamento" },
  proposal_closing: { label: "Encerramento", icon: "✨", description: "Mensagem final e contatos" },
};

export function isSemanticProposalBlock(type: string): boolean {
  return type.startsWith("proposal_");
}
