// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useSaveSiteSettings() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("site_settings").update(updates).eq("id", id);
      if (error) throw error;
    },
  });
}
