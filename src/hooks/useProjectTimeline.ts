import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TimelineEvent {
  id: string;
  project_id: string;
  event_type: string;
  title: string;
  description: string;
  metadata: any;
  created_at: string;
}

export const useProjectTimeline = (projectId: string) => {
  return useQuery({
    queryKey: ["project-timeline", projectId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("project_timeline_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as TimelineEvent[];
    },
    enabled: !!projectId,
  });
};
