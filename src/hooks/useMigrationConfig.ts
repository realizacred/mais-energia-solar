/**
 * useMigrationConfig — configurações padrão da migração SolarMarket
 * (pipeline padrão e consultor padrão usados como fallback).
 *
 * Governança:
 *  - RB-04: query em hook dedicado
 *  - RB-05: staleTime obrigatório
 *  - RB-58: mutation usa .select() para confirmar gravação
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface MigrationConfigRow {
  tenant_id: string;
  default_pipeline_id: string | null;
  default_consultor_id: string | null;
}

export function useMigrationConfig(tenantId: string | null | undefined) {
  return useQuery<MigrationConfigRow | null>({
    queryKey: ["solarmarket-migration-config", tenantId],
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      // Tipos gerados ainda não incluem a tabela recém-criada.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (
              c: string,
              v: string,
            ) => {
              maybeSingle: () => Promise<{ data: MigrationConfigRow | null; error: { message: string } | null }>;
            };
          };
        };
      })
        .from("solarmarket_migration_config")
        .select("tenant_id, default_pipeline_id, default_consultor_id")
        .eq("tenant_id", tenantId!)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data ?? null) as MigrationConfigRow | null;
    },
  });
}

interface SaveInput {
  tenantId: string;
  defaultPipelineId?: string | null;
  defaultConsultorId?: string | null;
}

export function useSaveMigrationConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, defaultPipelineId, defaultConsultorId }: SaveInput) => {
      const row: Record<string, unknown> = { tenant_id: tenantId };
      if (defaultPipelineId !== undefined) row.default_pipeline_id = defaultPipelineId;
      if (defaultConsultorId !== undefined) row.default_consultor_id = defaultConsultorId;

      // Tipos gerados ainda não incluem a tabela recém-criada.
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (
            r: Record<string, unknown>,
            o: { onConflict: string },
          ) => { select: (c: string) => Promise<{ data: unknown[] | null; error: { message: string } | null }> };
        };
      })
        .from("solarmarket_migration_config")
        .upsert(row, { onConflict: "tenant_id" })
        .select("tenant_id");

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Falha ao salvar configuração padrão.");
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["solarmarket-migration-config", vars.tenantId] });
    },
  });
}
