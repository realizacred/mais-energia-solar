import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useOperationalProjection = (projectId?: string) => {
  return useQuery({
    queryKey: ["operational-projection", projectId],
    queryFn: async () => {
      let query = (supabase as any)
        .from("project_operational_projection")
        .select("*");

      if (projectId) {
        query = query.eq("project_id", projectId).maybeSingle();
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });
};

export const useOperationalListProjection = () => {
  return useQuery({
    queryKey: ["operational-list-projection"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_operational_projection")
        .select("*")
        .order("last_updated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
};
