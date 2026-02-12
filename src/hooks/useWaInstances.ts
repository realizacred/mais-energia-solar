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
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as WaInstance[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  });

  const createInstance = useMutation({
    mutationFn: async (instance: {
      nome: string;
      evolution_instance_key: string;
      evolution_api_url: string;
      owner_user_id?: string;
      consultor_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("wa_instances")
        .insert(instance)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      toast({ title: "Instância criada com sucesso" });
      // Auto-check status after creation
      if (data?.id) {
        try {
          const results = await checkInstanceStatus(data.id);
          // If connected, auto-sync history
          const connected = results?.some((r) => r.status === "connected");
          if (connected) {
            toast({ title: "Sincronizando histórico...", description: "Buscando mensagens dos últimos 365 dias." });
            triggerHistorySync(data.id, 365).then((result) => {
              toast({
                title: "Histórico sincronizado!",
                description: `${result?.conversations_created || 0} conversas, ${result?.messages_imported || 0} mensagens importadas.`,
              });
            }).catch((e) => {
              toast({ title: "Erro na sincronização", description: e.message, variant: "destructive" });
            });
          }
        } catch (e) {
          console.warn("Auto-check status after create failed:", e);
        }
      }
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar instância", description: err.message, variant: "destructive" });
    },
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

  // Check status of a single instance or all instances
  const checkInstanceStatus = async (instanceId?: string): Promise<CheckStatusResult[]> => {
    const { data, error } = await supabase.functions.invoke("check-wa-instance-status", {
      body: instanceId ? { instance_id: instanceId } : {},
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "Erro ao verificar status");

    // Refetch instances to get updated statuses
    queryClient.invalidateQueries({ queryKey: ["wa-instances"] });

    return data.results as CheckStatusResult[];
  };

  // Trigger historical message sync for an instance
  const triggerHistorySync = async (instanceId: string, days = 365) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Sessão inválida");

    const { data, error } = await supabase.functions.invoke("sync-wa-history", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: { instance_id: instanceId, days },
    });

    if (error) throw error;

    queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    return data;
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

  return {
    instances: instancesQuery.data || [],
    loading: instancesQuery.isLoading,
    createInstance: createInstance.mutateAsync,
    updateInstance: updateInstance.mutate,
    deleteInstance: deleteInstance.mutate,
    checkStatus: checkStatusMutation.mutate,
    checkingStatus: checkStatusMutation.isPending,
    syncHistory: triggerHistorySync,
  };
}
