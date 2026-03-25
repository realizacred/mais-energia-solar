/**
 * useProposalDetail.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Hook para carregar dados completos de uma proposta versão
 * e retornar ProposalViewModel normalizado.
 */

import { useQuery } from "@tanstack/react-query";
import { fetchProposalDetail } from "@/services/proposal/proposalDetail.service";
import { buildProposalViewModel, type ProposalViewModel } from "@/domain/proposal/ProposalViewModel";

const STALE_TIME = 1000 * 30; // 30s — dados de detalhe podem mudar

export interface ProposalDetailResult {
  vm: ProposalViewModel | null;
  propostaRaw: Record<string, any> | null;
  versaoRaw: Record<string, any> | null;
  html: string | null;
  publicUrl: string | null;
  existingOs: Record<string, any> | null;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export function useProposalDetail(versaoId: string | undefined): ProposalDetailResult {
  const query = useQuery({
    queryKey: ["proposal-detail", versaoId],
    queryFn: () => fetchProposalDetail(versaoId!),
    enabled: !!versaoId,
    staleTime: STALE_TIME,
  });

  const data = query.data;
  const vm = data?.versao
    ? buildProposalViewModel({
        proposta: data.proposta,
        versao: data.versao,
        clienteNome: data.clienteNome,
        htmlPreview: data.html,
        publicUrl: data.publicUrl,
      })
    : null;

  return {
    vm,
    propostaRaw: data?.proposta || null,
    versaoRaw: data?.versao || null,
    html: data?.html || null,
    publicUrl: data?.publicUrl || null,
    existingOs: data?.existingOs || null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
