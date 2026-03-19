/**
 * Central de Ajuda — hooks de dados
 * §16: Queries só em hooks
 * §23: staleTime obrigatório
 *
 * NOTE: Tables help_center_tutorials / help_center_progresso are not yet
 * in the auto-generated Supabase types. We cast `.from()` via `as any`
 * until the types are regenerated.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Tutorial {
  id: string;
  categoria: string;
  slug: string;
  titulo: string;
  descricao_curta: string | null;
  conteudo: string;
  ordem: number;
  icon: string | null;
  video_url: string | null;
  imagens: string[];
  tags: string[];
  is_destaque: boolean;
  created_at: string;
}

export interface ProgressoTutorial {
  id: string;
  user_id: string;
  tutorial_id: string;
  concluido: boolean;
  ultimo_acesso: string;
}

const STALE_TUTORIALS = 1000 * 60 * 15; // 15 min — conteúdo estático
const STALE_SEARCH = 1000 * 60 * 5;     // 5 min
const STALE_PROGRESS = 1000 * 60 * 5;   // 5 min

/**
 * Lista tutoriais, opcionalmente filtrados por categoria.
 */
export function useTutoriais(categoria?: string | null) {
  return useQuery({
    queryKey: ["help-tutorials", categoria ?? "all"],
    queryFn: async () => {
      let query = (supabase as any)
        .from("help_center_tutorials")
        .select("*")
        .order("ordem", { ascending: true });

      if (categoria) {
        query = query.eq("categoria", categoria);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Tutorial[];
    },
    staleTime: STALE_TUTORIALS,
  });
}

/**
 * Busca tutoriais por texto (título, descrição).
 * Mínimo 3 caracteres.
 */
export function useBuscarTutoriais(queryStr: string) {
  const trimmed = queryStr.trim().toLowerCase();

  return useQuery({
    queryKey: ["help-tutorials-search", trimmed],
    queryFn: async () => {
      if (trimmed.length < 3) return [];

      const { data, error } = await (supabase as any)
        .from("help_center_tutorials")
        .select("*")
        .or(`titulo.ilike.%${trimmed}%,descricao_curta.ilike.%${trimmed}%`)
        .order("ordem", { ascending: true })
        .limit(20);

      if (error) throw error;
      return (data ?? []) as Tutorial[];
    },
    staleTime: STALE_SEARCH,
    enabled: trimmed.length >= 3,
  });
}

/**
 * Progresso do usuário autenticado.
 */
export function useProgressoUsuario() {
  return useQuery({
    queryKey: ["help-progress"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("help_center_progresso")
        .select("*");

      if (error) throw error;
      return (data ?? []) as ProgressoTutorial[];
    },
    staleTime: STALE_PROGRESS,
  });
}

/**
 * Marca tutorial como concluído (upsert).
 */
export function useMarcarTutorialConcluido() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (tutorialId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const { error } = await (supabase as any)
        .from("help_center_progresso")
        .upsert(
          {
            user_id: user.id,
            tutorial_id: tutorialId,
            concluido: true,
            ultimo_acesso: new Date().toISOString(),
          },
          { onConflict: "user_id,tutorial_id" }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["help-progress"] });
    },
  });
}
