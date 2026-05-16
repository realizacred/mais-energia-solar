import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrityFinding {
  id: string;
  tenant_id: string;
  domain: 'projections' | 'propostas' | 'financeiro' | 'whatsapp' | 'jobs' | 'timeline';
  severity: 'critical' | 'warning' | 'info';
  entity_type: string;
  entity_id: string;
  title: string;
  description: string;
  recommended_action: string;
  detected_at: string;
}

/**
 * Hook to fetch system integrity findings via RPC.
 * Centralizes the auditing logic on the backend for performance and security.
 */
export function useSystemIntegrity() {
  return useQuery({
    queryKey: ["system-integrity-findings"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_system_integrity_findings");

      if (error) {
        console.error("[Integrity] Error fetching findings:", error);
        throw error;
      }

      return (data || []) as IntegrityFinding[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes cache
    refetchOnWindowFocus: false,
  });
}
