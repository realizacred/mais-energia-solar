/**
 * useEnergiaDashboard — Hook for consolidated energy dashboard data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 2; // 2 min — operational dashboard

export interface UCRow {
  id: string;
  tenant_id: string;
  nome: string;
  codigo_uc: string;
  papel_gd: string | null;
  status: string | null;
  categoria_gd: string | null;
}

export interface GDGroupRow {
  id: string;
  tenant_id: string;
  nome: string;
  status: string | null;
  uc_geradora_id: string | null;
}

export function useUCsList() {
  return useQuery({
    queryKey: ["energia-dashboard-ucs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units_consumidoras")
        .select("id, tenant_id, nome, codigo_uc, papel_gd, status, categoria_gd")
        .neq("status", "archived")
        .order("nome");
      if (error) throw error;
      return (data || []) as UCRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useGDGroups() {
  return useQuery({
    queryKey: ["energia-dashboard-gd-groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gd_groups")
        .select("id, tenant_id, nome, status, uc_geradora_id")
        .order("nome");
      if (error) throw error;
      return (data || []) as GDGroupRow[];
    },
    staleTime: STALE_TIME,
  });
}

export function useGDGroupBeneficiaries() {
  return useQuery({
    queryKey: ["energia-dashboard-gd-beneficiaries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gd_group_beneficiaries")
        .select("id, gd_group_id, uc_beneficiaria_id, allocation_percent");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useMeterDevicesStatus() {
  return useQuery({
    queryKey: ["energia-dashboard-meters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("meter_devices")
        .select("id, tenant_id, name, online_status, last_seen_at, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useUnitMeterLinks() {
  return useQuery({
    queryKey: ["energia-dashboard-unit-meter-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_meter_links")
        .select("unit_id, meter_device_id, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}
