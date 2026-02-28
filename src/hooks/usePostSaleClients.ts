import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PostSaleClient {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
}

export function usePostSaleClients() {
  return useQuery<PostSaleClient[]>({
    queryKey: ["post-sale-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, cidade")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}
