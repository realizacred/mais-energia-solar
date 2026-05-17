/**
 * Hooks for Inversores Catalogo (inverter catalog).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { inverterService, type Inversor } from "@/services/solar/inverterService";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "inversores-catalogo" as const;

export type { Inversor };

export function useInversoresCatalogo() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: () => inverterService.fetchAll(),
    staleTime: STALE_TIME,
  });
}

export function useSalvarInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, unknown> }) => 
      inverterService.save(payload.id, payload.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => inverterService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleInversor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; ativo: boolean }) => 
      inverterService.toggleActive(params.id, params.ativo),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
