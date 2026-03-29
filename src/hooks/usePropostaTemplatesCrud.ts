/**
 * Hook para CRUD de proposta_templates (TemplatesManager).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropostaTemplateFull {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  template_html: string | null;
  file_url: string | null;
  thumbnail_url: string | null;
  ativo: boolean;
  ordem: number;
}

const QUERY_KEY = "proposta-templates-crud" as const;
const STALE_TIME = 1000 * 60 * 5;

export function usePropostaTemplatesCrud() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_templates")
        .select("id, nome, descricao, grupo, categoria, tipo, file_url, thumbnail_url, ativo, ordem")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data as PropostaTemplateFull[]) || [];
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch template_html on demand (can be very large JSON) */
export function usePropostaTemplateHtml(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, "html", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("proposta_templates")
        .select("template_html")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data?.template_html as string | null;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useSalvarPropostaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown> & { id?: string }) => {
      const { id, ...rest } = payload;
      if (id && id !== "new") {
        const { error } = await supabase
          .from("proposta_templates")
          .update(rest as any)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("proposta_templates")
          .insert(rest as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["proposta-templates-active"] });
    },
  });
}

export function useDeletarPropostaTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Desvincular versões que referenciam este template
      const { error: versionsError } = await supabase
        .from("proposta_versoes" as any)
        .update({ template_id_used: null } as any)
        .eq("template_id_used", id);
      if (versionsError) console.warn("[useDeletarPropostaTemplate] Erro ao desvincular versões:", versionsError.message);

      const { error } = await supabase
        .from("proposta_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      qc.invalidateQueries({ queryKey: ["proposta-templates-active"] });
    },
  });
}

export function useAtualizarTemplateHtml() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, template_html }: { id: string; template_html: string }) => {
      const { error } = await supabase
        .from("proposta_templates")
        .update({ template_html } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
