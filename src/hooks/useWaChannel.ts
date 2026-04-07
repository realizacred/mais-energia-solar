/**
 * useWaChannel — Query para resolver canal WhatsApp por slug.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaChannelData {
  consultor_nome: string;
  slug: string;
  phone_number: string;
  tenant_id: string;
}

export function useWaChannel(slug: string | undefined) {
  return useQuery({
    queryKey: ["wa-channel", slug],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resolve-wa-channel", {
        body: { slug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as WaChannelData;
    },
    enabled: !!slug,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}
