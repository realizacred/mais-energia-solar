/**
 * Friendly labels + descriptions for semantic proposal_* blocks.
 * These blocks render automatically via SEMANTIC_RENDERERS using
 * proposal data — they do NOT accept manual content.
 */

const AUTO_DESC = "Este conteúdo é gerado automaticamente com base nos dados da proposta";

export const SEMANTIC_BLOCK_LABELS: Record<string, { label: string; icon: string; description: string; preview: string }> = {
  proposal_hero: { label: "Capa da proposta", icon: "🎯", description: AUTO_DESC, preview: "Nome do cliente • Empresa • KPIs principais" },
  proposal_problem: { label: "Problema do cliente", icon: "⚠️", description: AUTO_DESC, preview: "Conta atual • Aumentos tarifários • Dor" },
  proposal_kpis: { label: "Indicadores", icon: "📊", description: AUTO_DESC, preview: "Economia • Payback • Geração mensal" },
  proposal_solution: { label: "Solução", icon: "💡", description: AUTO_DESC, preview: "Sistema dimensionado • Potência • Geração estimada" },
  proposal_comparison: { label: "Antes e depois", icon: "⚖️", description: AUTO_DESC, preview: "Conta atual vs. com solar" },
  proposal_equipment: { label: "Equipamentos", icon: "🔧", description: AUTO_DESC, preview: "Módulos • Inversores • Estrutura" },
  proposal_financial: { label: "Economia e retorno", icon: "💰", description: AUTO_DESC, preview: "Investimento • Economia anual • Payback • TIR • VPL" },
  proposal_guarantees: { label: "Garantias", icon: "🛡️", description: AUTO_DESC, preview: "Produto • Performance • Instalação" },
  proposal_payment: { label: "Pagamento", icon: "💳", description: AUTO_DESC, preview: "Condições e modalidades disponíveis" },
  proposal_cta: { label: "Chamada para ação", icon: "🚀", description: AUTO_DESC, preview: "Botão de aceite • Mensagem de fechamento" },
  proposal_closing: { label: "Fechamento", icon: "✨", description: AUTO_DESC, preview: "Mensagem final • Contatos • Próximos passos" },
};

export function isSemanticProposalBlock(type: string): boolean {
  return type.startsWith("proposal_");
}
