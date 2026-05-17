import { supabase } from "@/integrations/supabase/client";

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

export const vendorService = {
  async fetchAll(): Promise<Fornecedor[]> {
    const { data, error } = await supabase
      .from("fornecedores")
      .select("id, nome, tipo, cnpj, inscricao_estadual, telefone, email, contato_nome, contato_telefone, endereco, cidade, estado, cep, site, categorias, observacoes, ativo, created_at, updated_at")
      .order("nome");
    if (error) throw error;
    return (data ?? []) as unknown as Fornecedor[];
  },

  async save(id: string | undefined, data: Record<string, any>) {
    if (id) {
      const { error } = await supabase
        .from("fornecedores")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("fornecedores")
        .insert([data] as any);
      if (error) throw error;
    }
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("fornecedores")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async toggleActive(id: string, ativo: boolean) {
    const { error } = await supabase
      .from("fornecedores")
      .update({ ativo })
      .eq("id", id);
    if (error) throw error;
  }
};
