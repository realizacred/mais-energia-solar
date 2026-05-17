import { supabase } from "@/integrations/supabase/client";

export interface VendedorResolved {
  id: string | null;
  nome: string | null;
  codigo: string | null;
}

export interface Vendedor {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  codigo: string | null;
  slug: string | null;
  ativo: boolean;
  user_id: string | null;
  created_at: string;
  percentual_comissao: number | null;
}

export const consultantService = {
  async fetchAll(): Promise<Vendedor[]> {
    const { data, error } = await supabase
      .from("consultores")
      .select("id, nome, telefone, email, codigo, slug, ativo, user_id, created_at, percentual_comissao")
      .order("nome");
    if (error) throw error;
    return (data || []) as Vendedor[];
  },

  async fetchActiveProfiles() {
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, nome")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return data || [];
  },

  async resolveFromCode(codigo: string): Promise<VendedorResolved | null> {
    const { data, error } = await supabase.rpc("validate_consultor_code", {
      _codigo: codigo,
    });

    if (error) {
      console.error("[consultantService] Erro ao validar vendedor:", error.message);
      return null;
    }

    const results = Array.isArray(data) ? data : data ? [data] : [];
    const result = results[0];
    if (!result?.valid || !result?.nome) return null;

    const { data: consultorRecord } = await supabase
      .rpc("resolve_consultor_public", { _codigo: codigo })
      .maybeSingle();

    return {
      id: (consultorRecord as any)?.id ?? null,
      nome: result.nome,
      codigo: codigo,
    };
  },

  async resolveFromUser(userId: string): Promise<VendedorResolved | null> {
    const { data, error } = await supabase
      .from("consultores")
      .select("id, nome, codigo")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    if (error) {
      console.error("[consultantService] Erro ao resolver vendedor logado:", error.message);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      nome: data.nome,
      codigo: data.codigo,
    };
  },

  async resolveIdOnly(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from("consultores")
      .select("id")
      .eq("user_id", userId)
      .eq("ativo", true)
      .maybeSingle();

    return (data as any)?.id ?? null;
  }
};

