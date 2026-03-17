import { useQuery } from "@tanstack/react-query";
import { meterService } from "@/services/meterService";
import { supabase } from "@/integrations/supabase/client";

interface MeterListFilters {
  online_status?: string;
  search?: string;
}

interface UCBasic {
  id: string;
  nome: string;
  codigo_uc: string | null;
}

export function useMetersListData(filters: MeterListFilters) {
  const { data: meters = [], isLoading, error } = useQuery({
    queryKey: ["meter_devices", filters.online_status, filters.search],
    queryFn: () =>
      meterService.list({
        online_status: filters.online_status !== "all" ? filters.online_status : undefined,
        search: filters.search || undefined,
      }),
    staleTime: 60 * 1000,
  });

  const { data: activeLinks = [] } = useQuery({
    queryKey: ["unit_meter_links_active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_meter_links")
        .select("meter_device_id, unit_id")
        .eq("is_active", true);
      return data || [];
    },
    staleTime: 2 * 60 * 1000,
  });

  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_meters"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("is_archived", false);
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const linkMap = new Map(activeLinks.map((l) => [l.meter_device_id, l.unit_id]));
  const ucMap = new Map(ucs.map((u) => [u.id, u]));

  function getLinkedUC(meterId: string) {
    const unitId = linkMap.get(meterId);
    if (!unitId) return null;
    return ucMap.get(unitId) || null;
  }

  return { meters, isLoading, error, getLinkedUC };
}
