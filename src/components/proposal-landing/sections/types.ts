/**
 * Shared types for proposal landing page sections.
 * Página pública — exceção RB-02 documentada.
 */

import type { NormalizedProposalSnapshot, NormalizedKitItem } from "@/domain/proposal/normalizeProposalSnapshot";

export interface LandingSectionProps {
  snapshot: NormalizedProposalSnapshot;
  versaoData: {
    valor_total: number;
    economia_mensal: number;
    payback_meses: number;
    potencia_kwp: number;
  };
  brand: { logo_url: string | null; logo_white_url: string | null } | null;
  tenantNome: string | null;
  consultorNome: string | null;
  consultorTelefone: string | null;
}

export interface CenarioData {
  id: string;
  ordem: number;
  nome: string;
  tipo: string;
  is_default: boolean;
  preco_final: number;
  entrada_valor: number;
  num_parcelas: number;
  valor_parcela: number;
  taxa_juros_mensal: number;
  payback_meses: number;
  tir_anual: number;
  roi_25_anos: number;
  economia_primeiro_ano: number;
}

export interface AcceptFormData {
  nome: string;
  documento: string;
  obs: string;
}
