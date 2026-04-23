/**
 * useMigrarPropostas — Wrapper fino da Etapa 3 da migração SolarMarket.
 *
 * Apenas invoca `useSolarmarketPromote().promoteAll` com `scope: "proposta"`.
 * Não duplica lógica — SSOT no hook canônico.
 */
import { useSolarmarketPromote } from "@/hooks/useSolarmarketPromote";

export function useMigrarPropostas() {
  const { promoteAll, jobs } = useSolarmarketPromote();

  return {
    run: (params: { batch_limit: number; dry_run: boolean }) =>
      promoteAll.mutateAsync({ ...params, scope: "proposta" }),
    isPending: promoteAll.isPending,
    jobs: jobs.filter(
      (j) =>
        (j.filters as { scope?: string } | null)?.scope === "proposta" ||
        !(j.filters as { scope?: string } | null)?.scope, // legado sem scope = proposta
    ),
  };
}
