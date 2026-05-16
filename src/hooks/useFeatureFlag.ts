import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useFeatureFlag = (featureName: string) => {
  const { user } = useAuth();
  
  const { data: isEnabled, isLoading } = useQuery({
    queryKey: ["feature-flag", featureName, user?.id],
    queryFn: async () => {
      if (!user) return false;
      
      // Get the tenant_id first (this usually comes from a profiles or memberships table)
      // In this system, we can try to call the RPC directly if it's exposed, 
      // but let's assume we can fetch it via another query or if it's in the auth metadata.
      const { data: tenantIdData } = await supabase.rpc('get_user_tenant_id');
      
      if (!tenantIdData) return false;

      const { data, error } = await supabase
        .rpc('check_feature_flag', {
          p_feature_name: featureName,
          p_tenant_id: tenantIdData
        });

      if (error) {
        console.error(`Error checking feature flag ${featureName}:`, error);
        return false;
      }

      return data as boolean;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000, // 10 minutes cache
  });

  return { isEnabled, isLoading };
};
