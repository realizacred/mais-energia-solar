import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { toast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

export type ChequeStatus = Database["public"]["Enums"]["cheque_status"];

export interface Cheque {
  id: string;
  tenant_id: string;
  cliente_id: string;
  projeto_id?: string;
  recebimento_id?: string;
  parcela_id?: string;
  pagamento_id?: string;
  numero_cheque: string;
  banco: string;
  agencia?: string;
  conta?: string;
  titular: string;
  cpf_cnpj_titular?: string;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_compensacao?: string;
  origem?: string;
  destino?: string;
  recebido_de?: string;
  entregue_para?: string;
  status: ChequeStatus;
  observacoes?: string;
  comprovante_url?: string;
  created_at: string;
  updated_at: string;
  clientes?: { nome: string };
}

export function useCheques(filters?: { status?: ChequeStatus | 'todos', cliente_id?: string }) {
  const { data: tenantId } = useTenantId();

  return useQuery({
    queryKey: ['cheques', tenantId, filters],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('cheques')
        .select('*, clientes(nome)')
        .eq('tenant_id', tenantId)
        .order('data_vencimento', { ascending: true });

      if (filters?.status && filters.status !== 'todos') {
        query = query.eq('status', filters.status);
      }

      if (filters?.cliente_id) {
        query = query.eq('cliente_id', filters.cliente_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as any[]; // Type assertion simplified to avoid deep type matching issues with nested relations
    },
    enabled: !!tenantId,
  });
}

export function useCreateCheque() {
  const queryClient = useQueryClient();
  const { data: tenantId } = useTenantId();

  return useMutation({
    mutationFn: async (cheque: any) => {
      if (!tenantId) throw new Error("Tenant ID não encontrado");

      const { data, error } = await supabase
        .from('cheques')
        .insert([{ 
          banco: cheque.banco,
          cliente_id: cheque.cliente_id,
          numero_cheque: cheque.numero_cheque,
          data_vencimento: cheque.data_vencimento,
          tenant_id: tenantId,
          titular: cheque.titular,
          valor: cheque.valor,
          ...cheque 
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast({ title: "Cheque cadastrado", description: "O cheque foi registrado com sucesso." });
    },
    onError: (error: any) => {
      toast({ 
        title: "Erro ao cadastrar", 
        description: error.message,
        variant: "destructive"
      });
    }
  });
}

export function useUpdateChequeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, status, details }: { id: string, status: ChequeStatus, details?: any }) => {
      const { data, error } = await supabase
        .from('cheques')
        .update({ status, ...details })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cheques'] });
      toast({ title: "Status atualizado", description: "O status do cheque foi alterado com sucesso." });
    },
  });
}
