/**
 * ProposalViewModel.ts
 * 
 * Read model consolidado para exibição de proposta.
 * Combina proposta root + versão ativa + snapshot normalizado + status + links PDF.
 * 
 * SSOT: ProposalDetail e qualquer tela que exiba proposta devem usar este view model.
 */

import {
  normalizeProposalSnapshot,
  type NormalizedProposalSnapshot,
} from "./normalizeProposalSnapshot";

// ─── Estados explícitos da proposta ───────────────────────
export type ProposalState = "draft" | "generating" | "ready" | "error";

// ─── Status de negócio ────────────────────────────────────
export type ProposalBusinessStatus =
  | "rascunho"
  | "gerada"
  | "enviada"
  | "vista"
  | "aceita"
  | "recusada"
  | "expirada"
  | "cancelada";

// ─── View Model ───────────────────────────────────────────
export interface ProposalViewModel {
  // Identifiers
  propostaId: string;
  versaoId: string;
  versaoNumero: number;
  codigo: string;
  titulo: string;

  // State
  state: ProposalState;
  businessStatus: ProposalBusinessStatus;

  // Snapshot normalizado (SSOT para dados)
  snapshot: NormalizedProposalSnapshot;

  // Valores da versão (podem divergir se snapshot != coluna)
  potenciaKwp: number;
  valorTotal: number;
  economiaMensal: number;
  geracaoMensal: number;
  paybackMeses: number;

  // Derivados
  wpPrice: number; // R$/Wp
  custoTotal: number;
  lucroTotal: number;
  margemPct: number;
  paybackText: string;

  // PDF/Arquivo
  hasFile: boolean;
  htmlPreview: string | null;
  publicUrl: string | null;
  outputPdfPath: string | null;
  outputDocxPath: string | null;

  // Tracking
  clienteNome: string;
  leadId: string | null;
  clienteId: string | null;
  projetoId: string | null;
  dealId: string | null;

  // Dates
  criadoEm: string | null;
  geradoEm: string | null;
  atualizadoEm: string | null;
  validoAte: string | null;

  // Flags
  isFinalized: boolean;
  isAccepted: boolean;
  isRejected: boolean;
  canSend: boolean;
  canEdit: boolean;
}

// ─── Input para construir o VM ────────────────────────────
export interface BuildViewModelInput {
  proposta: Record<string, any> | null;
  versao: Record<string, any> | null;
  clienteNome?: string | null;
  htmlPreview?: string | null;
  publicUrl?: string | null;
}

// ─── Builder ──────────────────────────────────────────────
export function buildProposalViewModel(input: BuildViewModelInput): ProposalViewModel {
  const { proposta, versao, clienteNome, htmlPreview, publicUrl } = input;

  const p = proposta || {};
  const v = versao || {};

  // Normalizar snapshot
  const snapshot = normalizeProposalSnapshot(v.snapshot || v.final_snapshot);

  // Status
  const rawStatus = (p.status || v.status || "rascunho") as string;
  const businessStatus = (
    ["rascunho", "gerada", "enviada", "vista", "aceita", "recusada", "expirada", "cancelada"].includes(rawStatus)
      ? rawStatus
      : "rascunho"
  ) as ProposalBusinessStatus;

  // State mapping
  let state: ProposalState = "draft";
  if (["gerada", "enviada", "vista", "aceita"].includes(businessStatus)) state = "ready";
  if (businessStatus === "recusada" || businessStatus === "cancelada") state = "ready";
  if (v.status === "generating") state = "generating";

  // Valores da versão (com fallback para snapshot)
  const potenciaKwp = Number(v.potencia_kwp) || snapshot.potenciaKwp;
  const valorTotal = Number(v.valor_total) || 0;
  const economiaMensal = Number(v.economia_mensal) || snapshot.economiaMensal;
  const geracaoMensal = snapshot.geracaoMensalEstimada || Number(v.geracao_mensal) || 0;
  const paybackMeses = Number(v.payback_meses) || snapshot.paybackMeses;

  // Derivados financeiros
  const custoKit = snapshot.custoKit;
  const custoInstalacao = snapshot.venda.custo_instalacao;
  const custoComissao = snapshot.venda.custo_comissao;
  const custoTotal = custoKit + custoInstalacao + custoComissao + snapshot.custoServicos;
  const lucroTotal = valorTotal - custoTotal;
  const margemPct = valorTotal > 0 ? (lucroTotal / valorTotal) * 100 : 0;
  const wpPrice = potenciaKwp > 0 ? valorTotal / (potenciaKwp * 1000) : 0;

  // Payback text
  let paybackText = "—";
  if (paybackMeses > 0) {
    paybackText = paybackMeses >= 12
      ? `${Math.floor(paybackMeses / 12)}a ${paybackMeses % 12}m`
      : `${paybackMeses} meses`;
  }

  const isFinalized = !!v.finalized_at || !!v.snapshot_locked;
  const isAccepted = businessStatus === "aceita";
  const isRejected = businessStatus === "recusada";

  return {
    propostaId: String(p.id || ""),
    versaoId: String(v.id || ""),
    versaoNumero: Number(v.versao_numero) || 1,
    codigo: String(p.codigo || ""),
    titulo: String(p.titulo || ""),

    state,
    businessStatus,
    snapshot,

    potenciaKwp,
    valorTotal,
    economiaMensal,
    geracaoMensal,
    paybackMeses,

    wpPrice,
    custoTotal,
    lucroTotal,
    margemPct,
    paybackText,

    hasFile: !!htmlPreview || !!(v as any).output_pdf_path,
    htmlPreview: htmlPreview || null,
    publicUrl: publicUrl || null,
    outputPdfPath: (v as any).output_pdf_path || null,
    outputDocxPath: (v as any).output_docx_path || null,

    clienteNome: clienteNome || snapshot.clienteNome || p.titulo || p.codigo || "Proposta",
    leadId: p.lead_id || null,
    clienteId: p.cliente_id || null,
    projetoId: p.projeto_id || null,
    dealId: p.deal_id || null,

    criadoEm: v.created_at || null,
    geradoEm: v.gerado_em || null,
    atualizadoEm: p.updated_at || v.updated_at || null,
    validoAte: v.valido_ate || null,

    isFinalized,
    isAccepted,
    isRejected,
    canSend: ["rascunho", "gerada"].includes(businessStatus),
    canEdit: !isFinalized || ["rascunho", "gerada"].includes(businessStatus),
  };
}
