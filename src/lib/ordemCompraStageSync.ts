/**
 * ordemCompraStageSync
 *
 * Helper puro (sem efeito colateral) que mapeia a etapa atual do funil
 * Equipamento para o status canônico de `ordens_compra.status`.
 *
 * Regras:
 * - "Fazer Pedido" ou "Pedido Efetuado" → "enviada"
 * - "Pedido Pago"                       → "confirmada"
 * - "Depósito" / "Cliente" / "Instalação" / "Sistema em operação" → "confirmada"
 *   (mantém em pé até recebimento; recebimento é tratado por useReceberItensOrdem)
 *
 * Status terminais NUNCA são sobrescritos:
 *   recebida_parcial, recebida, cancelada
 *
 * Retorna `null` quando:
 *   - etapa não mapeada
 *   - status atual é terminal/avançado
 *   - novo status seria igual ao atual
 */

export type OrdemCompraStatusCanonico =
  | "rascunho"
  | "enviada"
  | "confirmada"
  | "em_transito"
  | "recebida_parcial"
  | "recebida"
  | "cancelada";

const TERMINAL_STATUSES: OrdemCompraStatusCanonico[] = [
  "recebida_parcial",
  "recebida",
  "cancelada",
];

export function resolveOrdemStatusByEquipamentoStage(
  stageName: string | null | undefined,
  currentStatus: OrdemCompraStatusCanonico | string | null | undefined,
): OrdemCompraStatusCanonico | null {
  if (!stageName) return null;
  const s = stageName.toLowerCase().trim();
  const current = (currentStatus || "rascunho") as OrdemCompraStatusCanonico;

  // Nunca regredir/sobrescrever status terminal
  if (TERMINAL_STATUSES.includes(current)) return null;

  let target: OrdemCompraStatusCanonico | null = null;

  if (s.includes("fazer pedido") || s.includes("pedido efetuado")) {
    target = "enviada";
  } else if (
    s.includes("pedido pago") ||
    s.includes("depósito") ||
    s.includes("deposito") ||
    s.includes("cliente") ||
    s.includes("instalação") ||
    s.includes("instalacao") ||
    s.includes("sistema em operação") ||
    s.includes("sistema em operacao")
  ) {
    target = "confirmada";
  }

  if (!target) return null;
  if (target === current) return null;

  // Não regredir "confirmada" → "enviada"
  if (current === "confirmada" && target === "enviada") return null;
  // Não regredir "em_transito" → "enviada"/"confirmada"
  if (current === "em_transito") return null;

  return target;
}
