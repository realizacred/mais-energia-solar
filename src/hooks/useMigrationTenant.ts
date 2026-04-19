/**
 * useMigrationTenant — Resolve, lista e contabiliza tenants para o Migration Center.
 *
 * Hooks expostos:
 *   - useIsSuperAdmin()        → boolean: usuário é super_admin?
 *   - useCurrentTenantId()     → tenant_id do profile do usuário logado
 *   - useStagingCounts(tenantId)
 *       → { clients, projects, proposals, total } por tenant (contagem de staging SM)
 *   - useTenantsWithStaging()
 *       → lista de { id, nome, total_staging } — apenas tenants com staging > 0
 *
 * Política (RB-80):
 *   - Mapeamentos/decisões de tenant explícitas, sem fallback silencioso.
 *   - Super-admin pode trocar tenant; usuário comum só vê o próprio.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE = 1000 * 60 * 5;

export function useIsSuperAdmin() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user?.id,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data ?? []).some((r: any) => r.role === "super_admin");
    },
  });
}

export function useCurrentTenantId() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["current-tenant-id", user?.id],
    enabled: !!user?.id,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data?.tenant_id ?? null) as string | null;
    },
  });
}

export interface StagingCounts {
  clients: number;
  projects: number;
  proposals: number;
  total: number;
}

export function useStagingCounts(tenantId: string | null | undefined) {
  return useQuery({
    queryKey: ["migration-staging-counts", tenantId],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async (): Promise<StagingCounts> => {
      const [clients, projects, proposals] = await Promise.all([
        (supabase as any)
          .from("solar_market_clients")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("solar_market_projects")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
        (supabase as any)
          .from("solar_market_proposals")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId),
      ]);
      const c = clients.count ?? 0;
      const p = projects.count ?? 0;
      const pr = proposals.count ?? 0;
      return { clients: c, projects: p, proposals: pr, total: c + p + pr };
    },
  });
}

export interface TenantWithStaging {
  id: string;
  nome: string;
  total_staging: number;
}

/**
 * Tenants candidatos para migração: union dos tenants que têm registros
 * em qualquer tabela de staging SM. Apenas super_admin chama isso.
 */
export function useTenantsWithStaging(enabled: boolean) {
  return useQuery({
    queryKey: ["tenants-with-staging"],
    enabled,
    staleTime: STALE,
    queryFn: async (): Promise<TenantWithStaging[]> => {
      // Coleta tenant_ids distintos das 3 tabelas de staging
      const [c, p, pr] = await Promise.all([
        (supabase as any).from("solar_market_clients").select("tenant_id").limit(10000),
        (supabase as any).from("solar_market_projects").select("tenant_id").limit(10000),
        (supabase as any).from("solar_market_proposals").select("tenant_id").limit(10000),
      ]);
      const counts = new Map<string, number>();
      const bump = (rows: any[]) => {
        for (const r of rows ?? []) {
          if (!r?.tenant_id) continue;
          counts.set(r.tenant_id, (counts.get(r.tenant_id) ?? 0) + 1);
        }
      };
      bump(c.data ?? []);
      bump(p.data ?? []);
      bump(pr.data ?? []);
      const ids = Array.from(counts.keys());
      if (ids.length === 0) return [];

      const { data: tenants, error } = await supabase
        .from("tenants")
        .select("id, nome")
        .in("id", ids);
      if (error) throw error;

      return (tenants ?? [])
        .map((t: any) => ({
          id: t.id,
          nome: t.nome ?? "(sem nome)",
          total_staging: counts.get(t.id) ?? 0,
        }))
        .sort((a, b) => b.total_staging - a.total_staging);
    },
  });
}
