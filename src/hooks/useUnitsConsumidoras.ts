import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useUnitsConsumidorasForLink(search: string) {
  return useQuery({
    queryKey: ["ucs_for_link", search],
    queryFn: async () => {
      let q = supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("is_archived", false)
        .order("nome")
        .limit(20);
      if (search) q = q.or(`nome.ilike.%${search}%,codigo_uc.ilike.%${search}%`);
      const { data } = await q;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

export function useActiveUnitMeterLinks() {
  return useQuery({
    queryKey: ["unit_meter_links_active_for_dialog"],
    queryFn: async () => {
      const { data } = await supabase
        .from("unit_meter_links")
        .select("unit_id")
        .eq("is_active", true);
      return (data || []).map((l) => l.unit_id);
    },
    staleTime: 1000 * 60 * 2,
  });
}
