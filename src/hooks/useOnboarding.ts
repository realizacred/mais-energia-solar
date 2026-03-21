import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const QUERY_KEY = "onboarding-status" as const;

export function useOnboardingStatus(tenantId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, tenantId],
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenants")
        .select("onboarding_completed, onboarding_step")
        .eq("id", tenantId)
        .single();
      if (error) throw error;
      return data as { onboarding_completed: boolean; onboarding_step: number };
    },
    staleTime: 1000 * 60 * 15,
    enabled: !!tenantId,
  });
}

export function useUpdateOnboardingStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, step }: { tenantId: string; step: number }) => {
      const { error } = await supabase
        .from("tenants")
        .update({ onboarding_step: step })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: (_, { tenantId }) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}

export function useCompleteOnboarding() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const { error } = await supabase
        .from("tenants")
        .update({ onboarding_completed: true, onboarding_step: 4 })
        .eq("id", tenantId);
      if (error) throw error;
    },
    onSuccess: (_, tenantId) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, tenantId] });
    },
  });
}
