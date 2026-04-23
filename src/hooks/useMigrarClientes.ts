/**
 * useMigrarClientes — Wrapper fino da Etapa 1 da migração SolarMarket.
 *
 * Apenas invoca `useSolarmarketPromote().promoteAll` com `scope: "cliente"`.
 * Não duplica lógica — SSOT no hook canônico.
 *
 * Governança: RB-04 (queries em hook), RB-05 (staleTime herdado),
 *             AGENTS BP-04 (lógica em hook, não em componente).
 */
import { useSolarmarketPromote } from "@/hooks/useSolarmarketPromote";

export function useMigrarClientes() {
  const { promoteAll, jobs } = useSolarmarketPromote();

  return {
    /** Executa a etapa (dry-run ou real) somente para clientes. */
    run: (params: { batch_limit: number; dry_run: boolean }) =>
      promoteAll.mutateAsync({ ...params, scope: "cliente" }),
    isPending: promoteAll.isPending,
    /** Jobs filtrados por scope=cliente (filters.scope persistido pela edge). */
    jobs: jobs.filter((j) => (j.filters as { scope?: string } | null)?.scope === "cliente"),
  };
}
