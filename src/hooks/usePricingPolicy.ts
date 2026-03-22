/**
 * Hooks for Pricing Policy tabs (CostComponents, MarginCommission, PricingMethod).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

// ─── Cost Components ─────────────────────────────────────

export interface CostComponent {
  id: string;
  category: string;
  name: string;
  calculation_strategy: string;
  parameters: Record<string, any>;
  display_order: number;
  is_active: boolean;
  description: string | null;
}

export function useCostComponents(versionId: string) {
  return useQuery({
    queryKey: ["pricing_cost_components", versionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_cost_components")
        .select("id, category, name, calculation_strategy, parameters, display_order, is_active, description")
        .eq("version_id", versionId)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data as unknown as CostComponent[]) || [];
    },
    staleTime: STALE_TIME,
    enabled: !!versionId,
  });
}

export function useSaveCostComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionId, data }: { id?: string; versionId: string; data: Record<string, any> }) => {
      const payload = { ...data, version_id: versionId };
      if (id) {
        const { error } = await supabase.from("pricing_cost_components").update(payload as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pricing_cost_components").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pricing_cost_components", vars.versionId] });
    },
  });
}

export function useDeleteCostComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionId }: { id: string; versionId: string }) => {
      const { error } = await supabase.from("pricing_cost_components").delete().eq("id", id);
      if (error) throw error;
      return versionId;
    },
    onSuccess: (versionId) => {
      qc.invalidateQueries({ queryKey: ["pricing_cost_components", versionId] });
    },
  });
}

export function useToggleCostComponent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active, versionId }: { id: string; is_active: boolean; versionId: string }) => {
      const { error } = await supabase.from("pricing_cost_components").update({ is_active }).eq("id", id);
      if (error) throw error;
      return versionId;
    },
    onSuccess: (versionId) => {
      qc.invalidateQueries({ queryKey: ["pricing_cost_components", versionId] });
    },
  });
}

// ─── Margin Plans ─────────────────────────────────────

export interface MarginPlan {
  id: string;
  name: string;
  description: string | null;
  min_margin_percent: number;
  max_margin_percent: number;
  default_margin_percent: number;
  is_active: boolean;
}

export interface CommissionPlan {
  id: string;
  name: string;
  description: string | null;
  commission_type: "fixed" | "percentage" | "dynamic";
  parameters: Record<string, any>;
  is_active: boolean;
}

export function useMarginPlans() {
  return useQuery({
    queryKey: ["margin_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("margin_plans")
        .select("id, name, description, min_margin_percent, max_margin_percent, default_margin_percent, is_active")
        .order("created_at");
      if (error) throw error;
      return (data as unknown as MarginPlan[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveMarginPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("margin_plans").update(data as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("margin_plans").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["margin_plans"] });
    },
  });
}

export function useDeleteMarginPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("margin_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["margin_plans"] });
    },
  });
}

export function useCommissionPlans() {
  return useQuery({
    queryKey: ["commission_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_plans")
        .select("id, name, description, commission_type, parameters, is_active")
        .order("created_at");
      if (error) throw error;
      return (data as unknown as CommissionPlan[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveCommissionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await supabase.from("commission_plans").update(data as any).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("commission_plans").insert(data as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission_plans"] });
    },
  });
}

export function useDeleteCommissionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["commission_plans"] });
    },
  });
}

// ─── Pricing Method ─────────────────────────────────────

export interface PricingMethod {
  id: string;
  method_type: "margin_on_sale" | "margin_on_cost";
  default_margin_percent: number;
  default_tax_percent: number;
  kit_margin_override_percent: number | null;
  kit_tax_override_percent: number | null;
}

export function usePricingMethod(versionId: string) {
  return useQuery({
    queryKey: ["pricing_method", versionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pricing_methods")
        .select("id, method_type, default_margin_percent, default_tax_percent, kit_margin_override_percent, kit_tax_override_percent")
        .eq("version_id", versionId)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as PricingMethod | null;
    },
    staleTime: STALE_TIME,
    enabled: !!versionId,
  });
}

export function useSavePricingMethod() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, versionId, data }: { id?: string; versionId: string; data: Record<string, any> }) => {
      const payload = { ...data, version_id: versionId };
      if (id) {
        const { error } = await supabase.from("pricing_methods").update(payload as any).eq("id", id);
        if (error) throw error;
        return id;
      } else {
        const { data: ins, error } = await supabase.from("pricing_methods").insert(payload as any).select("id").single();
        if (error) throw error;
        return (ins as any).id as string;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["pricing_method", vars.versionId] });
    },
  });
}
