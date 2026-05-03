/**
 * useEmailAccounts — Hooks for email account management and ingestion.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface EmailAccount {
  id: string;
  tenant_id: string;
  nome: string | null;
  email_address: string;
  provider_type: "gmail" | "imap";
  account_role: "invoices" | "operational" | "support";
  host: string | null;
  port: number | null;
  username: string | null;
  imap_password_encrypted: string | null;
  is_active: boolean;
  can_read: boolean;
  can_send: boolean;
  verificar_a_cada_minutos: number | null;
  pasta_monitorada: string | null;
  filtro_remetente: string | null;
  gmail_credentials: any;
  gmail_settings: any;
  last_sync_at: string | null;
  last_error: string | null;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EmailIngestionRule {
  id: string;
  tenant_id: string;
  email_account_id: string;
  concessionaria_id: string | null;
  sender_contains: string | null;
  subject_contains: string | null;
  has_attachment: boolean;
  allowed_extensions: string[];
  folder_name: string;
  is_active: boolean;
  created_at: string;
}

export interface EmailIngestionRun {
  id: string;
  tenant_id: string;
  email_account_id: string;
  processed_count: number;
  imported_count: number;
  duplicate_count: number;
  error_count: number;
  error_message: string | null;
  status: string;
  started_at: string;
  finished_at: string | null;
}

export interface EmailIngestionMessage {
  id: string;
  tenant_id: string;
  run_id: string;
  external_message_id: string | null;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  attachment_count: number;
  result_status: string;
  invoice_import_job_id: string | null;
  error_message: string | null;
  created_at: string;
}

// ─── Email Accounts ─────────────────────────────────────────────

export function useEmailAccounts() {
  return useQuery({
    queryKey: ["email_accounts"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("email_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailAccount[];
    },
    staleTime: STALE_TIME,
  });
}

export function useEmailAccountById(id: string | null) {
  return useQuery({
    queryKey: ["email_accounts", "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from("email_accounts")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as EmailAccount;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useSaveEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailAccount> & { email_address: string; provider_type: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { data, error } = await (supabase as any)
          .from("email_accounts")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from("email_accounts")
          .insert(rest)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    },
  });
}

export function useDeleteEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("email_accounts")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    },
  });
}

export function useToggleEmailAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (supabase as any)
        .from("email_accounts")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
    },
  });
}

// ─── Ingestion Rules ────────────────────────────────────────────

export function useEmailIngestionRules(accountId: string | null) {
  return useQuery({
    queryKey: ["email_ingestion_rules", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("email_ingestion_rules")
        .select("*")
        .eq("email_account_id", accountId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailIngestionRule[];
    },
    staleTime: STALE_TIME,
    enabled: !!accountId,
  });
}

export function useSaveIngestionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<EmailIngestionRule> & { email_account_id: string }) => {
      const { id, ...rest } = payload;
      if (id) {
        const { data, error } = await (supabase as any)
          .from("email_ingestion_rules")
          .update(rest)
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from("email_ingestion_rules")
          .insert(rest)
          .select()
          .maybeSingle();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["email_ingestion_rules", vars.email_account_id] });
    },
  });
}

export function useDeleteIngestionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, accountId }: { id: string; accountId: string }) => {
      const { error } = await (supabase as any)
        .from("email_ingestion_rules")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return accountId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["email_ingestion_rules", vars.accountId] });
    },
  });
}

// ─── Ingestion Runs ─────────────────────────────────────────────

export function useEmailIngestionRuns(accountId: string | null, limit = 20) {
  return useQuery({
    queryKey: ["email_ingestion_runs", accountId, limit],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await (supabase as any)
        .from("email_ingestion_runs")
        .select("*")
        .eq("email_account_id", accountId)
        .order("started_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as EmailIngestionRun[];
    },
    staleTime: STALE_TIME,
    enabled: !!accountId,
  });
}

// ─── Clear Failed Runs ──────────────────────────────────────────

export function useClearFailedRuns() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { error } = await (supabase as any)
        .from("email_ingestion_runs")
        .delete()
        .eq("email_account_id", accountId)
        .eq("status", "failed");
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_ingestion_runs"] });
      qc.invalidateQueries({ queryKey: ["email_ingestion_summary"] });
    },
  });
}

// ─── Ingestion Messages ─────────────────────────────────────────

export function useEmailIngestionMessages(runId: string | null) {
  return useQuery({
    queryKey: ["email_ingestion_messages", runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await (supabase as any)
        .from("email_ingestion_messages")
        .select("*")
        .eq("run_id", runId)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return (data || []) as EmailIngestionMessage[];
    },
    staleTime: STALE_TIME,
    enabled: !!runId,
  });
}

// ─── KPI Summary ────────────────────────────────────────────────

export function useEmailIngestionSummary() {
  return useQuery({
    queryKey: ["email_ingestion_summary"],
    queryFn: async () => {
      const { data: accounts = [] } = await (supabase as any)
        .from("email_accounts")
        .select("id, is_active");

      const activeCount = accounts.filter((a: any) => a.is_active).length;

      // Last 30 days runs
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: runs = [] } = await (supabase as any)
        .from("email_ingestion_runs")
        .select("processed_count, imported_count, error_count")
        .gte("started_at", since.toISOString());

      let totalProcessed = 0;
      let totalImported = 0;
      let totalErrors = 0;
      for (const r of runs) {
        totalProcessed += r.processed_count || 0;
        totalImported += r.imported_count || 0;
        totalErrors += r.error_count || 0;
      }

      return {
        active_accounts: activeCount,
        total_accounts: accounts.length,
        emails_processed_30d: totalProcessed,
        invoices_imported_30d: totalImported,
        errors_30d: totalErrors,
      };
    },
    staleTime: STALE_TIME,
  });
}

// ─── Trigger Sync ───────────────────────────────────────────────

export function useTriggerEmailSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (accountId: string) => {
      const { data, error } = await supabase.functions.invoke("email-ingestion", {
        body: { action: "sync", email_account_id: accountId },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email_accounts"] });
      qc.invalidateQueries({ queryKey: ["email_ingestion_runs"] });
      qc.invalidateQueries({ queryKey: ["email_ingestion_summary"] });
    },
  });
}
