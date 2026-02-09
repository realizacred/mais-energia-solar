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
  vendedor_id: string | null;
  webhook_secret: string;
  status: "connected" | "disconnected" | "connecting" | "error";
  phone_number: string | null;
  profile_name: string | null;
  profile_picture_url: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
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
      vendedor_id?: string;
    }) => {
      const { data, error } = await supabase
        .from("wa_instances")
        .insert(instance)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
      toast({ title: "Instância criada com sucesso" });
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

  return {
    instances: instancesQuery.data || [],
    loading: instancesQuery.isLoading,
    createInstance: createInstance.mutateAsync,
    updateInstance: updateInstance.mutate,
    deleteInstance: deleteInstance.mutate,
  };
}
