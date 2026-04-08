/**
 * useOrdensCompra — Queries and mutations for Ordens de Compra.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STALE_TIME = 1000 * 60 * 5;
const QK = ["ordens-compra"] as const;

export type OrdemCompraStatus = "rascunho" | "enviada" | "confirmada" | "em_transito" | "recebida_parcial" | "recebida" | "cancelada";

export interface OrdemCompra {
  id: string;
  tenant_id: string;
  projeto_id: string | null;
  fornecedor_id: string | null;
  status: OrdemCompraStatus;
  numero_pedido: string | null;
  data_pedido: string | null;
  data_previsao_entrega: string | null;
  data_entrega_real: string | null;
  valor_total: number;
  observacoes: string | null;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
  // joined
  projeto_nome?: string;
  projeto_codigo?: string;
  fornecedor_nome?: string;
}

export interface OrdemCompraItem {
  id: string;
  ordem_compra_id: string;
  estoque_item_id: string | null;
  descricao: string | null;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  valor_total: number;
  quantidade_recebida: number;
}

export interface OrdemCompraTransporte {
  id: string;
  ordem_compra_id: string;
  transportadora: string | null;
  codigo_rastreio: string | null;
  url_rastreio: string | null;
  data_despacho: string | null;
  previsao_chegada: string | null;
  observacoes: string | null;
}

export interface OrdemCompraEvento {
  id: string;
  ordem_compra_id: string;
  tipo: string;
  descricao: string | null;
  criado_por: string | null;
  created_at: string;
}

export interface OrdemCompraFiltros {
  status?: OrdemCompraStatus;
  fornecedor_id?: string;
  projeto_id?: string;
  busca?: string;
}

// ─── List ───────────────────────────────────────────

export function useOrdensCompra(filtros?: OrdemCompraFiltros) {
  return useQuery<OrdemCompra[]>({
    queryKey: [...QK, filtros],
    staleTime: STALE_TIME,
    queryFn: async () => {
      let query = (supabase as any)
        .from("ordens_compra")
        .select("*, projetos(nome, codigo), fornecedores(nome)")
        .order("created_at", { ascending: false });

      if (filtros?.status) query = query.eq("status", filtros.status);
      if (filtros?.fornecedor_id) query = query.eq("fornecedor_id", filtros.fornecedor_id);
      if (filtros?.projeto_id) query = query.eq("projeto_id", filtros.projeto_id);
      if (filtros?.busca) query = query.ilike("numero_pedido", `%${filtros.busca}%`);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        projeto_nome: o.projetos?.nome || null,
        projeto_codigo: o.projetos?.codigo || null,
        fornecedor_nome: o.fornecedores?.nome || null,
        projetos: undefined,
        fornecedores: undefined,
      }));
    },
  });
}

// ─── Detail ─────────────────────────────────────────

export function useOrdemCompraDetalhe(id: string | undefined) {
  return useQuery<OrdemCompra | null>({
    queryKey: [...QK, "detalhe", id],
    enabled: !!id,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_compra")
        .select("*, projetos(nome, codigo), fornecedores(nome)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        ...data,
        projeto_nome: data.projetos?.nome || null,
        projeto_codigo: data.projetos?.codigo || null,
        fornecedor_nome: data.fornecedores?.nome || null,
        projetos: undefined,
        fornecedores: undefined,
      };
    },
  });
}

export function useOrdemCompraItens(ordemId: string | undefined) {
  return useQuery<OrdemCompraItem[]>({
    queryKey: [...QK, "itens", ordemId],
    enabled: !!ordemId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_compra_itens")
        .select("*")
        .eq("ordem_compra_id", ordemId)
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useOrdemCompraTransporte(ordemId: string | undefined) {
  return useQuery<OrdemCompraTransporte | null>({
    queryKey: [...QK, "transporte", ordemId],
    enabled: !!ordemId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_compra_transporte")
        .select("*")
        .eq("ordem_compra_id", ordemId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useOrdemCompraEventos(ordemId: string | undefined) {
  return useQuery<OrdemCompraEvento[]>({
    queryKey: [...QK, "eventos", ordemId],
    enabled: !!ordemId,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("ordens_compra_eventos")
        .select("*")
        .eq("ordem_compra_id", ordemId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ─── Mutations ──────────────────────────────────────

function useInvalidateOrdens() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: QK });
}

export function useCriarOrdem() {
  const invalidate = useInvalidateOrdens();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (dados: {
      projeto_id?: string;
      fornecedor_id?: string;
      numero_pedido?: string;
      data_pedido?: string;
      data_previsao_entrega?: string;
      observacoes?: string;
      itens?: Array<{
        estoque_item_id?: string;
        descricao?: string;
        quantidade: number;
        unidade?: string;
        valor_unitario?: number;
      }>;
    }) => {
      const { itens, ...ordemData } = dados;

      // Create order
      const { data: ordem, error: ordemError } = await (supabase as any)
        .from("ordens_compra")
        .insert({
          ...ordemData,
          criado_por: user?.id,
          status: "rascunho",
        })
        .select()
        .single();
      if (ordemError) throw ordemError;

      // Insert items
      if (itens && itens.length > 0) {
        const itensPayload = itens.map(i => ({
          ordem_compra_id: ordem.id,
          estoque_item_id: i.estoque_item_id || null,
          descricao: i.descricao || null,
          quantidade: i.quantidade,
          unidade: i.unidade || "un",
          valor_unitario: i.valor_unitario || 0,
          valor_total: (i.quantidade || 0) * (i.valor_unitario || 0),
        }));
        const { error: itensError } = await (supabase as any)
          .from("ordens_compra_itens")
          .insert(itensPayload);
        if (itensError) throw itensError;

        // Update valor_total
        const total = itensPayload.reduce((s, i) => s + i.valor_total, 0);
        await (supabase as any).from("ordens_compra").update({ valor_total: total }).eq("id", ordem.id);
      }

      // Register event
      await (supabase as any).from("ordens_compra_eventos").insert({
        ordem_compra_id: ordem.id,
        tipo: "status_alterado",
        descricao: "Ordem de compra criada",
        criado_por: user?.id,
      });

      return ordem;
    },
    onSuccess: invalidate,
  });
}

export function useAvancarStatusOrdem() {
  const invalidate = useInvalidateOrdens();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ id, novoStatus }: { id: string; novoStatus: OrdemCompraStatus }) => {
      const { error } = await (supabase as any)
        .from("ordens_compra")
        .update({
          status: novoStatus,
          ...(novoStatus === "recebida" ? { data_entrega_real: new Date().toISOString().split("T")[0] } : {}),
        })
        .eq("id", id);
      if (error) throw error;

      await (supabase as any).from("ordens_compra_eventos").insert({
        ordem_compra_id: id,
        tipo: "status_alterado",
        descricao: `Status alterado para ${novoStatus}`,
        criado_por: user?.id,
      });
    },
    onSuccess: invalidate,
  });
}

export function useExcluirOrdem() {
  const invalidate = useInvalidateOrdens();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("ordens_compra")
        .delete()
        .eq("id", id)
        .eq("status", "rascunho");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });
}

// ─── Item mutations ─────────────────────────────────

export function useAdicionarItemOrdem() {
  const invalidate = useInvalidateOrdens();

  return useMutation({
    mutationFn: async (item: {
      ordem_compra_id: string;
      estoque_item_id?: string;
      descricao?: string;
      quantidade: number;
      unidade?: string;
      valor_unitario?: number;
    }) => {
      const valor_total = (item.quantidade || 0) * (item.valor_unitario || 0);
      const { error } = await (supabase as any)
        .from("ordens_compra_itens")
        .insert({
          ...item,
          valor_total,
          estoque_item_id: item.estoque_item_id || null,
        });
      if (error) throw error;

      // Recalculate total
      await recalcularTotalOrdem(item.ordem_compra_id);
    },
    onSuccess: invalidate,
  });
}

export function useRemoverItemOrdem() {
  const invalidate = useInvalidateOrdens();

  return useMutation({
    mutationFn: async ({ id, ordem_compra_id }: { id: string; ordem_compra_id: string }) => {
      const { error } = await (supabase as any).from("ordens_compra_itens").delete().eq("id", id);
      if (error) throw error;
      await recalcularTotalOrdem(ordem_compra_id);
    },
    onSuccess: invalidate,
  });
}

export function useReceberItensOrdem() {
  const invalidate = useInvalidateOrdens();
  const { user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ ordemId, itens }: {
      ordemId: string;
      itens: Array<{ id: string; quantidade_recebida: number; estoque_item_id: string | null }>;
    }) => {
      // Update each item's quantidade_recebida
      for (const item of itens) {
        const { error } = await (supabase as any)
          .from("ordens_compra_itens")
          .update({ quantidade_recebida: item.quantidade_recebida })
          .eq("id", item.id);
        if (error) throw error;

        // Create estoque_movimentos for items with estoque_item_id
        if (item.estoque_item_id && item.quantidade_recebida > 0) {
          await (supabase as any).from("estoque_movimentos").insert({
            item_id: item.estoque_item_id,
            tipo: "entrada",
            quantidade: item.quantidade_recebida,
            referencia: `OC-${ordemId}`,
            observacao: "Recebimento via ordem de compra",
          });
        }
      }

      // Mark order as received
      await (supabase as any).from("ordens_compra").update({
        status: "recebida",
        data_entrega_real: new Date().toISOString().split("T")[0],
      }).eq("id", ordemId);

      // Register event
      await (supabase as any).from("ordens_compra_eventos").insert({
        ordem_compra_id: ordemId,
        tipo: "item_recebido",
        descricao: "Recebimento confirmado e estoque atualizado",
        criado_por: user?.id,
      });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["estoque-itens"] });
      qc.invalidateQueries({ queryKey: ["estoque-saldos"] });
      qc.invalidateQueries({ queryKey: ["estoque-movimentos"] });
    },
  });
}

// ─── Transporte mutations ───────────────────────────

export function useSalvarTransporte() {
  const invalidate = useInvalidateOrdens();

  return useMutation({
    mutationFn: async (dados: {
      ordem_compra_id: string;
      transportadora?: string;
      codigo_rastreio?: string;
      url_rastreio?: string;
      data_despacho?: string;
      previsao_chegada?: string;
      observacoes?: string;
    }) => {
      // Check if exists
      const { data: existing } = await (supabase as any)
        .from("ordens_compra_transporte")
        .select("id")
        .eq("ordem_compra_id", dados.ordem_compra_id)
        .maybeSingle();

      if (existing) {
        const { error } = await (supabase as any)
          .from("ordens_compra_transporte")
          .update(dados)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("ordens_compra_transporte")
          .insert(dados);
        if (error) throw error;
      }
    },
    onSuccess: invalidate,
  });
}

// ─── Helpers ────────────────────────────────────────

async function recalcularTotalOrdem(ordemId: string) {
  const { data: itens } = await (supabase as any)
    .from("ordens_compra_itens")
    .select("valor_total")
    .eq("ordem_compra_id", ordemId);

  const total = (itens ?? []).reduce((s: number, i: any) => s + (i.valor_total || 0), 0);
  await (supabase as any).from("ordens_compra").update({ valor_total: total }).eq("id", ordemId);
}

// ─── Projetos and Fornecedores for selects ──────────

export function useProjetosSelect() {
  return useQuery({
    queryKey: ["projetos-select"],
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projetos")
        .select("id, nome, codigo")
        .order("nome");
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; nome: string; codigo: string | null }>;
    },
  });
}
