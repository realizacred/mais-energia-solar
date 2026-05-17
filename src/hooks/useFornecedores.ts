/**
 * useFornecedores — Queries for FornecedoresManager.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { vendorService, type Fornecedor } from "@/services/admin/vendorService";

const STALE_TIME = 1000 * 60 * 5; // 5 min — cadastro
const QK = ["fornecedores"] as const;

export type { Fornecedor };

export function useFornecedores() {
  return useQuery({
    queryKey: QK,
    queryFn: () => vendorService.fetchAll(),
    staleTime: STALE_TIME,
  });
}

export function useSalvarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { id?: string; data: Record<string, any> }) => 
      vendorService.save(payload.id, payload.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeletarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => vendorService.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useToggleFornecedorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { id: string; ativo: boolean }) => 
      vendorService.toggleActive(params.id, params.ativo),
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
