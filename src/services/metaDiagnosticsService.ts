import { supabase } from "@/integrations/supabase/client";
import { parseEdgeFunctionError } from "@/lib/parseEdgeFunctionError";

export type TokenDiagnosticStatus = "VALID" | "EXPIRED" | "INVALID";
export type LeadAccessDiagnosticStatus = "GRANTED" | "REVOKED";
export type WebhookDiagnosticStatus = "SUBSCRIBED" | "NOT_SUBSCRIBED";

export interface TokenDiagnostic {
  status: TokenDiagnosticStatus;
  message: string;
  error_code?: number | null;
  expires_at?: number | null;
  scopes?: string[];
  missing_critical_scopes?: string[];
  has_pages_manage_metadata?: boolean;
}

export interface LeadPageDetail {
  page_id: string;
  page_name: string;
  has_lead_task: boolean;
  retrieval_ok: boolean;
  error_message?: string;
}

export interface LeadAccessDiagnostic {
  status: LeadAccessDiagnosticStatus;
  message: string;
  page_id?: string | null;
  page_name?: string | null;
  form_sample_id?: string | null;
  details: LeadPageDetail[];
}

export interface WebhookDiagnostic {
  status: WebhookDiagnosticStatus;
  message: string;
  callback_url_expected: string;
  callback_url_meta?: string | null;
  verify_token_configured: boolean;
  page_id_checked?: string | null;
  subscribed_fields?: string[];
  reasons?: string[];
}

export interface MetaDiagnosticsResult {
  generated_at: string;
  statuses: {
    token: TokenDiagnostic;
    lead_access: LeadAccessDiagnostic;
    webhook: WebhookDiagnostic;
  };
  context: {
    app_id: string | null;
    pages_checked: number;
    has_pages_manage_metadata: boolean;
  };
}

export async function fetchMetaDiagnostics(): Promise<MetaDiagnosticsResult> {
  const { data, error } = await supabase.functions.invoke("meta-facebook-diagnostics", {
    body: { manual: true },
  });

  if (error) {
    const message = await parseEdgeFunctionError(error, "Erro ao executar diagnóstico Meta");
    throw new Error(message);
  }

  if (!data?.success || !data?.statuses) {
    throw new Error(data?.error || "Resposta inválida no diagnóstico Meta");
  }

  return {
    generated_at: data.generated_at,
    statuses: data.statuses,
    context: {
      app_id: data.context?.app_id ?? null,
      pages_checked: Number(data.context?.pages_checked ?? 0),
      has_pages_manage_metadata: Boolean(data.context?.has_pages_manage_metadata),
    },
  };
}
