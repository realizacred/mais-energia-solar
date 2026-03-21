/**
 * Hook para gerenciar visitas técnicas.
 * §16: Queries em hooks — §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface VisitaTecnica {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  cliente_id: string | null;
  consultor_id: string | null;
  data_hora: string;
  duracao_minutos: number;
  endereco: string | null;
  status: string;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const QK = "visitas_tecnicas";
const STALE_TIME = 1000 * 60 * 5;

export function useVisitasTecnicas(mes?: number, ano?: number) {
  return useQuery<VisitaTecnica[]>({
    queryKey: [QK, mes, ano],
    queryFn: async () => {
      let q = supabase
        .from("visitas_tecnicas" as any)
        .select("*")
        .order("data_hora", { ascending: true });

      if (mes !== undefined && ano !== undefined) {
        const start = new Date(ano, mes, 1).toISOString();
        const end = new Date(ano, mes + 1, 0, 23, 59, 59).toISOString();
        q = q.gte("data_hora", start).lte("data_hora", end);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as VisitaTecnica[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCriarVisita() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Omit<VisitaTecnica, "id" | "created_at" | "updated_at" | "tenant_id">) => {
      const { data, error } = await supabase
        .from("visitas_tecnicas" as any)
        .insert(payload as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Visita agendada com sucesso!");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: Error) => toast.error(`Erro ao agendar: ${e.message}`),
  });
}

export function useAtualizarVisita() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<VisitaTecnica> & { id: string }) => {
      const { data, error } = await supabase
        .from("visitas_tecnicas" as any)
        .update(payload as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Visita atualizada!");
      qc.invalidateQueries({ queryKey: [QK] });
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
