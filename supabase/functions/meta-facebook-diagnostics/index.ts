import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type TokenStatus = "VALID" | "EXPIRED" | "INVALID";
type LeadAccessStatus = "GRANTED" | "REVOKED";
type WebhookStatus = "SUBSCRIBED" | "NOT_SUBSCRIBED";

interface TenantConfig {
  appId: string | null;
  userAccessToken: string | null;
  appSecret: string | null;
  verifyToken: string | null;
}

interface PageCandidate {
  id: string;
  name: string;
  access_token?: string;
  tasks?: string[];
  perms?: string[];
}

interface LeadCheckDetail {
  page_id: string;
  page_name: string;
  has_lead_task: boolean;
  retrieval_ok: boolean;
  error_message?: string;
  page_access_token?: string;
}

function createAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

function buildJsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseGraphError(body: any): { code?: number; message: string } {
  const graphErr = body?.error;
  return {
    code: graphErr?.code,
    message:
      graphErr?.error_user_msg ||
      graphErr?.message ||
      "Erro desconhecido na Graph API",
  };
}

async function graphGet(
  path: string,
  params: Record<string, string>
): Promise<{ ok: true; data: any } | { ok: false; code?: number; message: string }> {
  const url = new URL(`https://graph.facebook.com/v22.0${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      signal: AbortSignal.timeout(15000),
    });
    const body = await response.json();

    if (!response.ok) {
      const parsed = parseGraphError(body);
      return { ok: false, code: parsed.code, message: parsed.message };
    }

    return { ok: true, data: body };
  } catch (error: any) {
    return { ok: false, message: error?.message || "Falha de rede ao consultar Graph API" };
  }
}

async function resolveUserContext(admin: ReturnType<typeof createAdminClient>, authHeader: string) {
  const token = authHeader.replace("Bearer ", "");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  if (!token || token === anonKey) {
    throw new Error("Sessão inválida. Faça login novamente.");
  }

  const { data: { user }, error: authError } = await admin.auth.getUser(token);
  if (authError || !user) {
    throw new Error("Token inválido ou expirado.");
  }

  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["admin", "gerente"])
    .limit(1)
    .maybeSingle();

  if (!roleRow) {
    throw new Error("Apenas admin/gerente pode executar diagnóstico.");
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.tenant_id) {
    throw new Error("Tenant não encontrado para o usuário autenticado.");
  }

  const { data: tenant } = await admin
    .from("tenants")
    .select("status, ativo, deleted_at")
    .eq("id", profile.tenant_id)
    .maybeSingle();

  if (!tenant || tenant.status !== "active" || !tenant.ativo || tenant.deleted_at) {
    const err = new Error("Tenant inativo");
    (err as any).code = 403;
    throw err;
  }

  return { tenantId: profile.tenant_id };
}

async function getTenantMetaConfig(admin: ReturnType<typeof createAdminClient>, tenantId: string): Promise<TenantConfig> {
  const { data } = await admin
    .from("integration_configs")
    .select("service_key, api_key")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .in("service_key", [
      "meta_facebook_app_id",
      "meta_facebook",
      "meta_facebook_app_secret",
      "meta_facebook_verify_token",
    ]);

  const cfg: TenantConfig = {
    appId: null,
    userAccessToken: null,
    appSecret: null,
    verifyToken: null,
  };

  for (const row of data ?? []) {
    if (row.service_key === "meta_facebook_app_id") cfg.appId = row.api_key;
    if (row.service_key === "meta_facebook") cfg.userAccessToken = row.api_key;
    if (row.service_key === "meta_facebook_app_secret") cfg.appSecret = row.api_key;
    if (row.service_key === "meta_facebook_verify_token") cfg.verifyToken = row.api_key;
  }

  return cfg;
}

async function checkToken(config: TenantConfig): Promise<{
  status: TokenStatus;
  message: string;
  error_code?: number | null;
  expires_at?: number | null;
  scopes?: string[];
  missing_critical_scopes?: string[];
  has_pages_manage_metadata?: boolean;
}> {
  if (!config.userAccessToken || !config.appId || !config.appSecret) {
    return {
      status: "INVALID",
      message: "Configuração incompleta: faltam token, app_id ou app_secret.",
    };
  }

  const appAccessToken = `${config.appId}|${config.appSecret}`;
  const res = await graphGet("/debug_token", {
    input_token: config.userAccessToken,
    access_token: appAccessToken,
  });

  if (!res.ok) {
    return {
      status: res.code === 190 ? "EXPIRED" : "INVALID",
      message: res.message,
      error_code: res.code ?? null,
    };
  }

  const tokenData = res.data?.data;
  const expiresAt = Number(tokenData?.expires_at || 0);
  const nowSec = Math.floor(Date.now() / 1000);
  const expired = expiresAt > 0 && expiresAt <= nowSec;

  if (!tokenData?.is_valid || expired) {
    return {
      status: expired ? "EXPIRED" : "INVALID",
      message: expired ? "Token expirado." : "Token inválido para este app.",
      expires_at: tokenData?.expires_at ?? null,
      scopes: tokenData?.scopes || [],
    };
  }

  const scopes: string[] = tokenData?.scopes || [];
  // Only check scopes that debug_token actually returns.
  // leads_retrieval and pages_manage_ads are app-level permissions (App Review),
  // NOT token scopes — they are validated in the Lead Access check instead.
  const REQUIRED_SCOPES = ["pages_show_list"];
  const RECOMMENDED_SCOPES = ["ads_management", "pages_read_engagement"];
  const missingRequired = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));
  const missingRecommended = RECOMMENDED_SCOPES.filter((s) => !scopes.includes(s));
  const hasManageMetadata = scopes.includes("pages_manage_metadata");

  const status: TokenStatus = missingRequired.length > 0 ? "INVALID" : "VALID";
  let message: string;
  if (missingRequired.length > 0) {
    message = `Token válido, mas faltam scopes obrigatórios: ${missingRequired.join(", ")}.`;
  } else if (missingRecommended.length > 0) {
    message = `Token válido. Scopes recomendados ausentes: ${missingRecommended.join(", ")}.`;
  } else {
    message = hasManageMetadata
      ? "Token válido com todas as permissões (incluindo pages_manage_metadata)."
      : "Token válido. pages_manage_metadata ausente — webhook deve ser assinado manualmente no Meta.";
  }

  return {
    status,
    message,
    expires_at: tokenData?.expires_at ?? null,
    scopes,
    missing_critical_scopes: missingRequired.length > 0 ? missingRequired : undefined,
    has_pages_manage_metadata: hasManageMetadata,
  };
}

async function loadPages(userAccessToken: string): Promise<{ pages: PageCandidate[]; error?: string }> {
  const pagesRes = await graphGet("/me/accounts", {
    fields: "id,name,access_token,tasks",
    limit: "25",
    access_token: userAccessToken,
  });

  if (!pagesRes.ok) {
    return { pages: [], error: pagesRes.message };
  }

  return { pages: pagesRes.data?.data || [] };
}

async function checkLeadAccess(config: TenantConfig): Promise<{
  status: LeadAccessStatus;
  message: string;
  page_id?: string | null;
  page_name?: string | null;
  form_sample_id?: string | null;
  details: Omit<LeadCheckDetail, "page_access_token">[];
  page_for_webhook?: LeadCheckDetail;
}> {
  if (!config.userAccessToken) {
    return {
      status: "REVOKED",
      message: "Token de acesso não configurado.",
      details: [],
    };
  }

  const { pages, error } = await loadPages(config.userAccessToken);
  if (error) {
    return {
      status: "REVOKED",
      message: `Falha ao listar páginas: ${error}`,
      details: [],
    };
  }

  if (!pages.length) {
    return {
      status: "REVOKED",
      message: "O token não possui acesso a nenhuma Página.",
      details: [],
    };
  }

  const details: LeadCheckDetail[] = [];
  let firstGranted: LeadCheckDetail | null = null;
  let formSampleId: string | null = null;

  for (const page of pages) {
    const tasks = page.tasks || [];
    const hasLeadTask = tasks.includes("LEADS_RETRIEVAL") || tasks.includes("MANAGE_LEADS") || tasks.includes("ADMINISTER");

    if (!page.access_token) {
      details.push({
        page_id: page.id,
        page_name: page.name,
        has_lead_task: hasLeadTask,
        retrieval_ok: false,
        error_message: "Página sem page access token.",
      });
      continue;
    }

    const formsRes = await graphGet(`/${page.id}/leadgen_forms`, {
      fields: "id,name,status",
      limit: "1",
      access_token: page.access_token,
    });

    if (formsRes.ok) {
      const sampleForm = formsRes.data?.data?.[0];
      const item: LeadCheckDetail = {
        page_id: page.id,
        page_name: page.name,
        has_lead_task: hasLeadTask,
        retrieval_ok: true,
        page_access_token: page.access_token,
      };
      details.push(item);
      if (!firstGranted) {
        firstGranted = item;
        formSampleId = sampleForm?.id || null;
      }
      continue;
    }

    details.push({
      page_id: page.id,
      page_name: page.name,
      has_lead_task: hasLeadTask,
      retrieval_ok: false,
      error_message: formsRes.message,
    });
  }

  if (!firstGranted) {
    return {
      status: "REVOKED",
      message: "Lead Access revogado ou sem permissão leads_retrieval para as páginas disponíveis.",
      details: details.map(({ page_access_token, ...safe }) => safe),
    };
  }

  return {
    status: "GRANTED",
    message: `Lead Access confirmado na página ${firstGranted.page_name}.`,
    page_id: firstGranted.page_id,
    page_name: firstGranted.page_name,
    form_sample_id: formSampleId,
    details: details.map(({ page_access_token, ...safe }) => safe),
    page_for_webhook: firstGranted,
  };
}

async function checkWebhookSubscription(
  config: TenantConfig,
  pageFromLeadCheck: LeadCheckDetail | undefined
): Promise<{
  status: WebhookStatus;
  message: string;
  callback_url_expected: string;
  callback_url_meta?: string | null;
  verify_token_configured: boolean;
  page_id_checked?: string | null;
  subscribed_fields?: string[];
  reasons?: string[];
}> {
  const callbackExpected = `${Deno.env.get("SUPABASE_URL")}/functions/v1/facebook-lead-webhook`;
  const reasons: string[] = [];

  if (!config.appId || !config.appSecret) {
    return {
      status: "NOT_SUBSCRIBED",
      message: "Não foi possível validar webhook: app_id/app_secret ausentes.",
      callback_url_expected: callbackExpected,
      verify_token_configured: Boolean(config.verifyToken),
      reasons: ["Configuração incompleta de app_id/app_secret."],
    };
  }

  const appAccessToken = `${config.appId}|${config.appSecret}`;
  const appSubscriptionsRes = await graphGet(`/${config.appId}/subscriptions`, {
    access_token: appAccessToken,
  });

  let callbackUrlMeta: string | null = null;
  let subscribedFields: string[] = [];

  if (!appSubscriptionsRes.ok) {
    reasons.push(`Falha ao consultar subscriptions do app: ${appSubscriptionsRes.message}`);
  } else {
    const pageSub = (appSubscriptionsRes.data?.data || []).find((sub: any) => sub.object === "page");
    if (!pageSub) {
      reasons.push("App não possui subscription para objeto 'page'.");
    } else {
      callbackUrlMeta = pageSub.callback_url || null;
      subscribedFields = pageSub.fields || [];
      if (!subscribedFields.includes("leadgen")) {
        reasons.push("App subscription sem campo 'leadgen'.");
      }
      if (callbackUrlMeta !== callbackExpected) {
        reasons.push("Callback URL no Meta não corresponde ao endpoint esperado.");
      }
    }
  }

  let pageIdChecked: string | null = null;
  if (!pageFromLeadCheck?.page_access_token) {
    reasons.push("Nenhuma página com Lead Access confirmado para validar subscribed_apps.");
  } else {
    pageIdChecked = pageFromLeadCheck.page_id;
    const pageSubsRes = await graphGet(`/${pageFromLeadCheck.page_id}/subscribed_apps`, {
      fields: "id,name,subscribed_fields",
      access_token: pageFromLeadCheck.page_access_token,
    });

    if (!pageSubsRes.ok) {
      reasons.push(`Falha ao consultar subscribed_apps da página: ${pageSubsRes.message}`);
    } else {
      const appRow = (pageSubsRes.data?.data || []).find((item: any) => String(item.id) === String(config.appId));
      if (!appRow) {
        reasons.push("Este App ID não está autorizado na página (Lead Access Manager). ");
      } else {
        const appFields = appRow.subscribed_fields || [];
        if (!appFields.includes("leadgen")) {
          reasons.push("App autorizado na página, mas sem subscribed_field 'leadgen'.");
        }
      }
    }
  }

  const verifyTokenConfigured = Boolean(config.verifyToken);
  if (!verifyTokenConfigured) {
    reasons.push("Token de verificação do webhook não configurado.");
  }

  const ok = reasons.length === 0;
  return {
    status: ok ? "SUBSCRIBED" : "NOT_SUBSCRIBED",
    message: ok
      ? "Webhook assinado corretamente (leadgen + callback + app autorizado na página)."
      : "Webhook incompleto: revise os itens pendentes.",
    callback_url_expected: callbackExpected,
    callback_url_meta: callbackUrlMeta,
    verify_token_configured: verifyTokenConfigured,
    page_id_checked: pageIdChecked,
    subscribed_fields: subscribedFields,
    reasons,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return buildJsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return buildJsonResponse({ error: "Authentication required" }, 401);
    }

    const admin = createAdminClient();
    const { tenantId } = await resolveUserContext(admin, authHeader);
    const config = await getTenantMetaConfig(admin, tenantId);

    const token = await checkToken(config);
    const leadAccess = await checkLeadAccess(config);
    const webhook = await checkWebhookSubscription(config, leadAccess.page_for_webhook);

    return buildJsonResponse({
      success: true,
      generated_at: new Date().toISOString(),
      statuses: {
        token,
        lead_access: {
          status: leadAccess.status,
          message: leadAccess.message,
          page_id: leadAccess.page_id ?? null,
          page_name: leadAccess.page_name ?? null,
          form_sample_id: leadAccess.form_sample_id ?? null,
          details: leadAccess.details,
        },
        webhook,
      },
      context: {
        app_id: config.appId,
        pages_checked: leadAccess.details.length,
        has_pages_manage_metadata: token.has_pages_manage_metadata ?? false,
      },
    });
  } catch (error: any) {
    const status = error?.code === 403 ? 403 : 400;
    return buildJsonResponse(
      {
        error: error?.message || "Erro inesperado no diagnóstico Meta",
      },
      status
    );
  }
});
