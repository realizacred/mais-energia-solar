/**
 * useSmSyncProgress — Real-time sync progress from DB.
 * §16: Query in hook. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SmSyncProgressData {
  totalProjects: number;
  projectsScanned: number;
  projectsRemaining: number;
  totalProposals: number;
  proposalsMigrated: number;
  proposalsPending: number;
  totalClients: number;
  scanPercent: number;
}

export function useSmSyncProgress() {
  return useQuery({
    queryKey: ["sm-sync-progress"],
    queryFn: async () => {
      const [projRes, scannedRes, propRes, migratedRes, clientRes] = await Promise.all([
        (supabase as any).from("solar_market_projects").select("id", { count: "exact", head: true }),
        (supabase as any).from("solar_market_projects").select("id", { count: "exact", head: true }).not("proposals_synced_at", "is", null),
        (supabase as any).from("solar_market_proposals").select("id", { count: "exact", head: true }),
        (supabase as any).from("solar_market_proposals").select("id", { count: "exact", head: true }).not("migrado_em", "is", null),
        (supabase as any).from("solar_market_clients").select("id", { count: "exact", head: true }),
      ]);

      const totalProjects = projRes.count ?? 0;
      const projectsScanned = scannedRes.count ?? 0;
      const totalProposals = propRes.count ?? 0;
      const proposalsMigrated = migratedRes.count ?? 0;
      const totalClients = clientRes.count ?? 0;

      return {
        totalProjects,
        projectsScanned,
        projectsRemaining: totalProjects - projectsScanned,
        totalProposals,
        proposalsMigrated,
        proposalsPending: totalProposals - proposalsMigrated,
        totalClients,
        scanPercent: totalProjects > 0 ? Math.round((projectsScanned / totalProjects) * 100) : 0,
      } as SmSyncProgressData;
    },
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  });
}
