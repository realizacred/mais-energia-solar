import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Modulo } from "./types";
import { MODULO_QUERY_KEY, MODULOS_SELECT } from "./types";

export function useModulos() {
  return useQuery({
    queryKey: [...MODULO_QUERY_KEY],
    queryFn: async () => {
      // Fetch ALL modules with pagination to bypass Supabase 1000-row default limit
      const allData: Modulo[] = [];
      const batchSize = 1000;
      let offset = 0;

      while (true) {
        const { data, error } = await supabase
          .from("modulos_solares")
          .select(MODULOS_SELECT)
          .order("fabricante")
          .order("potencia_wp", { ascending: false })
          .range(offset, offset + batchSize - 1);

        if (error) throw error;
        if (!data || data.length === 0) break;

        allData.push(...(data as unknown as Modulo[]));
        if (data.length < batchSize) break;
        offset += batchSize;
      }

      return allData;
    },
  });
}

export function useModuloMutations() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const saveMutation = useMutation({
    mutationFn: async ({ id, payload }: { id?: string; payload: Record<string, unknown> }) => {
      if (id) {
        const { error } = await supabase.from("modulos_solares").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modulos_solares").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      toast({ title: vars.id ? "Módulo atualizado" : "Módulo cadastrado" });
    },
    onError: (err: any) => {
      const msg = err.message?.includes("modulos_solares_fab_modelo_potencia_key")
        ? "Já existe um módulo com este fabricante, modelo e potência."
        : err.message;
      toast({ title: "Erro ao salvar", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modulos_solares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] });
      toast({ title: "Módulo excluído" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("modulos_solares").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [...MODULO_QUERY_KEY] }),
  });

  return { saveMutation, deleteMutation, toggleMutation };
}
