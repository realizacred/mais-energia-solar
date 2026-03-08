import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export interface EstoqueCategoria {
  id: string;
  tenant_id: string;
  nome: string;
  slug: string;
  parent_id: string | null;
  ordem: number;
  ativo: boolean;
  created_at: string;
}

async function resolveTenantId(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  return profile.tenant_id;
}

export function useEstoqueCategorias() {
  return useQuery<EstoqueCategoria[]>({
    queryKey: ["estoque-categorias"],
    staleTime: 1000 * 60 * 15,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_categorias")
        .select("*")
        .order("ordem")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

function useInvalidateCategorias() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["estoque-categorias"] });
  };
}

export function useCreateEstoqueCategoria() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateCategorias();

  return useMutation({
    mutationFn: async (cat: { nome: string; slug: string; parent_id?: string | null }) => {
      const tenantId = await resolveTenantId(user!.id);
      const { data, error } = await (supabase as any)
        .from("estoque_categorias")
        .insert({ ...cat, tenant_id: tenantId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: "Categoria criada" }); },
    onError: (e: Error) => { toast({ title: "Erro ao criar categoria", description: e.message, variant: "destructive" }); },
  });
}

export function useUpdateEstoqueCategoria() {
  const { toast } = useToast();
  const invalidate = useInvalidateCategorias();

  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; nome?: string; slug?: string; parent_id?: string | null; ativo?: boolean }) => {
      const { data, error } = await (supabase as any)
        .from("estoque_categorias")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: "Categoria atualizada" }); },
    onError: (e: Error) => { toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }); },
  });
}

export function useDeleteEstoqueCategoria() {
  const { toast } = useToast();
  const invalidate = useInvalidateCategorias();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("estoque_categorias")
        .update({ ativo: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Categoria removida" }); },
    onError: (e: Error) => { toast({ title: "Erro ao remover", description: e.message, variant: "destructive" }); },
  });
}
