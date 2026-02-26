import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

// ─── Types ──────────────────────────────────────────────

export interface SmClient {
  id: string;
  tenant_id: string;
  sm_client_id: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  document: string | null;
  synced_at: string;
}

export interface SmProject {
  id: string;
  tenant_id: string;
  sm_project_id: number;
  sm_client_id: number | null;
  name: string | null;
  potencia_kwp: number | null;
  status: string | null;
  valor: number | null;
  synced_at: string;
}

export interface SmProposal {
  id: string;
  tenant_id: string;
  sm_proposal_id: number;
  sm_project_id: number | null;
  sm_client_id: number | null;
  titulo: string | null;
  potencia_kwp: number | null;
  valor_total: number | null;
  status: string | null;
  modulos: string | null;
  inversores: string | null;
  synced_at: string;
}

export interface SmSyncLog {
  id: string;
  sync_type: string;
  status: string;
  total_fetched: number;
  total_upserted: number;
  total_errors: number;
  started_at: string;
  finished_at: string | null;
}

// ─── Queries ────────────────────────────────────────────

export function useSmClients() {
  return useQuery<SmClient[]>({
    queryKey: ["sm-clients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_clients")
        .select("id, tenant_id, sm_client_id, name, email, phone, document, synced_at")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSmProjects() {
  return useQuery<SmProject[]>({
    queryKey: ["sm-projects"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_projects")
        .select("id, tenant_id, sm_project_id, sm_client_id, name, potencia_kwp, status, valor, synced_at")
        .order("synced_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSmProposals() {
  return useQuery<SmProposal[]>({
    queryKey: ["sm-proposals"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_proposals")
        .select("id, tenant_id, sm_proposal_id, sm_project_id, sm_client_id, titulo, potencia_kwp, valor_total, status, modulos, inversores, synced_at")
        .order("synced_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });
}

export function useSmSyncLogs() {
  return useQuery<SmSyncLog[]>({
    queryKey: ["sm-sync-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_sync_logs")
        .select("id, sync_type, status, total_fetched, total_upserted, total_errors, started_at, finished_at")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Sync Mutation ──────────────────────────────────────

export function useSyncSolarMarket() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (syncType: string = "full") => {
      const { data, error } = await supabase.functions.invoke("solarmarket-sync", {
        body: { sync_type: syncType },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sm-clients"] });
      qc.invalidateQueries({ queryKey: ["sm-projects"] });
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.total_fetched} registros encontrados, ${data.total_upserted} importados.`,
      });
    },
    onError: (e: Error) => {
      toast({
        title: "Erro na sincronização",
        description: e.message,
        variant: "destructive",
      });
    },
  });
}
