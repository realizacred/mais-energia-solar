import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface WaInstance {
  id: string;
  tenant_id: string;
  nome: string;
  evolution_instance_key: string;
  evolution_api_url: string;
  owner_user_id: string | null;
  consultor_id: string | null;
  webhook_secret: string;
  api_key: string | null;
  status: "connected" | "disconnected" | "connecting" | "error";
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  last_sync_messages: number | null;
  last_sync_conversations: number | null;
  created_at: string;
  updated_at: string;
}

export interface CheckStatusResult {
  id: string;
  nome: string;
  status: string;
  phone_number?: string;
  profile_name?: string;
  connectionState?: string;
  error?: string;
}

export function useWaInstances() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const instancesQuery = useQuery({
    queryKey: ["wa-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_instances")
        .select("id, nome, status, phone_number, profile_name, profile_picture_url, evolution_api_url, evolution_instance_key, api_key, webhook_secret, consultor_id, owner_user_id, last_seen_at, last_sync_at, last_sync_conversations, last_sync_messages, created_at, updated_at, tenant_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WaInstance[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const updateInstance = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<WaInstance> }) => {
      const { error } = await supabase
        .from("wa_instances")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      toast({ title: "Instância atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  const deleteInstance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("wa_instances")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      toast({ title: "Instância removida" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // Disconnect instance (logout from Evolution API, keep record)
  const disconnectInstance = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke("check-wa-instance-status", {
        body: { instance_id: id, action: "logout" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao desconectar instância");
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      toast({ title: data.message || "Instância desconectada" });
      if (data.warning) {
        toast({ title: "Aviso", description: data.warning, variant: "destructive" });
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro ao desconectar", description: err.message, variant: "destructive" });
    },
  });

  // Check status of a single instance or all instances
  const checkInstanceStatus = async (instanceId?: string): Promise<CheckStatusResult[]> => {
    const { data, error } = await supabase.functions.invoke("check-wa-instance-status", {
      body: instanceId ? { instance_id: instanceId } : {},
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Erro ao verificar status");

    queryClient.invalidateQueries({ queryKey: ["wa-instances"] });

    return data.results as CheckStatusResult[];
  };

  // Trigger historical message sync for an instance (batched to avoid timeouts)
  const triggerHistorySync = async (instanceId: string, days = 365) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão inválida");

    let offset = 0;
    let totalConversations = 0;
    let totalMessages = 0;

    while (true) {
      const { data, error } = await supabase.functions.invoke("sync-wa-history", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { instance_id: instanceId, days, offset },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro na sincronização");

      totalConversations += data.conversations_created || 0;
      totalMessages += data.messages_imported || 0;

      if (!data.has_more || !data.next_offset) break;
      offset = data.next_offset;

      if (offset > 0) {
        toast({
          title: "Sincronizando...",
          description: `${offset}/${data.total_chats} conversas processadas...`,
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    return { conversations_created: totalConversations, messages_imported: totalMessages };
  };

  const checkStatusMutation = useMutation({
    mutationFn: async (instanceId?: string) => {
      return checkInstanceStatus(instanceId);
    },
    onSuccess: (results) => {
      const connected = results.filter((r) => r.status === "connected").length;
      const total = results.length;
      toast({
        title: "Status verificado",
        description: `${connected}/${total} instância(s) conectada(s).`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Erro ao verificar status",
        description: err.message,
        variant: "destructive",
      });
    },
  });

  // ── Vendedores (consultores ativos) ──
  const vendedoresQuery = useQuery({
    queryKey: ["vendedores-wa-instances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, user_id")
        .eq("ativo", true);
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Instance ↔ Vendedor junction ──
  const instanceVendedoresQuery = useQuery({
    queryKey: ["wa-instance-vendedores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_instance_consultores")
        .select("instance_id, consultor_id");
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // ── Save vendedor assignments (junction + legacy field) ──
  const saveVendedoresMutation = useMutation({
    mutationFn: async ({
      instanceId,
      tenantId,
      vendedorIds,
    }: {
      instanceId: string;
      tenantId: string;
      vendedorIds: string[];
    }) => {
      await supabase.from("wa_instance_consultores").delete().eq("instance_id", instanceId);
      if (vendedorIds.length > 0) {
        const { error } = await supabase.from("wa_instance_consultores").insert(
          vendedorIds.map((vid) => ({
            instance_id: instanceId,
            consultor_id: vid,
            tenant_id: tenantId,
          }))
        );
        if (error) throw error;
      }
      const legacyVendedorId = vendedorIds.length === 1 ? vendedorIds[0] : null;
      await supabase
        .from("wa_instances")
        .update({ consultor_id: legacyVendedorId } as any)
        .eq("id", instanceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-instance-vendedores"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar vendedores", description: err.message, variant: "destructive" });
    },
  });

  return {
    instances: instancesQuery.data || [],
    loading: instancesQuery.isLoading,
    updateInstance: updateInstance.mutate,
    deleteInstance: deleteInstance.mutate,
    disconnectInstance: disconnectInstance.mutate,
    disconnecting: disconnectInstance.isPending,
    checkStatus: checkStatusMutation.mutate,
    checkingStatus: checkStatusMutation.isPending,
    syncHistory: triggerHistorySync,
    vendedores: vendedoresQuery.data || [],
    instanceVendedores: instanceVendedoresQuery.data || [],
    saveVendedores: saveVendedoresMutation.mutateAsync,
  };
}
