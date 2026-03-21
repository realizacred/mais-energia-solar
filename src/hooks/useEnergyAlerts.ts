/**
 * useEnergyAlerts — Hook for energy alerts (SSOT).
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EnergyAlert {
  id: string;
  tenant_id: string;
  gd_group_id: string | null;
  unit_id: string | null;
  plant_id: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string | null;
  context_json: Record<string, any>;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_at: string;
  // Joined data
  gd_groups?: { nome: string } | null;
  units_consumidoras?: { codigo_uc: string; titular: string } | null;
  monitor_plants?: { name: string } | null;
}

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "energy-alerts" as const;

export function useEnergyAlerts(filters?: {
  pending?: boolean;
  severity?: string;
  alert_type?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("energy_alerts")
        .select("*, gd_groups(nome), units_consumidoras(codigo_uc, titular), monitor_plants(name)")
        .order("created_at", { ascending: false })
        .limit(filters?.limit ?? 100);

      if (filters?.pending) {
        query = query.is("resolved_at", null);
      }
      if (filters?.severity) {
        query = query.eq("severity", filters.severity);
      }
      if (filters?.alert_type) {
        query = query.eq("alert_type", filters.alert_type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as EnergyAlert[];
    },
    staleTime: STALE_TIME,
  });
}

/** Client-facing: only critical/warning alerts for their units */
export function useClientEnergyAlerts(unitIds: string[]) {
  return useQuery({
    queryKey: [QUERY_KEY, "client", unitIds],
    queryFn: async () => {
      if (!unitIds.length) return [];
      const { data, error } = await (supabase as any)
        .from("energy_alerts")
        .select("id, alert_type, severity, title, description, created_at, resolved_at")
        .in("unit_id", unitIds)
        .is("resolved_at", null)
        .in("severity", ["warning", "critical"])
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as EnergyAlert[];
    },
    staleTime: STALE_TIME,
    enabled: unitIds.length > 0,
  });
}

export function useResolveEnergyAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { alertId: string; resolution_note?: string }) => {
      const { error } = await (supabase as any)
        .from("energy_alerts")
        .update({
          resolved_at: new Date().toISOString(),
          resolution_note: params.resolution_note || null,
        })
        .eq("id", params.alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
