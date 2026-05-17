
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PortalProject {
  id: string;
  nome: string | null;
  projeto_num: number | null;
  codigo: string | null;
  etapa_id: string | null;
  etapa_nome: string | null;
  etapa_cor: string | null;
  status: string;
  potencia_kwp: number | null;
  valor_total: number | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  consultor_id: string | null;
  consultor_nome: string | null;
  consultor_telefone: string | null;
  tenant_id: string;
  brand: { logo_url?: string; color_primary?: string; company_name?: string };
  portal_ativo: boolean;
  address?: {
    cep?: string;
    rua?: string;
    numero?: string;
    bairro?: string;
    cidade?: string;
    estado?: string;
  };
}

export function usePortalProject(token: string | undefined) {
  return useQuery({
    queryKey: ["portal_project", token],
    queryFn: async () => {
      if (!token) throw new Error("Token não fornecido");
      
      const { data, error } = await supabase.rpc("resolve_portal_token", { p_token: token });
      if (error) throw error;
      
      const parsed = data as any;
      if (parsed?.error) throw new Error(parsed.error);
      
      return parsed as PortalProject;
    },
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
  });
}
