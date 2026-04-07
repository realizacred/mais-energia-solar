/**
 * useGoogleMapsConfig — Query para configuração Google Maps.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GoogleMapsConfigData {
  id: string;
  service_key: string;
  api_key: string;
  is_active: boolean;
  last_validated_at: string | null;
  updated_at: string;
}

export function useGoogleMapsConfig() {
  return useQuery({
    queryKey: ["integration-config", "google_maps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("id, service_key, api_key, is_active, last_validated_at, updated_at")
        .eq("service_key", "google_maps")
        .maybeSingle();
      if (error) throw error;
      return data as GoogleMapsConfigData | null;
    },
    staleTime: 1000 * 60 * 5,
  });
}
