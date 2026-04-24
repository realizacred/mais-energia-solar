/**
 * useMigracaoSolarmarket — Estado consolidado do wizard de Migração SolarMarket.
 *
 * Retorna contadores de staging, contadores migrados (CRM), step ativo do wizard
 * e flags auxiliares. RB-04 / RB-05.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSolarmarketImport } from "@/hooks/useSolarmarketImport";

export type MigracaoStep = 1 | 2 | 3;

export interface MigracaoStats {
  // Staging (área de revisão)
  staging: {
    clientes: number;
    projetos: number;
    propostas: number;
    funis: number;
    custom_fields: number;
    projeto_funis: number;
  };
  // CRM já migrado
  migrado: {
    clientes_sm: number;
    projetos_sm: number;
    propostas_sm: number;
  };
  totalStaging: number;
}

const STATS_KEY = ["sm-migracao-stats"] as const;

export function useMigracaoSolarmarket() {
  const { jobs, importAll, cancelImport, testConnection } = useSolarmarketImport();

  const runningJob = jobs.find(
    (j) => j.status === "pending" || j.status === "running",
  );
  const isImporting = !!runningJob;

  const statsQuery = useQuery<MigracaoStats>({
    queryKey: STATS_KEY,
    staleTime: isImporting ? 0 : 1000 * 30,
    refetchInterval: isImporting ? 3000 : false,
    queryFn: async () => {
      const stagingTables = [
        "sm_clientes_raw",
        "sm_projetos_raw",
        "sm_propostas_raw",
        "sm_funis_raw",
        "sm_custom_fields_raw",
        "sm_projeto_funis_raw",
      ] as const;

      const stagingResults = await Promise.all(
        stagingTables.map((t) =>
          (supabase as any).from(t).select("id", { count: "exact", head: true }),
        ),
      );

      // Conta o que já foi promovido para o CRM (origem solar_market).
      // Para projeto/proposta, só consideramos migrado quando o vínculo comercial
      // foi concluído (deal_id preenchido), evitando falso positivo no painel.
      const [clientesMig, projetosMig, propostasMig] = await Promise.all([
        (supabase as any)
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .or("external_source.eq.solar_market,external_source.eq.solarmarket"),
        (supabase as any)
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .or("external_source.eq.solar_market,external_source.eq.solarmarket")
          .not("deal_id", "is", null),
        (supabase as any)
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .or("external_source.eq.solar_market,external_source.eq.solarmarket")
          .not("deal_id", "is", null),
      ]);

      const staging = {
        clientes: stagingResults[0].count ?? 0,
        projetos: stagingResults[1].count ?? 0,
        propostas: stagingResults[2].count ?? 0,
        funis: stagingResults[3].count ?? 0,
        custom_fields: stagingResults[4].count ?? 0,
        projeto_funis: stagingResults[5].count ?? 0,
      };

      return {
        staging,
        migrado: {
          clientes_sm: clientesMig.count ?? 0,
          projetos_sm: projetosMig.count ?? 0,
          propostas_sm: propostasMig.count ?? 0,
        },
        totalStaging:
          staging.clientes +
          staging.projetos +
          staging.propostas +
          staging.funis +
          staging.custom_fields +
          staging.projeto_funis,
      };
    },
  });

  const stats = statsQuery.data;

  // Lógica do step ativo:
  // - Staging vazio                              → 1 (importar)
  // - Tem staging e nada migrado                 → 2 (mapear)
  // - Tem staging e algo migrado                 → 3 (migrar / concluído)
  const currentStep: MigracaoStep = (() => {
    if (!stats) return 1;
    if (stats.totalStaging === 0) return 1;
    const algoMigrado =
      stats.migrado.clientes_sm > 0 ||
      stats.migrado.projetos_sm > 0 ||
      stats.migrado.propostas_sm > 0;
    if (!algoMigrado) return 2;
    return 3;
  })();

  const stagingPronto =
    !!stats &&
    stats.staging.clientes > 0 &&
    stats.staging.projetos > 0;

  return {
    stats,
    isLoading: statsQuery.isLoading,
    currentStep,
    stagingPronto,
    isImporting,
    runningJob,
    importAll,
    cancelImport,
    testConnection,
  };
}
