/**
 * usePropostaGrupoToken
 * Hook para criar e buscar grupos de kits de propostas.
 * RB-04, RB-05
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface CreateGrupoParams {
  projeto_id: string;
  proposta_ids: string[];
  titulo: string;
  expires_days?: number;
}

interface CreateGrupoResult {
  token: string;
  url: string;
  id: string;
}

export function useCreateGrupoKit() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateGrupoParams): Promise<CreateGrupoResult> => {
      const { data, error } = await supabase.functions.invoke("proposta-kit-token", {
        method: "POST",
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as CreateGrupoResult;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["proposta-grupo-tokens", vars.projeto_id] });
      toast({ title: "Link de kits criado!", description: "Copie e envie ao cliente." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar link de kits", description: err.message, variant: "destructive" });
    },
  });
}

export function useGruposKitByProjeto(projetoId: string | undefined) {
  return useQuery({
    queryKey: ["proposta-grupo-tokens", projetoId],
    enabled: !!projetoId,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposta_grupo_tokens")
        .select("id, token, titulo, proposta_ids, expires_at, view_count, kit_aceito_id, created_at")
        .eq("projeto_id", projetoId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Array<{
        id: string;
        token: string;
        titulo: string;
        proposta_ids: string[];
        expires_at: string | null;
        view_count: number;
        kit_aceito_id: string | null;
        created_at: string;
      }>;
    },
  });
}

/** Public hook - fetch grupo data via edge function (no auth required) */
export function useGrupoKitPublic(token: string | undefined) {
  return useQuery({
    queryKey: ["grupo-kit-public", token],
    enabled: !!token,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("proposta-kit-token", {
        method: "GET",
        body: undefined,
        headers: { "Content-Type": "application/json" },
      });
      // Edge function GET needs token as query param - use fetch directly
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const res = await fetch(
        `${supabaseUrl}/functions/v1/proposta-kit-token?token=${token}`,
        {
          headers: {
            apikey: anonKey,
            "Content-Type": "application/json",
          },
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return await res.json();
    },
  });
}
