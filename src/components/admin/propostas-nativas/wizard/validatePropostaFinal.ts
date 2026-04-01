// ─── Validação Final Canônica — SSOT ────────────────────────
// Centraliza TODAS as validações pré-geração de proposta.
// Retorna errors (bloqueiam), warnings (exigem confirmação), infos (apenas informam).

import type { KitItemRow, UCData, VendaData, ServicoItem, PagamentoOpcao, ClienteData } from "./types";

export interface PropostaFinalValidationInput {
  cliente: ClienteData;
  selectedLead: { id: string; nome: string } | null;
  ucs: UCData[];
  itens: KitItemRow[];
  servicos: ServicoItem[];
  venda: VendaData;
  pagamentoOpcoes: PagamentoOpcao[];
  potenciaKwp: number;
  precoFinal: number;
  geracaoMensalKwh: number;
  consumoTotal: number;
  economiaMensal?: number;
  locEstado: string;
  locCidade: string;
  locDistribuidoraNome: string;
  templateSelecionado: string;
  /** Skip template validation (used at Resumo→Proposta gate where template isn't selected yet) */
  skipTemplateCheck?: boolean;
}

export interface PropostaFinalValidationResult {
  errors: string[];
  warnings: string[];
  infos: string[];
  /** True if no blocking errors */
  canGenerate: boolean;
  /** True if warnings exist and need explicit confirmation */
  needsConfirmation: boolean;
}

/**
 * Validação final canônica antes da geração de proposta.
 * SSOT: toda checagem pré-geração deve viver aqui.
 */
export function validatePropostaFinal(
  input: PropostaFinalValidationInput
): PropostaFinalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const infos: string[] = [];

  const {
    cliente, selectedLead, ucs, itens, servicos, venda,
    pagamentoOpcoes, potenciaKwp, precoFinal, geracaoMensalKwh,
    consumoTotal, economiaMensal, locEstado, locCidade, locDistribuidoraNome,
    templateSelecionado,
  } = input;

  // ═══════════════════════════════════════════════════════════
  // ERRORS — bloqueiam geração
  // ═══════════════════════════════════════════════════════════

  // 1. Lead/cliente obrigatório
  if (!selectedLead && !cliente.nome) {
    errors.push("Nenhum cliente ou lead selecionado.");
  }

  // 2. Localização obrigatória
  if (!locEstado || !locCidade) {
    errors.push("Estado e cidade do projeto não informados.");
  }

  // 3. Distribuidora obrigatória
  if (!locDistribuidoraNome) {
    errors.push("Distribuidora de energia não selecionada.");
  }

  // 4. Potência > 0
  if (potenciaKwp <= 0) {
    errors.push("Potência do sistema (kWp) deve ser maior que zero.");
  }

  // 5. Pelo menos 1 módulo válido
  const modulosValidos = itens.filter(
    (i) => i.categoria === "modulo" && i.quantidade >= 1 && i.potencia_w > 0
  );
  if (modulosValidos.length === 0) {
    errors.push("Kit deve conter pelo menos 1 módulo solar válido.");
  }

  // 6. Preço final > 0
  if (precoFinal <= 0) {
    errors.push("Valor total da proposta deve ser maior que zero.");
  }

  // 7. Consumo total > 0
  if (consumoTotal <= 0) {
    errors.push("Consumo total das UCs deve ser maior que zero.");
  }

  // 8. Template selecionado — only validate when skipTemplateCheck is not set
  //    (template is selected in the Proposta step, so we skip this at Resumo→Proposta gate)
  if (!templateSelecionado && !input.skipTemplateCheck) {
    errors.push("Nenhum template de proposta selecionado.");
  }

  // ═══════════════════════════════════════════════════════════
  // WARNINGS — exigem confirmação explícita
  // ═══════════════════════════════════════════════════════════

  // W1. Inversor ausente
  const inversores = itens.filter((i) => i.categoria === "inversor");
  if (inversores.length === 0) {
    warnings.push("Nenhum inversor adicionado ao kit. A proposta pode parecer incompleta.");
  }

  // W2. Itens com preço zero
  const itensPrecoZero = itens.filter((i) => i.preco_unitario <= 0 && i.quantidade > 0);
  if (itensPrecoZero.length > 0) {
    warnings.push(
      `${itensPrecoZero.length} item(ns) do kit com preço unitário R$ 0,00.`
    );
  }

  // W3. Margem zerada
  if (venda.margem_percentual <= 0) {
    warnings.push("Margem de lucro zerada ou negativa. O preço final pode não cobrir custos.");
  }

  // W4. Desconto > 15%
  if (venda.desconto_percentual > 15) {
    warnings.push(
      `Desconto de ${venda.desconto_percentual.toFixed(1)}% está acima do padrão (15%). Confirme se é intencional.`
    );
  }

  // W5. Nenhuma opção de pagamento
  if (pagamentoOpcoes.length === 0) {
    warnings.push("Nenhuma opção de pagamento configurada. O cliente não verá condições de pagamento.");
  }

  // W6. Geração mensal = 0 com potência > 0
  if (potenciaKwp > 0 && geracaoMensalKwh <= 0) {
    warnings.push("Geração mensal estimada é zero. Verifique irradiação e premissas.");
  }

  // W6b. Economia mensal = 0 com consumo > 0
  if (consumoTotal > 0 && (economiaMensal == null || economiaMensal <= 0)) {
    warnings.push("Economia mensal não calculada. Verifique tarifa e consumo.");
  }

  // W7. Nome do cliente vazio
  if (!cliente.nome && selectedLead?.nome) {
    warnings.push("Dados do cliente não preenchidos — usando nome do lead. Revise se necessário.");
  }

  // W8. Serviços inclusos com valor zero
  const servicosZero = servicos.filter((s) => s.incluso_no_preco && s.valor <= 0);
  if (servicosZero.length > 0) {
    warnings.push(
      `${servicosZero.length} serviço(s) incluso(s) com valor R$ 0,00.`
    );
  }

  // ═══════════════════════════════════════════════════════════
  // INFOS — apenas informativos
  // ═══════════════════════════════════════════════════════════

  // I1. Múltiplas UCs
  if (ucs.length > 1) {
    infos.push(`Proposta contempla ${ucs.length} unidades consumidoras.`);
  }

  // I2. Sistema com bateria
  const temBateria = itens.some((i) => i.categoria === "bateria" && i.quantidade > 0);
  if (temBateria) {
    infos.push("Sistema inclui armazenamento (bateria).");
  }

  // I3. Sobredimensionamento
  if (potenciaKwp > 0 && consumoTotal > 0 && geracaoMensalKwh > 0) {
    const ratio = geracaoMensalKwh / consumoTotal;
    if (ratio > 1.3) {
      infos.push(
        `Geração estimada (${geracaoMensalKwh} kWh) é ${Math.round((ratio - 1) * 100)}% acima do consumo. Sistema sobredimensionado.`
      );
    }
  }

  return {
    errors,
    warnings,
    infos,
    canGenerate: errors.length === 0,
    needsConfirmation: warnings.length > 0,
  };
}
