import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import type { IntegrationProvider, IntegrationConnection } from "./types";

const UUID_LIKE_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function slugifyProviderKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Known supplier provider keys — maps provider catalog ID or label to canonical key */
const KNOWN_SUPPLIER_KEYS: Record<string, string> = {
  edeltec: "edeltec",
  "c43e8a33-0c83-414e-8391-9c9dd648d731": "edeltec",
  jng: "jng",
  vertys: "vertys",
};

/** Known supplier fornecedor_id — maps provider key to fornecedores UUID.
 *  JNG and Vertys are proxy-based (solaryum-proxy) and don't have fornecedores rows. */
const SUPPLIER_FORNECEDOR_IDS: Record<string, string> = {
  edeltec: "a1b2c3d4-0001-4000-8000-000000000001",
  // jng and vertys intentionally omitted — they fetch kits in real-time via solaryum-proxy
};

/** Edge function name per supplier for sync/test */
const SUPPLIER_SYNC_FUNCTIONS: Record<string, string> = {
  edeltec: "edeltec-sync",
  jng: "jng-hub-sync",
};

/** Resolve canonical key used by integrations_api_configs for supplier providers */
export function resolveSupplierProviderKey(providerId: string, providerLabel?: string): string {
  const normalizedId = (providerId || "").trim().toLowerCase();
  const normalizedLabel = (providerLabel || "").trim().toLowerCase();

  // Check known suppliers — exact match first, then substring
  if (KNOWN_SUPPLIER_KEYS[normalizedId]) {
    return KNOWN_SUPPLIER_KEYS[normalizedId];
  }
  for (const [keyword, key] of Object.entries(KNOWN_SUPPLIER_KEYS)) {
    if (normalizedId.includes(keyword) || normalizedLabel.includes(keyword)) {
      return key;
    }
  }

  if (normalizedId && !UUID_LIKE_REGEX.test(normalizedId)) {
    return slugifyProviderKey(normalizedId);
  }

  if (normalizedLabel) {
    return slugifyProviderKey(normalizedLabel);
  }

  return normalizedId || "supplier";
}

async function getCurrentTenantId(): Promise<string> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const userId = authData?.user?.id;

  if (authError || !userId) {
    throw new Error("Usuário não autenticado");
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data?.tenant_id) {
    throw new Error("Tenant não encontrado para o usuário atual");
  }

  return data.tenant_id;
}

async function findSupplierConfig(
  tenantId: string,
  providerId: string,
  providerLabel?: string
): Promise<{ config: any | null; providerKey: string }> {
  const providerKey = resolveSupplierProviderKey(providerId, providerLabel);

  const { data, error } = await (supabase as any)
    .from("integrations_api_configs")
    .select("id, provider, name, is_active, status, last_sync_at, last_tested_at, fornecedor_id, settings, credentials")
    .eq("tenant_id", tenantId);

  if (error) throw error;

  const config = ((data as any[]) || []).find((row) => {
    const settings = (row?.settings || {}) as Record<string, unknown>;
    return row.provider === providerKey || settings.provider_catalog_id === providerId;
  }) || null;

  return { config, providerKey };
}

async function testSupplierConnection(
  tenantId: string,
  apiConfigId: string,
  providerKey: string,
  fornecedorId?: string | null
): Promise<void> {
  // Solaryum-based providers (JNG, Vertys): test via BuscarFiltros (no IBGE needed)
  if (providerKey === "jng" || providerKey === "vertys") {
    const distribuidor = providerKey as "jng" | "vertys";
    const { data, error } = await supabase.functions.invoke("solaryum-proxy", {
      body: { distribuidor, endpoint: "BuscarFiltros", params: {} },
    });
    if (error) {
      const parsed = await parseInvokeError(error);
      throw new Error(parsed.message);
    }
    if (!data) {
      throw new Error("Falha ao validar credenciais — resposta vazia do Solaryum");
    }
    return;
  }

  const fnName = SUPPLIER_SYNC_FUNCTIONS[providerKey];
  if (!fnName) return;

  const body: Record<string, unknown> = {
    tenant_id: tenantId,
    api_config_id: apiConfigId,
    test_only: true,
  };

  // JNG requires fornecedor_id
  if (fornecedorId) body.fornecedor_id = fornecedorId;

  const { data, error } = await supabase.functions.invoke(fnName, { body });

  if (error) {
    const parsed = await parseInvokeError(error);
    throw new Error(parsed.message);
  }

  if (!data?.success) {
    throw new Error(data?.error || "Falha ao validar credenciais do fornecedor");
  }
}

async function updateSupplierConfigState(
  apiConfigId: string,
  patch: Record<string, unknown>,
  settingsPatch?: Record<string, unknown>
): Promise<void> {
  const payload: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };

  if (settingsPatch) {
    const { data: current } = await (supabase as any)
      .from("integrations_api_configs")
      .select("settings")
      .eq("id", apiConfigId)
      .single();

    payload.settings = {
      ...((current?.settings || {}) as Record<string, unknown>),
      ...settingsPatch,
    };
  }

  await (supabase as any)
    .from("integrations_api_configs")
    .update(payload)
    .eq("id", apiConfigId);
}

/** Fetch all providers from catalog */
export async function listProviders(): Promise<IntegrationProvider[]> {
  const { data, error } = await supabase
    .from("integration_providers" as any)
    .select("id, category, label, description, logo_key, status, auth_type, credential_schema, tutorial, capabilities, platform_managed_keys, popularity, created_at, updated_at")
    .order("popularity", { ascending: false });
  if (error) throw error;
  return (data as unknown as IntegrationProvider[]) || [];
}

/** Fetch all connections for current tenant */
export async function listConnections(): Promise<IntegrationConnection[]> {
  const { data, error } = await supabase
    .from("integration_connections" as any)
    .select("id, tenant_id, provider_id, status, credentials, tokens, config, last_sync_at, sync_error, created_at, updated_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  const canonical = ((data as unknown as IntegrationConnection[]) || []);

  // Merge supplier/API integrations as synthetic connections for unified UI status.
  const { data: apiConfigs, error: apiError } = await (supabase as any)
    .from("integrations_api_configs")
    .select("id, tenant_id, provider, status, is_active, last_sync_at, settings, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (apiError) throw apiError;

  const supplierConnections: IntegrationConnection[] = ((apiConfigs as any[]) || [])
    .map((row) => {
      const settings = (row.settings || {}) as Record<string, unknown>;
      const providerCatalogId = String(settings.provider_catalog_id || "").trim();
      const providerId = providerCatalogId || row.provider;

      let status: IntegrationConnection["status"] = "disconnected";
      if (row.status === "error") status = "error";
      else if (row.is_active && (row.status === "connected" || row.status === "active")) status = "connected";
      else if (row.is_active) status = "connected";

      return {
        id: `api_${row.id}`,
        tenant_id: row.tenant_id,
        provider_id: providerId,
        status,
        credentials: {},
        tokens: {},
        config: {
          source: "integrations_api_configs",
          api_config_id: row.id,
          provider_key: row.provider,
        },
        last_sync_at: row.last_sync_at,
        sync_error: typeof settings.last_error === "string" ? settings.last_error : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
      } as IntegrationConnection;
    })
    .filter((conn) => !!conn.provider_id);

  const mergedByProvider = new Map<string, IntegrationConnection>();
  for (const conn of [...canonical, ...supplierConnections]) {
    if (!mergedByProvider.has(conn.provider_id)) {
      mergedByProvider.set(conn.provider_id, conn);
    }
  }

  return Array.from(mergedByProvider.values());
}

/** Connect a provider via edge function */
export async function connectProvider(
  providerId: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-connect", {
    body: { provider: providerId, credentials },
  });
  if (error) {
    const parsed = await parseInvokeError(error);
    return { success: false, error: parsed.message };
  }
  if (data?.error) return { success: false, error: data.error };
  return { success: true };
}

/** Connect a supplier provider (ex.: Edeltec) via integrations_api_configs */
export async function connectSupplierProvider(
  providerId: string,
  providerLabel: string,
  credentials: Record<string, string>
): Promise<{ success: boolean; config_id?: string; error?: string }> {
  let affectedConfigId: string | undefined;
  let resolvedProviderKey: string | undefined;
  try {
    const tenantId = await getCurrentTenantId();
    const { config, providerKey } = await findSupplierConfig(tenantId, providerId, providerLabel);
    resolvedProviderKey = providerKey;

    // console.log("[connectSupplierProvider] providerId:", providerId, "providerLabel:", providerLabel, "resolved key:", providerKey, "config found:", !!config, "config.provider:", config?.provider);

    // Provider-specific credential validation
    const existingCreds = (config?.credentials as Record<string, string>) || {};
    const mergedForValidation = { ...existingCreds, ...credentials };

    if (providerKey === "edeltec") {
      if (!mergedForValidation.apiKey?.trim() || !mergedForValidation.secret?.trim()) {
        throw new Error("Informe API Key e Secret para conectar a Edeltec");
      }
    } else if (providerKey === "jng" || providerKey === "vertys") {
      if (!mergedForValidation.token?.trim()) {
        throw new Error(`Informe o Token de acesso para conectar a ${providerKey === "jng" ? "JNG" : "Vertys"}`);
      }
    } else {
      // Generic: require at least one non-empty credential
      const hasAny = Object.values(mergedForValidation).some(v => typeof v === "string" && v.trim());
      if (!hasAny) throw new Error("Informe as credenciais para conectar o fornecedor");
    }
    const isProxyProvider = providerKey === "jng" || providerKey === "vertys";
    const fornecedorId = isProxyProvider ? null : (SUPPLIER_FORNECEDOR_IDS[providerKey] || config?.fornecedor_id || null);
    const now = new Date().toISOString();

    const mergedSettings = {
      ...(config?.settings || {}),
      provider_catalog_id: providerId,
      provider_label: providerLabel,
    };

    if (config?.id) {
      // Merge new credentials with existing ones so unchanged secret fields are preserved
      const existingCreds = (config.credentials as Record<string, string>) || {};
      const mergedCredentials = { ...existingCreds, ...credentials };

      const updatePayload: Record<string, unknown> = {
          provider: providerKey,
          name: config.name || providerLabel,
          credentials: mergedCredentials,
          status: "pending",
          is_active: true,
          settings: mergedSettings,
          updated_at: now,
        };
      // Clear fake fornecedor_id for proxy-based providers
      if (isProxyProvider) updatePayload.fornecedor_id = null;

      const { error: updateError } = await (supabase as any)
        .from("integrations_api_configs")
        .update(updatePayload)
        .eq("id", config.id);

      if (updateError) throw updateError;
      affectedConfigId = config.id;

      await testSupplierConnection(tenantId, config.id, providerKey, fornecedorId);

      const testedAt = new Date().toISOString();
      await updateSupplierConfigState(config.id, {
          status: "connected",
          is_active: true,
          last_tested_at: testedAt,
        }, {
          last_error: null,
        });

      return { success: true, config_id: config.id };
    }

    const { data: inserted, error: insertError } = await (supabase as any)
      .from("integrations_api_configs")
      .insert({
        tenant_id: tenantId,
        provider: providerKey,
        name: providerLabel,
        credentials,
        fornecedor_id: fornecedorId,
        status: "pending",
        is_active: true,
        settings: mergedSettings,
      })
      .select("id")
      .single();

    if (insertError) throw insertError;
    affectedConfigId = inserted?.id;

    await testSupplierConnection(tenantId, inserted?.id, providerKey, fornecedorId);

    const testedAt = new Date().toISOString();
    await updateSupplierConfigState(inserted?.id, {
        status: "connected",
        is_active: true,
        last_tested_at: testedAt,
      }, {
        last_error: null,
      });

    return { success: true, config_id: inserted?.id };
  } catch (error: any) {
    if (affectedConfigId) {
      // Proxy-based providers (JNG/Vertys) stay is_active=true even on test failure
      // because they don't need sync — the proxy reads credentials on demand
      const provKey = resolvedProviderKey ?? "";
      const keepActive = provKey === "jng" || provKey === "vertys";
      await updateSupplierConfigState(affectedConfigId, {
        status: "error",
        is_active: keepActive,
      }, {
        last_error: error?.message || "Falha ao conectar fornecedor",
      });
    }
    return { success: false, error: error?.message || "Falha ao conectar fornecedor" };
  }
}

/** Sync a provider via edge function */
export async function syncProvider(
  providerId: string,
  mode: "full" | "partial" = "full"
): Promise<{ success: boolean; plants_synced?: number; metrics_synced?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("monitoring-sync", {
    body: { provider: providerId, mode },
  });
  if (error) {
    const parsed = await parseInvokeError(error);
    return { success: false, error: parsed.message };
  }
  if (data?.error) return { success: false, error: data.error };
  return { success: true, plants_synced: data?.plants_synced, metrics_synced: data?.metrics_synced };
}

/** Sync supplier provider (Edeltec, JNG, etc.) */
export async function syncSupplierProvider(
  providerId: string,
  providerLabel: string
): Promise<{ success: boolean; total_fetched?: number; created?: number; updated?: number; skipped?: number; error?: string }> {
  const providerKey = resolveSupplierProviderKey(providerId, providerLabel);
  const fnName = SUPPLIER_SYNC_FUNCTIONS[providerKey];
  if (!fnName) {
    return { success: false, error: `Sincronização automática indisponível para ${providerLabel}` };
  }

  try {
    const tenantId = await getCurrentTenantId();
    const { config } = await findSupplierConfig(tenantId, providerId, providerLabel);

    if (!config?.id) {
      return { success: false, error: "Conexão não encontrada. Conecte o fornecedor primeiro." };
    }

    if (!config.is_active) {
      return { success: false, error: "Conexão desativada. Ative e tente novamente." };
    }

    const fornecedorId = config.fornecedor_id || SUPPLIER_FORNECEDOR_IDS[providerKey] || null;

    const { data, error } = await supabase.functions.invoke(fnName, {
      body: {
        tenant_id: tenantId,
        api_config_id: config.id,
        fornecedor_id: fornecedorId,
      },
    });

    if (error) {
      await updateSupplierConfigState(config.id, {
        status: "error",
      }, {
        last_error: (await parseInvokeError(error)).message,
      });
      const parsed = await parseInvokeError(error);
      return { success: false, error: parsed.message };
    }

    if (!data?.success) {
      await updateSupplierConfigState(config.id, {
        status: "error",
      }, {
        last_error: data?.error || "Erro ao sincronizar fornecedor",
      });
      return { success: false, error: data?.error || "Erro ao sincronizar fornecedor" };
    }

    // Auto-continuar batches até completar todas as páginas
    let lastResult = data;
    let maxRetries = 50;
    while (lastResult?.success && !lastResult?.is_complete && maxRetries > 0) {
      maxRetries--;
      const { data: contData, error: contErr } = await supabase.functions.invoke(fnName, {
        body: {
          tenant_id: tenantId,
          api_config_id: config.id,
          fornecedor_id: fornecedorId,
        },
      });
      if (contErr || !contData?.success) break;
      lastResult = contData;
    }

    await updateSupplierConfigState(config.id, {
        status: "connected",
        last_sync_at: new Date().toISOString(),
      }, {
        last_error: null,
      });

    return {
      success: true,
      total_fetched: lastResult?.total_fetched ?? data.total_fetched,
      created: lastResult?.created ?? data.created,
      updated: lastResult?.updated ?? data.updated,
      skipped: lastResult?.skipped ?? data.skipped,
    };
  } catch (error: any) {
    return { success: false, error: error?.message || "Falha ao sincronizar fornecedor" };
  }
}

/** Disconnect a provider */
export async function disconnectProvider(providerId: string, providerLabel?: string): Promise<{ success: boolean; error?: string }> {
  const { data: connRaw } = await (supabase
    .from("integration_connections" as any)
    .select("id")
    .eq("provider_id", providerId)
    .single() as any);

  if (connRaw?.id) {
    await (supabase
      .from("integration_connections" as any)
      .update({ status: "disconnected", tokens: {}, credentials: {}, sync_error: null })
      .eq("id", connRaw.id) as any);
  }

  // Also disconnect from legacy monitoring_integrations if exists
  await supabase
    .from("monitoring_integrations" as any)
    .update({ status: "disconnected", tokens: {}, credentials: {} } as any)
    .eq("provider", providerId);

  // Supplier integrations (integrations_api_configs)
  try {
    const tenantId = await getCurrentTenantId();
    const { config, providerKey } = await findSupplierConfig(tenantId, providerId, providerLabel);
    if (config?.id) {
      const keepActive = providerKey === "jng" || providerKey === "vertys";
      await (supabase as any)
        .from("integrations_api_configs")
        .update({
          status: "disconnected",
          is_active: keepActive ? true : false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", config.id);
    }
  } catch {
    // no-op: keep backward compatibility for monitoring-only providers
  }

  return { success: true };
}
