import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────

export interface EstoqueItem {
  id: string;
  tenant_id: string;
  sku: string | null;
  nome: string;
  categoria: string;
  unidade: string;
  custo_medio: number;
  estoque_minimo: number;
  ativo: boolean;
  created_at: string;
}

export interface EstoqueMovimento {
  id: string;
  tenant_id: string;
  item_id: string;
  local_id: string | null;
  tipo: "entrada" | "saida" | "ajuste" | "transferencia";
  quantidade: number;
  custo_unitario: number | null;
  origem: string;
  ref_type: string | null;
  ref_id: string | null;
  observacao: string | null;
  created_at: string;
  created_by: string | null;
  // joined
  item_nome?: string;
}

export interface EstoqueSaldo {
  tenant_id: string;
  item_id: string;
  nome: string;
  sku: string | null;
  categoria: string;
  unidade: string;
  custo_medio: number;
  estoque_minimo: number;
  ativo: boolean;
  estoque_atual: number;
  reservado: number;
}

export type EstoqueLocal = {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

// ─── Items CRUD ─────────────────────────────────────────

export function useEstoqueItens() {
  return useQuery<EstoqueItem[]>({
    queryKey: ["estoque-itens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_itens")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEstoqueSaldos() {
  return useQuery<EstoqueSaldo[]>({
    queryKey: ["estoque-saldos"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_saldos")
        .select("*")
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEstoqueLocais() {
  return useQuery<EstoqueLocal[]>({
    queryKey: ["estoque-locais"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_locais")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useCreateEstoqueItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (item: Omit<EstoqueItem, "id" | "tenant_id" | "created_at" | "custo_medio">) => {
      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      if (!profile) throw new Error("Perfil não encontrado");

      const { data, error } = await (supabase as any)
        .from("estoque_itens")
        .insert({ ...item, tenant_id: profile.tenant_id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-itens"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      toast({ title: "Item criado com sucesso" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao criar item", description: e.message, variant: "destructive" });
    },
  });
}

export function useUpdateEstoqueItem() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EstoqueItem> & { id: string }) => {
      const { error } = await (supabase as any)
        .from("estoque_itens")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-itens"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      toast({ title: "Item atualizado" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });
}

// ─── Movements ──────────────────────────────────────────

export function useEstoqueMovimentos(filters?: { item_id?: string; tipo?: string }) {
  return useQuery<EstoqueMovimento[]>({
    queryKey: ["estoque-movimentos", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("estoque_movimentos")
        .select("*, estoque_itens(nome)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filters?.item_id) query = query.eq("item_id", filters.item_id);
      if (filters?.tipo) query = query.eq("tipo", filters.tipo);

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        item_nome: m.estoque_itens?.nome || "—",
        estoque_itens: undefined,
      }));
    },
  });
}

export function useCreateMovimento() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (mov: {
      item_id: string;
      local_id?: string | null;
      tipo: string;
      quantidade: number;
      custo_unitario?: number | null;
      origem?: string;
      observacao?: string;
    }) => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user!.id)
        .single();
      if (!profile) throw new Error("Perfil não encontrado");

      const { error } = await (supabase as any)
        .from("estoque_movimentos")
        .insert({
          ...mov,
          tenant_id: profile.tenant_id,
          created_by: user!.id,
          origem: mov.origem || "manual",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque-itens"] });
      toast({ title: "Movimento registrado" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao registrar movimento", description: e.message, variant: "destructive" });
    },
  });
}

// ─── Categories ─────────────────────────────────────────

export const ESTOQUE_CATEGORIAS = [
  "cabos",
  "conectores",
  "disjuntores",
  "estrutura",
  "eletrodutos",
  "caixas",
  "ferragens",
  "proteção",
  "materiais_eletricos",
  "geral",
] as const;

export const ESTOQUE_UNIDADES = ["UN", "M", "PC", "CJ", "RL", "KG", "L"] as const;

export const CATEGORIA_LABELS: Record<string, string> = {
  cabos: "Cabos",
  conectores: "Conectores",
  disjuntores: "Disjuntores",
  estrutura: "Estrutura",
  eletrodutos: "Eletrodutos",
  caixas: "Caixas",
  ferragens: "Ferragens",
  proteção: "Proteção",
  materiais_eletricos: "Materiais Elétricos",
  geral: "Geral",
};

export const TIPO_MOVIMENTO_LABELS: Record<string, string> = {
  entrada: "Entrada",
  saida: "Saída",
  ajuste: "Ajuste",
  transferencia: "Transferência",
};
