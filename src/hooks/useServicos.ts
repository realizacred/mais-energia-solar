import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useServicosData() {
  return useQuery({
    queryKey: ["servicos-data"],
    queryFn: async () => {
      const [servicosRes, clientesRes, profilesRes] = await Promise.all([
        supabase
          .from("servicos_agendados")
          .select(`
            id, tipo, status, data_agendada, hora_inicio, endereco, bairro, cidade,
            descricao, instalador_id, cliente:clientes(id, nome, telefone, bairro, cidade),
            fotos_urls, audio_url, video_url, layout_modulos, validado
          `)
          .order("data_agendada", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome, telefone, bairro, cidade")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("profiles")
          .select("user_id, nome")
          .eq("ativo", true),
      ]);

      if (servicosRes.error) throw servicosRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (profilesRes.error) throw profilesRes.error;

      // Filter instaladores - only those with instalador role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instalador");

      const instaladorIds = roleData?.map(r => r.user_id) || [];
      const instaladores = profilesRes.data
        ?.filter(p => instaladorIds.includes(p.user_id))
        .map(p => ({ id: p.user_id, nome: p.nome })) || [];

      return {
        servicos: servicosRes.data || [],
        clientes: clientesRes.data || [],
        instaladores,
      };
    },
    staleTime: STALE_TIME,
  });
}

export function useRefreshServicos() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["servicos-data"] });
}
