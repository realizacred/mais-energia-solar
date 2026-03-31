/**
 * useFornecedores — Queries for FornecedoresManager.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min — cadastro

const QK = ["fornecedores"] as const;

export interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string | null;
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  site: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  tipo: string;
  categorias: string[];
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
}

export function useFornecedores() {
  return useQuery({
    queryKey: QK,
    queryFn: async (): Promise<Fornecedor[]> => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome, tipo, cnpj, inscricao_estadual, telefone, email, contato_nome, contato_telefone, endereco, cidade, estado, cep, site, categorias, observacoes, ativo, created_at, updated_at")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as unknown as Fornecedor[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSalvarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; data: Record<string, any> }) => {
      if (payload.id) {
        const { error } = await supabase.from("fornecedores").update(payload.data).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert([payload.data] as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useDeletarFornecedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}

export function useToggleFornecedorAtivo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("fornecedores").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK }),
  });
}
