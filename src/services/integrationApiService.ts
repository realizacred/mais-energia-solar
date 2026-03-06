/**
 * IntegrationApiService — Canonical service for API integration configs.
 * SRP: CRUD + test connection + masking.
 */
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationApiConfig {
  id: string;
  tenant_id: string;
  provider: string;
  name: string;
  status: string;
  region: string | null;
  base_url: string | null;
  credentials: Record<string, any>;
  settings: Record<string, any>;
  last_tested_at: string | null;
  last_sync_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const COLS = `id, tenant_id, provider, name, status, region, base_url, credentials, settings, last_tested_at, last_sync_at, is_active, created_at, updated_at`;

/** Mask secret fields for display */
function maskCredentials(creds: Record<string, any>): Record<string, any> {
  const masked: Record<string, any> = {};
  for (const [k, v] of Object.entries(creds)) {
    if (typeof v === "string" && v.length > 6) {
      masked[k] = v.slice(0, 4) + "••••" + v.slice(-4);
    } else {
      masked[k] = "••••";
    }
  }
  return masked;
}

/** Strip sensitive token data from settings before sending to client */
function sanitizeSettings(settings: Record<string, any>): Record<string, any> {
  if (!settings || typeof settings !== "object") return {};
  const { token_info, access_token, refresh_token, ...safe } = settings;
  return safe;
}

export const integrationApiService = {
  async list() {
    const { data, error } = await (supabase as any)
      .from("integrations_api_configs")
      .select(COLS)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map((d: any) => ({
      ...d,
      credentials: maskCredentials(d.credentials || {}),
    })) as IntegrationApiConfig[];
  },

  async getById(id: string) {
    const { data, error } = await (supabase as any)
      .from("integrations_api_configs")
      .select(COLS)
      .eq("id", id)
      .single();
    if (error) throw error;
    return {
      ...data,
      credentials: maskCredentials(data.credentials || {}),
    } as IntegrationApiConfig;
  },

  async create(input: {
    provider: string;
    name: string;
    region?: string;
    base_url?: string;
    credentials: Record<string, any>;
    settings?: Record<string, any>;
  }) {
    const { data, error } = await (supabase as any)
      .from("integrations_api_configs")
      .insert(input)
      .select(COLS)
      .single();
    if (error) throw error;
    return data as IntegrationApiConfig;
  },

  async update(id: string, input: Partial<IntegrationApiConfig>) {
    const { credentials, ...rest } = input as any;
    const payload: any = { ...rest, updated_at: new Date().toISOString() };
    // Only send credentials if explicitly provided (non-masked)
    if (credentials) payload.credentials = credentials;
    const { data, error } = await (supabase as any)
      .from("integrations_api_configs")
      .update(payload)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw error;
    return data as IntegrationApiConfig;
  },

  async toggleActive(id: string, active: boolean) {
    return this.update(id, { is_active: active, status: active ? "active" : "inactive" } as any);
  },

  async updateTestResult(id: string, success: boolean) {
    return this.update(id, {
      last_tested_at: new Date().toISOString(),
      status: success ? "connected" : "error",
    } as any);
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from("integrations_api_configs")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },
};
