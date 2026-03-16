/**
 * Charts Registry — resolves chart configs from the catalog.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ProposalChart } from "./charts-types";

/**
 * Fetch all active charts for the current tenant.
 */
export async function fetchActiveCharts(tenantId: string): Promise<ProposalChart[]> {
  const { data, error } = await supabase
    .from("proposal_charts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .order("name");

  if (error) {
    console.error("[charts-registry] Error fetching charts:", error);
    return [];
  }

  return (data ?? []) as unknown as ProposalChart[];
}

/**
 * Find a chart by its placeholder key.
 */
export async function findChartByPlaceholder(
  tenantId: string,
  placeholder: string
): Promise<ProposalChart | null> {
  const { data, error } = await supabase
    .from("proposal_charts")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("placeholder", placeholder)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("[charts-registry] Error finding chart:", error);
    return null;
  }

  return data as unknown as ProposalChart | null;
}
