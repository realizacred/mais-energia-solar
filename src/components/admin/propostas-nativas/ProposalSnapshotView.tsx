/**
 * ProposalSnapshotView.tsx
 * 
 * Adapter component that renders StepResumo from a raw snapshot.
 * SSOT: Uses normalizeProposalSnapshot to guarantee safe data.
 * 
 * Usage:
 *   <ProposalSnapshotView snapshot={rawSnapshot} valorTotal={versao.valor_total} />
 * 
 * This component is the SINGLE view for proposal data across:
 *   - Arquivo tab (project detail)
 *   - Dados tab (project detail)
 *   - ProposalDetail standalone page
 *   - Any future view that needs to display a proposal
 */

import { normalizeProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import { StepResumo } from "./wizard/StepResumo";

interface ProposalSnapshotViewProps {
  /** Raw snapshot from proposta_versoes.snapshot */
  snapshot: Record<string, unknown> | null;
  /** Override valor_total from versão column (takes precedence over snapshot) */
  valorTotal?: number;
  /** Override geração mensal from versão column */
  geracaoMensal?: number;
  /** Override economia mensal from versão column */
  economiaMensal?: number;
}

/**
 * Renders a proposal using the SAME StepResumo component from the wizard.
 * Eliminates duplicate UI implementations for Arquivo/Dados tabs.
 */
export function ProposalSnapshotView({
  snapshot,
  valorTotal,
  geracaoMensal,
  economiaMensal,
}: ProposalSnapshotViewProps) {
  const norm = normalizeProposalSnapshot(snapshot);
  const raw = snapshot as Record<string, any> || {};

  // Use versão columns as override (more reliable than snapshot for these)
  const precoFinal = valorTotal ?? norm.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const geracaoMensalKwh = geracaoMensal ?? norm.geracaoMensalEstimada;

  // Adicionais live in raw snapshot (not normalized — wizard-specific)
  const adicionais = Array.isArray(raw.adicionais) ? raw.adicionais.map((a: any) => ({
    descricao: String(a.descricao || ""),
    quantidade: Number(a.quantidade) || 1,
    preco_unitario: Number(a.preco_unitario) || 0,
  })) : [];

  return (
    <StepResumo
      // Location
      estado={norm.locEstado}
      cidade={norm.locCidade}
      tipoTelhado={norm.locTipoTelhado}
      distribuidoraNome={norm.locDistribuidoraNome}
      irradiacao={norm.locIrradiacao}
      // Client
      clienteNome={norm.clienteNome}
      clienteCelular={norm.clienteCelular || undefined}
      clienteEmail={norm.clienteEmail || undefined}
      clienteEmpresa={norm.clienteEmpresa || undefined}
      // System
      potenciaKwp={norm.potenciaKwp}
      consumoTotal={norm.consumoTotal}
      geracaoMensalKwh={geracaoMensalKwh}
      numUcs={norm.ucs.length || 1}
      grupo={norm.grupo}
      // Kit
      itens={norm.itens.map(i => ({
        descricao: `${i.fabricante} ${i.modelo}`.trim() || i.descricao,
        quantidade: i.quantidade,
        preco_unitario: i.preco_unitario,
        categoria: i.categoria,
      }))}
      // Adicionais
      adicionais={adicionais}
      // Serviços
      servicos={norm.servicos.map(s => ({
        descricao: s.descricao,
        valor: s.valor,
        incluso_no_preco: s.incluso_no_preco,
      }))}
      // Venda
      precoFinal={precoFinal}
      margemPercentual={norm.venda.margem_percentual}
      custoInstalacao={norm.venda.custo_instalacao}
      custoComissao={norm.venda.custo_comissao}
      custoOutros={norm.venda.custo_outros}
      descontoPercentual={norm.venda.desconto_percentual}
      // Pagamento
      pagamentoOpcoes={norm.pagamentoOpcoes.map(p => ({
        nome: p.nome,
        tipo: p.tipo,
        num_parcelas: p.num_parcelas,
        valor_parcela: p.valor_parcela,
        entrada: p.entrada,
        taxa_mensal: p.taxa_mensal,
        valor_financiado: p.valor_financiado,
        carencia_meses: p.carencia_meses,
      }))}
    />
  );
}