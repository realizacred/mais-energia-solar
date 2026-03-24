/**
 * useFormSelects — Shared hooks for select dropdowns across forms.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 * Replaces inline queries in UCFormDialog, GdGroupFormModal,
 * GdGroupDetailModal, GdBeneficiaryFormModal, GdGroupsPage.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClienteOption {
  id: string;
  nome: string;
  telefone?: string;
  cidade?: string;
  cpf_cnpj?: string;
  email?: string;
}

export interface UCOption {
  id: string;
  nome: string;
  codigo_uc: string;
  tipo_uc?: string;
  papel_gd?: string;
  concessionaria_id?: string;
}

/** Active clientes for select dropdowns */
export function useClientesList() {
  return useQuery({
    queryKey: ["clientes_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, telefone, cidade, cpf_cnpj, email")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return (data ?? []) as ClienteOption[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

/** Non-archived UCs for select dropdowns */
export function useUCsList(filters?: { tipo_uc_in?: string[] }) {
  return useQuery({
    queryKey: ["ucs_list", filters?.tipo_uc_in],
    queryFn: async () => {
      let q = supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, tipo_uc, papel_gd, concessionaria_id")
        .eq("is_archived", false)
        .order("nome");
      if (filters?.tipo_uc_in) {
        q = q.in("tipo_uc", filters.tipo_uc_in as any);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as UCOption[];
    },
    staleTime: 1000 * 60 * 5,
  });
}
