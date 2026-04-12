import { useEffect, useRef } from "react";
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
  email_normalized: string | null;
  phone: string | null;
  phone_formatted: string | null;
  phone_normalized: string | null;
  secondary_phone: string | null;
  document: string | null;
  document_formatted: string | null;
  zip_code: string | null;
  zip_code_formatted: string | null;
  address: any | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  company: string | null;
  responsible: any | null;
  representative: any | null;
  sm_created_at: string | null;
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
  city: string | null;
  state: string | null;
  installation_type: string | null;
  energy_consumption: number | null;
  responsible: any | null;
  raw_payload: any | null;
  sm_created_at: string | null;
  synced_at: string;
  has_active_proposal?: boolean;
  migrado_em?: string | null;
}

export interface SmProposal {
  id: string;
  tenant_id: string;
  sm_proposal_id: number;
  sm_project_id: number | null;
  sm_client_id: number | null;
  titulo: string | null;
  description: string | null;
  potencia_kwp: number | null;
  valor_total: number | null;
  status: string | null;
  modulos: string | null;
  inversores: string | null;
  panel_model: string | null;
  panel_quantity: number | null;
  inverter_model: string | null;
  inverter_quantity: number | null;
  discount: number | null;
  installation_cost: number | null;
  equipment_cost: number | null;
  energy_generation: number | null;
  roof_type: string | null;
  structure_type: string | null;
  warranty: string | null;
  payment_conditions: string | null;
  valid_until: string | null;
  sm_created_at: string | null;
  sm_updated_at: string | null;
  raw_payload: any | null;
  synced_at: string;
  // New fields
  link_pdf: string | null;
  consumo_mensal: number | null;
  tarifa_distribuidora: number | null;
  economia_mensal: number | null;
  economia_mensal_percent: number | null;
  payback: string | null;
  vpl: number | null;
  tir: number | null;
  preco_total: number | null;
  fase: string | null;
  tipo_dimensionamento: string | null;
  dis_energia: string | null;
  cidade: string | null;
  estado: string | null;
  geracao_anual: number | null;
  inflacao_energetica: number | null;
  perda_eficiencia_anual: number | null;
  sobredimensionamento: number | null;
  custo_disponibilidade: number | null;
  generated_at: string | null;
  send_at: string | null;
  viewed_at: string | null;
  acceptance_date: string | null;
  rejection_date: string | null;
  migrar_para_canonico: boolean;
  migrar_requested_at: string | null;
  migrar_requested_by: string | null;
  migrado_em: string | null;
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
  error_message: string | null;
}

export interface SmFunnel {
  id: string;
  tenant_id: string;
  sm_funnel_id: number;
  name: string | null;
  stages: any;
  raw_payload: any | null;
  synced_at: string;
}

export interface SmFunnelStage {
  id: string;
  tenant_id: string;
  sm_funnel_id: number;
  sm_stage_id: number;
  funnel_name: string | null;
  stage_name: string | null;
  stage_order: number | null;
  raw_payload: any | null;
  synced_at: string;
}

export interface SmCustomField {
  id: string;
  tenant_id: string;
  sm_custom_field_id: number;
  key: string | null;
  name: string | null;
  field_type: string | null;
  options: any | null;
  raw_payload: any | null;
  synced_at: string;
}

// ─── Queries ────────────────────────────────────────────

const SM_PAGE_SIZE = 200;

async function fetchAllRows<T>(params: {
  table: string;
  select: string;
  orderBy: string;
  ascending?: boolean;
}): Promise<T[]> {
  const allRows: T[] = [];
  const seen = new Set<string>();
  let from = 0;

  while (true) {
    const to = from + SM_PAGE_SIZE - 1;
    const { data, error } = await (supabase as any)
      .from(params.table)
      .select(params.select)
      .order(params.orderBy, { ascending: params.ascending ?? true })
      .order("id", { ascending: true }) // stable tie-breaker to prevent duplicates across pages
      .range(from, to);

    if (error) throw error;

    const batch = (data || []) as T[];
    // Deduplicate in case of boundary overlap
    for (const row of batch) {
      const rid = (row as any).id;
      if (rid && !seen.has(rid)) {
        seen.add(rid);
        allRows.push(row);
      }
    }

    if (batch.length < SM_PAGE_SIZE) break;
    from += SM_PAGE_SIZE;
  }

  return allRows;
}

/** Detects if there's an active background sync (cron) by checking recent running logs.
 *  Only considers logs started within the last 5 minutes to avoid stale "running" status. */
export function useIsBackgroundSyncActive() {
  return useQuery<boolean>({
    queryKey: ["sm-bg-sync-active"],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
      const { data } = await (supabase as any)
        .from("solar_market_sync_logs")
        .select("id")
        .eq("status", "running")
        .gte("started_at", fiveMinAgo)
        .limit(1);
      return (data || []).length > 0;
    },
    refetchInterval: 8000,
  });
}

export function useSmClients(syncRunning?: boolean, enabled = true) {
  return useQuery<SmClient[]>({
    queryKey: ["sm-clients"],
    staleTime: 1000 * 60 * 5,
    enabled,
    queryFn: async () => {
      return fetchAllRows<SmClient>({
        table: "solar_market_clients",
        select: "id, tenant_id, sm_client_id, name, email, email_normalized, phone, phone_formatted, phone_normalized, secondary_phone, document, document_formatted, zip_code, zip_code_formatted, address, number, complement, neighborhood, city, state, company, responsible, representative, sm_created_at, synced_at",
        orderBy: "name",
      });
    },
    refetchInterval: syncRunning ? 5000 : false,
  });
}

export function useSmProjects(syncRunning?: boolean, enabled = true) {
  return useQuery<SmProject[]>({
    queryKey: ["sm-projects"],
    staleTime: 1000 * 60 * 5,
    enabled,
    queryFn: async () => {
      // Exclude raw_payload from listing to avoid timeouts on large datasets
      return fetchAllRows<SmProject>({
        table: "solar_market_projects",
        select: "id, tenant_id, sm_project_id, sm_client_id, name, potencia_kwp, status, valor, city, state, installation_type, energy_consumption, responsible, sm_created_at, synced_at, has_active_proposal, migrado_em",
        orderBy: "synced_at",
        ascending: false,
      });
    },
    refetchInterval: syncRunning ? 5000 : false,
  });
}

export function useSmFunnels() {
  return useQuery<SmFunnel[]>({
    queryKey: ["sm-funnels"],
    staleTime: 1000 * 60 * 15,
    queryFn: async () => {
      return fetchAllRows<SmFunnel>({
        table: "solar_market_funnels",
        select: "*",
        orderBy: "name",
      });
    },
  });
}

export function useSmFunnelStages(funnelId?: number) {
  return useQuery<SmFunnelStage[]>({
    queryKey: ["sm-funnel-stages", funnelId],
    staleTime: 1000 * 60 * 15,
    queryFn: async () => {
      const allRows: SmFunnelStage[] = [];
      let from = 0;
      while (true) {
        let query = (supabase as any)
          .from("solar_market_funnel_stages")
          .select("*")
          .order("stage_order", { ascending: true })
          .range(from, from + SM_PAGE_SIZE - 1);
        if (funnelId) query = query.eq("sm_funnel_id", funnelId);
        const { data, error } = await query;
        if (error) throw error;
        const batch = (data || []) as SmFunnelStage[];
        allRows.push(...batch);
        if (batch.length < SM_PAGE_SIZE) break;
        from += SM_PAGE_SIZE;
      }
      return allRows;
    },
  });
}

export function useSmCustomFields() {
  return useQuery<SmCustomField[]>({
    queryKey: ["sm-custom-fields"],
    staleTime: 1000 * 60 * 15,
    queryFn: async () => {
      return fetchAllRows<SmCustomField>({
        table: "solar_market_custom_fields",
        select: "id, tenant_id, sm_custom_field_id, key, name, field_type, options, synced_at",
        orderBy: "name",
      });
    },
  });
}

export function useSmProposals(syncRunning?: boolean, enabled = true) {
  return useQuery<SmProposal[]>({
    queryKey: ["sm-proposals"],
    staleTime: 1000 * 60 * 5,
    enabled,
    queryFn: async () => {
      // Exclude raw_payload from listing to avoid timeouts on large datasets
      return fetchAllRows<SmProposal>({
        table: "solar_market_proposals",
        select: "id, tenant_id, sm_proposal_id, sm_project_id, sm_client_id, titulo, description, potencia_kwp, valor_total, status, modulos, inversores, panel_model, panel_quantity, inverter_model, inverter_quantity, discount, installation_cost, equipment_cost, energy_generation, roof_type, structure_type, warranty, payment_conditions, valid_until, sm_created_at, sm_updated_at, synced_at, link_pdf, consumo_mensal, tarifa_distribuidora, economia_mensal, economia_mensal_percent, payback, vpl, tir, preco_total, fase, tipo_dimensionamento, dis_energia, cidade, estado, geracao_anual, inflacao_energetica, perda_eficiencia_anual, sobredimensionamento, custo_disponibilidade, generated_at, send_at, viewed_at, acceptance_date, rejection_date, migrar_para_canonico, migrar_requested_at, migrar_requested_by, migrado_em",
        orderBy: "synced_at",
        ascending: false,
      });
    },
    refetchInterval: syncRunning ? 5000 : false,
  });
}

export function useSmSyncLogs() {
  return useQuery<SmSyncLog[]>({
    queryKey: ["sm-sync-logs"],
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_sync_logs")
        .select("id, sync_type, status, total_fetched, total_upserted, total_errors, started_at, finished_at, error_message")
        .order("started_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: (query) => {
      const latest = query.state.data?.[0];
      if (latest?.status !== "running") return false;
      const age = Date.now() - new Date(latest.started_at).getTime();
      return age < 600000 ? 2000 : false;
    },
  });
}

// ─── CRUD Mutations ────────────────────────────────────

export function useClearSyncLogs() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const { error } = await (supabase as any)
        .from("solar_market_sync_logs")
        .delete()
        .eq("tenant_id", profile.tenant_id)
        .neq("status", "running");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
      toast({ title: "Histórico de logs limpo" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao limpar logs", description: err.message, variant: "destructive" });
    },
  });
}

export function useUpdateSmClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<SmClient> }) => {
      const { error } = await (supabase as any)
        .from("solar_market_clients")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-clients"] });
      toast({ title: "Cliente atualizado" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    },
  });
}

export function useDeleteSmClient() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("solar_market_clients")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-clients"] });
      toast({ title: "Cliente excluído" });
    },
    onError: (e: Error) => {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
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

// ─── Realtime sync for migration counts ─────────────
/**
 * Subscribes to INSERT on propostas_nativas and clientes to keep
 * SM migration page counters in sync across tabs/users. Debounce 1000ms.
 * Also listens for solar_market_proposals UPDATE (migrado_em) and
 * refreshes on tab visibility change for dynamic UX.
 */
export function useSmMigrationRealtimeSync() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHiddenRef = useRef<number | null>(null);

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["sm-proposals"] });
        queryClient.invalidateQueries({ queryKey: ["sm-clients"] });
        queryClient.invalidateQueries({ queryKey: ["sm-projects"] });
        queryClient.invalidateQueries({ queryKey: ["sm-sync-logs"] });
        queryClient.invalidateQueries({ queryKey: ["canonical-check"] });
        queryClient.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      }, 600);
    };

    const channel = supabase
      .channel("sm-migration-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "solar_market_proposals" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "solar_market_projects" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "sm_migration_log" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas_nativas" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_versoes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, invalidate)
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenRef.current = Date.now();
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["sm-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["sm-projects"] });
      queryClient.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["sm-sync-logs"] });

      const elapsed = lastHiddenRef.current ? Date.now() - lastHiddenRef.current : 0;
      if (elapsed > 10_000) {
        queryClient.invalidateQueries({ queryKey: ["sm-clients"] });
        queryClient.invalidateQueries({ queryKey: ["canonical-check"] });
      }
      lastHiddenRef.current = null;
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}
