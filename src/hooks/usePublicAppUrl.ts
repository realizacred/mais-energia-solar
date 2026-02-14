import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";

/**
 * Hook that resolves the public app URL with DB override support.
 *
 * Resolution order:
 * 1. `integration_configs.public_app_url` (DB, editable via Admin UI)
 * 2. `VITE_PUBLIC_URL` env var (build-time)
 * 3. `window.location.origin` (fallback)
 *
 * SECURITY: This URL is for public links ONLY (canonical, OG, share links, QR codes).
 * NEVER use this for OAuth callbacks or security-sensitive redirects.
 */
export function usePublicAppUrl(): { url: string; isLoading: boolean } {
  const { data, isLoading } = useQuery({
    queryKey: ["public_app_url"],
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_configs")
        .select("api_key")
        .eq("service_key", "public_app_url")
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data?.api_key) return null;
      return data.api_key.replace(/\/+$/, "");
    },
  });

  return {
    url: data || getPublicUrl(),
    isLoading,
  };
}
