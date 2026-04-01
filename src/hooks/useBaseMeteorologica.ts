/**
 * Hook para dados de BaseMeteorologicaPage.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DatasetRow, VersionRow } from "@/pages/admin/base-meteorologica/types";

const STALE_TIME = 1000 * 60 * 5;

// ─── Admin guard ──────────────────────────
export function useAdminGuard() {
  return useQuery({
    queryKey: ["admin-guard-meteorologica"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return "denied" as const;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) =>
        ["admin", "super_admin", "gerente"].includes(r.role)
      );
      return isAdmin ? ("authorized" as const) : ("denied" as const);
    },
    staleTime: 1000 * 60 * 15,
  });
}

// ─── Datasets + Versions ──────────────────────────
export function useIrradianceDatasetsAndVersions(enabled: boolean) {
  return useQuery({
    queryKey: ["irradiance-datasets-versions"],
    queryFn: async () => {
      const [dsRes, verRes] = await Promise.all([
        supabase.from("irradiance_datasets").select("id, code, name").order("code"),
        supabase
          .from("irradiance_dataset_versions")
          .select(
            "id, dataset_id, version_tag, source_note, ingested_at, checksum_sha256, row_count, status, metadata, created_at, updated_at"
          )
          .order("created_at", { ascending: false }),
      ]);
      if (dsRes.error) throw dsRes.error;
      if (verRes.error) throw verRes.error;
      return {
        datasets: (dsRes.data || []) as DatasetRow[],
        versions: (verRes.data || []) as VersionRow[],
      };
    },
    enabled,
    staleTime: STALE_TIME,
  });
}
