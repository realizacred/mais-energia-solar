import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { toast } from "sonner";

export interface LancamentoFinanceiro {
  id: string;
  tenant_id: string;
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  forma_pagamento: string | null;
  status: string;
  cliente_id: string | null;
  projeto_id: string | null;
  comprovante_url: string | null;
  observacoes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string } | null;
  projetos?: { nome_projeto: string } | null;
}

export interface LancamentoFiltros {
  tipo?: string;
  categoria?: string;
  dataInicio?: string;
  dataFim?: string;
  status?: string;
}

const QUERY_KEY = "lancamentos-financeiros";

export function useLancamentos(filtros: LancamentoFiltros = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, filtros],
    queryFn: async () => {
      let query = (supabase as any)
        .from("lancamentos_financeiros")
        .select("*, clientes:cliente_id(nome), projetos:projeto_id(nome_projeto)", { count: "exact" })
        .order("data_lancamento", { ascending: false })
        .order("created_at", { ascending: false });

      if (filtros.tipo && filtros.tipo !== "todos") {
        query = query.eq("tipo", filtros.tipo);
      }
      if (filtros.categoria) {
        query = query.eq("categoria", filtros.categoria);
      }
      if (filtros.status && filtros.status !== "todos") {
        query = query.eq("status", filtros.status);
      }
      if (filtros.dataInicio) {
        query = query.gte("data_lancamento", filtros.dataInicio);
      }
      if (filtros.dataFim) {
        query = query.lte("data_lancamento", filtros.dataFim);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as LancamentoFinanceiro[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface CreateLancamentoInput {
  tipo: "receita" | "despesa";
  categoria: string;
  descricao: string;
  valor: number;
  data_lancamento: string;
  forma_pagamento?: string;
  status?: string;
  cliente_id?: string | null;
  projeto_id?: string | null;
  observacoes?: string;
  comprovante?: File | null;
}

export function useCreateLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateLancamentoInput) => {
      const { tenantId, userId } = await getCurrentTenantId();

      let comprovante_url: string | null = null;
      if (input.comprovante) {
        const ext = input.comprovante.name.split(".").pop();
        const path = `${tenantId}/lancamentos/${crypto.randomUUID()}/${input.comprovante.name}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes-pagamento")
          .upload(path, input.comprovante);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("comprovantes-pagamento")
          .getPublicUrl(path);
        comprovante_url = urlData.publicUrl;
      }

      const { data, error } = await (supabase as any)
        .from("lancamentos_financeiros")
        .insert({
          tenant_id: tenantId,
          tipo: input.tipo,
          categoria: input.categoria,
          descricao: input.descricao,
          valor: input.valor,
          data_lancamento: input.data_lancamento,
          forma_pagamento: input.forma_pagamento || null,
          status: input.status || "confirmado",
          cliente_id: input.cliente_id || null,
          projeto_id: input.projeto_id || null,
          observacoes: input.observacoes || null,
          comprovante_url,
          created_by: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lançamento criado com sucesso!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao criar lançamento: " + err.message);
    },
  });
}

export function useUpdateLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<CreateLancamentoInput> & { id: string }) => {
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (input.tipo !== undefined) updates.tipo = input.tipo;
      if (input.categoria !== undefined) updates.categoria = input.categoria;
      if (input.descricao !== undefined) updates.descricao = input.descricao;
      if (input.valor !== undefined) updates.valor = input.valor;
      if (input.data_lancamento !== undefined) updates.data_lancamento = input.data_lancamento;
      if (input.forma_pagamento !== undefined) updates.forma_pagamento = input.forma_pagamento || null;
      if (input.status !== undefined) updates.status = input.status;
      if (input.cliente_id !== undefined) updates.cliente_id = input.cliente_id || null;
      if (input.projeto_id !== undefined) updates.projeto_id = input.projeto_id || null;
      if (input.observacoes !== undefined) updates.observacoes = input.observacoes || null;

      if (input.comprovante) {
        const { tenantId } = await getCurrentTenantId();
        const path = `${tenantId}/lancamentos/${id}/${input.comprovante.name}`;
        const { error: uploadError } = await supabase.storage
          .from("comprovantes-pagamento")
          .upload(path, input.comprovante, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage
          .from("comprovantes-pagamento")
          .getPublicUrl(path);
        updates.comprovante_url = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("lancamentos_financeiros" as "leads")
        .update(updates as Record<string, string>)
        .eq("id" as "id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lançamento atualizado!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao atualizar: " + err.message);
    },
  });
}

export function useDeleteLancamento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("lancamentos_financeiros" as "leads")
        .delete()
        .eq("id" as "id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast.success("Lançamento excluído!");
    },
    onError: (err: Error) => {
      toast.error("Erro ao excluir: " + err.message);
    },
  });
}

// ─── Category helpers ─────────────────────────────────────
export const CATEGORIAS_RECEITA = [
  { value: "servico_avulso", label: "Serviço Avulso" },
  { value: "manutencao", label: "Manutenção" },
  { value: "consultoria", label: "Consultoria" },
  { value: "comissao_recebida", label: "Comissão Recebida" },
  { value: "outros_receita", label: "Outros" },
];

export const CATEGORIAS_DESPESA = [
  { value: "material", label: "Material" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "aluguel", label: "Aluguel" },
  { value: "salario", label: "Salário" },
  { value: "combustivel", label: "Combustível" },
  { value: "alimentacao", label: "Alimentação" },
  { value: "marketing", label: "Marketing" },
  { value: "taxa_bancaria", label: "Taxa Bancária" },
  { value: "imposto", label: "Imposto" },
  { value: "outros_despesa", label: "Outros" },
];

export const FORMAS_PAGAMENTO = [
  { value: "pix_chave", label: "PIX" },
  { value: "cartao", label: "Cartão" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "transferencia", label: "Transferência" },
  { value: "cheque", label: "Cheque" },
  { value: "outros", label: "Outros" },
];
