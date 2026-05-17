// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { equipmentMetadataService, type DisjuntorRow, type TransformadorRow } from "@/services/admin/equipmentMetadataService";

const STALE_TIME = 1000 * 60 * 5; // 5 min

export type { DisjuntorRow, TransformadorRow };

// ── Disjuntores ──────────────────────────────────────────────

export function useDisjuntores() {
  return useQuery({
    queryKey: ["disjuntores"],
    queryFn: () => equipmentMetadataService.fetchDisjuntores(),
    staleTime: STALE_TIME,
  });
}

export function useSalvarDisjuntor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id?: string; amperagem: number; descricao: string | null }) => 
      equipmentMetadataService.saveDisjuntor(payload.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

export function useToggleDisjuntorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; ativo: boolean }) => 
      equipmentMetadataService.toggleDisjuntorActive(params.id, params.ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

export function useDeletarDisjuntor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentMetadataService.deleteDisjuntor(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["disjuntores"] });
    },
  });
}

// ── Transformadores ──────────────────────────────────────────

export function useTransformadores() {
  return useQuery({
    queryKey: ["transformadores"],
    queryFn: () => equipmentMetadataService.fetchTransformadores(),
    staleTime: STALE_TIME,
  });
}

export function useSalvarTransformador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id?: string; potencia_kva: number; descricao: string | null }) => 
      equipmentMetadataService.saveTransformador(payload.id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}

export function useToggleTransformadorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; ativo: boolean }) => 
      equipmentMetadataService.toggleTransformadorActive(params.id, params.ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}

export function useDeletarTransformador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => equipmentMetadataService.deleteTransformador(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transformadores"] });
    },
  });
}
