/**
 * useMigrarProjetos — Wrapper fino da Etapa 2 da migração SolarMarket.
 *
 * Apenas invoca `useSolarmarketPromote().promoteAll` com `scope: "projeto"`.
 * Não duplica lógica — SSOT no hook canônico.
 */
import { useSolarmarketPromote } from "@/hooks/useSolarmarketPromote";

export function useMigrarProjetos() {
  const { promoteAll, jobs } = useSolarmarketPromote();

  return {
    run: (params: { batch_limit: number; dry_run: boolean }) =>
      promoteAll.mutateAsync({ ...params, scope: "projeto" }),
    isPending: promoteAll.isPending,
    jobs: jobs.filter((j) => (j.filters as { scope?: string } | null)?.scope === "projeto"),
  };
}
