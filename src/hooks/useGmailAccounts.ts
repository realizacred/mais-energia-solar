/**
 * useGmailAccounts — Hook para gerenciamento de contas Gmail.
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GmailAccount {
  id: string;
  tenant_id: string;
  nome: string;
  email: string | null;
  concessionaria_nome: string | null;
  gmail_label: string | null;
  credentials: Record<string, any> | null;
  settings: Record<string, any> | null;
  is_active: boolean;
  verificar_a_cada_minutos: number;
  ultimo_verificado_at: string | null;
  created_at: string;
  updated_at: string;
}

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "gmail_accounts" as const;

export function useGmailAccounts() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gmail_accounts")
        .select("id, tenant_id, nome, email, concessionaria_nome, gmail_label, is_active, verificar_a_cada_minutos, ultimo_verificado_at, settings, created_at, updated_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as GmailAccount[];
    },
    staleTime: STALE_TIME,
  });
}

export function useDeletarGmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("gmail_accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useToggleGmailAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("gmail_accounts")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
