import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = ["proposta-email-templates"];

export interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  corpo_texto: string | null;
  canal: string;
  is_default: boolean;
  ativo: boolean;
  ordem: number;
  variaveis: any[] | null;
}

export function useEmailTemplatesList() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("proposta_email_templates")
        .select("id, nome, assunto, corpo_html, corpo_texto, canal, is_default, ativo, ordem, variaveis")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as EmailTemplate[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: Record<string, any> }) => {
      if (id) {
        const { error } = await (supabase as any)
          .from("proposta_email_templates")
          .update(data)
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("proposta_email_templates")
          .insert(data);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDeleteEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("proposta_email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}

export function useDuplicateEmailTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { error } = await (supabase as any)
        .from("proposta_email_templates")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });
}
