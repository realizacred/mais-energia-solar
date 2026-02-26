import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { parseInvokeError } from "@/lib/supabaseFunctionError";

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
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("Sessão expirada. Faça login novamente para sincronizar o SolarMarket.");
      }

      // Sequential sync by stage to avoid timeouts and rate limits
      const stages: string[] = syncType === "full"
        ? ["clients", "projects", "proposals"]
        : [syncType];

      let totalFetched = 0;
      let totalUpserted = 0;
      let totalErrors = 0;
      const allErrorDetails: string[] = [];

      for (const stage of stages) {
        console.log(`[SM Sync] Starting stage: ${stage}`);

        const { data, error } = await supabase.functions.invoke("solarmarket-sync", {
          body: { sync_type: stage },
        });

        if (error) {
          const parsed = await parseInvokeError(error);
          const message = parsed.message || `Erro na etapa ${stage}`;
          const isAuthError = parsed.status === 401 || /401|unauthorized/i.test(message);
          throw new Error(
            isAuthError
              ? "Token SolarMarket inválido/expirado. Revise a chave em Integrações > SolarMarket."
              : `Erro na etapa "${stage}": ${message}`
          );
        }

        if (data?.error) throw new Error(`Erro na etapa "${stage}": ${data.error}`);

        totalFetched += data?.total_fetched || 0;
        totalUpserted += data?.total_upserted || 0;
        totalErrors += data?.total_errors || 0;
        if (data?.error_details) allErrorDetails.push(...data.error_details);

        // Invalidate queries after each stage for real-time feedback
        if (stage === "clients") qc.invalidateQueries({ queryKey: ["sm-clients"] });
        if (stage === "projects") qc.invalidateQueries({ queryKey: ["sm-projects"] });
        if (stage === "proposals") qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });

        // Small pause between stages
        if (stages.indexOf(stage) < stages.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      }

      return {
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        total_errors: totalErrors,
        error_details: allErrorDetails.length > 0 ? allErrorDetails.slice(0, 10) : undefined,
      };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["sm-clients"] });
      qc.invalidateQueries({ queryKey: ["sm-projects"] });
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
      toast({
        title: "Sincronização concluída",
        description: `${data.total_fetched} registros encontrados, ${data.total_upserted} importados.${data.total_errors > 0 ? ` (${data.total_errors} erros)` : ""}`,
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
