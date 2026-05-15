import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CreditBankConfig {
  id: string;
  tenant_id: string;
  bank_name: string;
  slug: string;
  is_active: boolean;
  icon_url: string | null;
  prazo_medio: string | null;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  checklist_count?: number;
}

export interface CreditChecklistItem {
  id: string;
  tenant_id: string;
  bank_config_id: string;
  document_type_name: string;
  is_required: boolean;
  applicable_to: 'pf' | 'pj' | 'both';
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export function useCreditBankConfigs() {
  return useQuery({
    queryKey: ["credit-bank-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_bank_configs")
        .select(`
          *,
          credit_bank_checklists(count)
        `)
        .order("bank_name");

      if (error) throw error;
      
      return (data as any[]).map(bank => ({
        ...bank,
        checklist_count: bank.credit_bank_checklists?.[0]?.count || 0
      })) as CreditBankConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCreditBankConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<CreditBankConfig>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const slug = values.bank_name?.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || '';

      const { data, error } = await supabase
        .from("credit_bank_configs")
        .insert({
          bank_name: values.bank_name || "",
          is_active: values.is_active ?? true,
          icon_url: values.icon_url,
          prazo_medio: values.prazo_medio,
          observacoes: values.observacoes,
          tenant_id: profile.tenant_id,
          slug
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-bank-configs"] });
      toast({ title: "Configuração de banco criada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao criar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCreditBankConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CreditBankConfig> & { id: string }) => {
      const { data, error } = await supabase
        .from("credit_bank_configs")
        .update(values)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["credit-bank-configs"] });
      toast({ title: "Configuração de banco atualizada" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar configuração",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useCreditBankChecklist(bankConfigId?: string) {
  return useQuery({
    queryKey: ["credit-bank-checklist", bankConfigId],
    queryFn: async () => {
      if (!bankConfigId) return [];
      const { data, error } = await supabase
        .from("credit_bank_checklists")
        .select("*")
        .eq("bank_config_id", bankConfigId)
        .order("sort_order");

      if (error) throw error;
      return data as CreditChecklistItem[];
    },
    enabled: !!bankConfigId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateCreditChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: Partial<CreditChecklistItem>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const { data, error } = await supabase
        .from("credit_bank_checklists")
        .insert({
          ...values,
          tenant_id: profile.tenant_id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credit-bank-checklist", variables.bank_config_id] });
      queryClient.invalidateQueries({ queryKey: ["credit-bank-configs"] });
      toast({ title: "Item de checklist adicionado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao adicionar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useUpdateCreditChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: Partial<CreditChecklistItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("credit_bank_checklists")
        .update(values)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["credit-bank-checklist", data.bank_config_id] });
      toast({ title: "Item de checklist atualizado" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useDeleteCreditChecklistItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, bank_config_id }: { id: string, bank_config_id: string }) => {
      const { error } = await supabase
        .from("credit_bank_checklists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["credit-bank-checklist", variables.bank_config_id] });
      queryClient.invalidateQueries({ queryKey: ["credit-bank-configs"] });
      toast({ title: "Item removido com sucesso" });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao remover item",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
