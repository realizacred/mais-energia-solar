/**
 * Estoque (Inventory) hooks - SSOT ledger-based
 * Refactored: types + constants + query/mutation hooks
 */
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
  descricao: string | null;
  fornecedor: string | null;
  codigo_barras: string | null;
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
  idempotency_key: string | null;
  created_at: string;
  created_by: string | null;
  item_nome?: string;
  local_nome?: string;
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
  codigo_barras: string | null;
  estoque_atual: number;
  reservado: number;
}

export interface EstoqueSaldoLocal {
  tenant_id: string;
  item_id: string;
  local_id: string;
  item_nome: string;
  sku: string | null;
  unidade: string;
  local_nome: string;
  saldo_local: number;
}

export type EstoqueLocal = {
  id: string;
  tenant_id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

export interface EstoqueReserva {
  id: string;
  tenant_id: string;
  item_id: string;
  local_id: string | null;
  quantidade_reservada: number;
  ref_type: string | null;
  ref_id: string | null;
  status: "active" | "consumed" | "cancelled";
  observacao: string | null;
  created_at: string;
  created_by: string | null;
  consumed_at: string | null;
  item_nome?: string;
}

// ─── Constants ──────────────────────────────────────────

export const ESTOQUE_CATEGORIAS = [
  "cabos", "conectores", "disjuntores", "estrutura", "eletrodutos",
  "caixas", "ferragens", "proteção", "materiais_eletricos", "geral",
] as const;

export const ESTOQUE_UNIDADES = ["UN", "M", "PC", "CJ", "RL", "KG", "L"] as const;

export const CATEGORIA_LABELS: Record<string, string> = {
  cabos: "Cabos", conectores: "Conectores", disjuntores: "Disjuntores",
  estrutura: "Estrutura", eletrodutos: "Eletrodutos", caixas: "Caixas",
  ferragens: "Ferragens", proteção: "Proteção",
  materiais_eletricos: "Materiais Elétricos", geral: "Geral",
};

export const TIPO_MOVIMENTO_LABELS: Record<string, string> = {
  entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", transferencia: "Transferência",
};

// ─── Helper: resolve tenant ─────────────────────────────

async function resolveTenantId(userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .single();
  if (!profile) throw new Error("Perfil não encontrado");
  return profile.tenant_id;
}

// ─── Queries ────────────────────────────────────────────

export function useEstoqueItens() {
  return useQuery<EstoqueItem[]>({
    queryKey: ["estoque-itens"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_itens").select("*").order("nome");
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
        .from("estoque_saldos").select("*").order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEstoqueSaldosLocal() {
  return useQuery<EstoqueSaldoLocal[]>({
    queryKey: ["estoque-saldos-local"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("estoque_saldos_local").select("*").order("item_nome");
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
        .from("estoque_locais").select("*").eq("ativo", true).order("nome");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEstoqueMovimentos(filters?: { item_id?: string; tipo?: string }) {
  return useQuery<EstoqueMovimento[]>({
    queryKey: ["estoque-movimentos", filters],
    queryFn: async () => {
      let query = (supabase as any)
        .from("estoque_movimentos")
        .select("*, estoque_itens(nome), estoque_locais(nome)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (filters?.item_id) query = query.eq("item_id", filters.item_id);
      if (filters?.tipo) query = query.eq("tipo", filters.tipo);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        item_nome: m.estoque_itens?.nome || "—",
        local_nome: m.estoque_locais?.nome || "—",
        estoque_itens: undefined,
        estoque_locais: undefined,
      }));
    },
  });
}

export function useEstoqueReservas(statusFilter?: string) {
  return useQuery<EstoqueReserva[]>({
    queryKey: ["estoque-reservas", statusFilter],
    queryFn: async () => {
      let query = (supabase as any)
        .from("estoque_reservas")
        .select("*, estoque_itens(nome)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (statusFilter && statusFilter !== "all") query = query.eq("status", statusFilter);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        ...r,
        item_nome: r.estoque_itens?.nome || "—",
        estoque_itens: undefined,
      }));
    },
  });
}

// ─── Mutations ──────────────────────────────────────────

const INVALIDATE_KEYS = ["estoque-itens", "estoque-saldos", "estoque-saldos-local", "estoque-movimentos", "estoque-reservas"];

function useInvalidateEstoque() {
  const qc = useQueryClient();
  return () => INVALIDATE_KEYS.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export function useCreateEstoqueItem() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (item: Omit<EstoqueItem, "id" | "tenant_id" | "created_at" | "custo_medio">) => {
      const tenantId = await resolveTenantId(user!.id);
      const { data, error } = await (supabase as any)
        .from("estoque_itens")
        .insert({ ...item, tenant_id: tenantId })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item criado com sucesso" }); },
    onError: (e: Error) => { toast({ title: "Erro ao criar item", description: e.message, variant: "destructive" }); },
  });
}

export function useUpdateEstoqueItem() {
  const { toast } = useToast();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EstoqueItem> & { id: string }) => {
      const { error } = await (supabase as any).from("estoque_itens").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Item atualizado" }); },
    onError: (e: Error) => { toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" }); },
  });
}

export function useCreateMovimento() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (mov: {
      item_id: string;
      local_id?: string | null;
      tipo: string;
      quantidade: number;
      custo_unitario?: number | null;
      origem?: string;
      observacao?: string;
      ref_type?: string;
      ref_id?: string;
      idempotency_key?: string;
    }) => {
      const tenantId = await resolveTenantId(user!.id);
      const { error } = await (supabase as any)
        .from("estoque_movimentos")
        .insert({
          ...mov,
          tenant_id: tenantId,
          created_by: user!.id,
          origem: mov.origem || "manual",
        });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Movimento registrado" }); },
    onError: (e: Error) => { toast({ title: "Erro ao registrar movimento", description: e.message, variant: "destructive" }); },
  });
}

export function useCreateReserva() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (reserva: {
      item_id: string;
      local_id?: string | null;
      quantidade_reservada: number;
      ref_type?: string;
      ref_id?: string;
      observacao?: string;
    }) => {
      const tenantId = await resolveTenantId(user!.id);
      const { error } = await (supabase as any)
        .from("estoque_reservas")
        .insert({ ...reserva, tenant_id: tenantId, created_by: user!.id });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Reserva criada" }); },
    onError: (e: Error) => { toast({ title: "Erro ao criar reserva", description: e.message, variant: "destructive" }); },
  });
}

export function useConsumeReserva() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async ({ reservaId, observacao }: { reservaId: string; observacao?: string }) => {
      const { error } = await (supabase as any).rpc("estoque_consumir_reserva", {
        p_reserva_id: reservaId,
        p_user_id: user!.id,
        p_observacao: observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Reserva consumida" }); },
    onError: (e: Error) => { toast({ title: "Erro ao consumir reserva", description: e.message, variant: "destructive" }); },
  });
}

export function useCancelReserva() {
  const { toast } = useToast();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (reservaId: string) => {
      const { error } = await (supabase as any)
        .from("estoque_reservas")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("id", reservaId);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Reserva cancelada" }); },
    onError: (e: Error) => { toast({ title: "Erro ao cancelar reserva", description: e.message, variant: "destructive" }); },
  });
}

export function useTransferirEstoque() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (params: {
      item_id: string;
      local_origem: string;
      local_destino: string;
      quantidade: number;
      observacao?: string;
    }) => {
      const tenantId = await resolveTenantId(user!.id);
      const { error } = await (supabase as any).rpc("estoque_transferir", {
        p_tenant_id: tenantId,
        p_item_id: params.item_id,
        p_local_origem: params.local_origem,
        p_local_destino: params.local_destino,
        p_quantidade: params.quantidade,
        p_user_id: user!.id,
        p_observacao: params.observacao || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast({ title: "Transferência realizada" }); },
    onError: (e: Error) => { toast({ title: "Erro na transferência", description: e.message, variant: "destructive" }); },
  });
}

export function useCreateEstoqueLocal() {
  const { toast } = useToast();
  const { user } = useAuth();
  const invalidate = useInvalidateEstoque();

  return useMutation({
    mutationFn: async (local: { nome: string; tipo?: string }) => {
      const tenantId = await resolveTenantId(user!.id);
      const { data, error } = await (supabase as any)
        .from("estoque_locais")
        .insert({ ...local, tenant_id: tenantId })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { invalidate(); toast({ title: "Depósito criado" }); },
    onError: (e: Error) => { toast({ title: "Erro ao criar depósito", description: e.message, variant: "destructive" }); },
  });
}
