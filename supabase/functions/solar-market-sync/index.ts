import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ──────────────────────────────────────────────────

function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw.replace(/\D/g, "");
}

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── SolarMarket API wrapper ─────────────────────────────────

interface SmConfig {
  id: string;
  tenant_id: string | null;
  enabled: boolean;
  base_url: string;
  auth_mode: string;
  api_token: string | null;
  auth_email: string | null;
  auth_password_encrypted: string | null;
  last_token: string | null;
  last_token_expires_at: string | null;
}

async function getSmToken(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig
): Promise<string> {
  // Direct token mode – use api_token directly, no login needed
  if (config.auth_mode === "token" && config.api_token) {
    console.log("[SM] Using direct API token");
    return config.api_token;
  }

  // Credentials mode – check cached token first
  if (config.last_token && config.last_token_expires_at) {
    const expires = new Date(config.last_token_expires_at);
    if (expires > new Date(Date.now() + 60_000)) {
      console.log("[SM] Using cached token");
      return config.last_token;
    }
  }

  if (!config.auth_email || !config.auth_password_encrypted) {
    throw new Error("Credenciais do SolarMarket não configuradas");
  }

  console.log("[SM] Authenticating with SolarMarket...");
  const res = await fetch(`${config.base_url}/auth/signin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: config.auth_email,
      password: config.auth_password_encrypted,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`SolarMarket auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data.token || data.access_token || data.accessToken;
  if (!token) throw new Error("Token não retornado pela API SolarMarket");

  // Cache token for 23 hours
  const expiresAt = new Date(Date.now() + 23 * 60 * 60_000).toISOString();
  await supabaseAdmin
    .from("solar_market_config")
    .update({ last_token: token, last_token_expires_at: expiresAt })
    .eq("id", config.id);

  console.log("[SM] Token obtained and cached");
  return token;
}

async function smFetch(
  baseUrl: string,
  path: string,
  token: string,
  retries = 2
): Promise<unknown> {
  const url = `${baseUrl}${path}`;
  console.log(`[SM] GET ${url}`);

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      const wait = Math.pow(2, attempt) * 1000;
      console.warn(`[SM] Rate limited, waiting ${wait}ms...`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      if (attempt < retries) {
        console.warn(`[SM] Request failed (${res.status}), retrying...`);
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
      throw new Error(`SM API error ${res.status}: ${text}`);
    }

    return await res.json();
  }

  throw new Error("Max retries exceeded");
}

// ── Sync logic ──────────────────────────────────────────────

interface SyncCounts {
  clients_synced: number;
  projects_synced: number;
  proposals_synced: number;
  funnels_synced: number;
  leads_linked: number;
  errors: string[];
}

async function syncClients(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig,
  token: string,
  counts: SyncCounts
) {
  try {
    const data = (await smFetch(config.base_url, "/clients", token)) as any;
    const clients = Array.isArray(data) ? data : data?.data || data?.clients || [];

    console.log(`[SM] Got ${clients.length} clients`);

    for (const client of clients) {
      const smClientId = client.id || client.clientId;
      if (!smClientId) continue;

      const phone = client.phone || client.telefone || "";
      const phoneNorm = normalizePhone(phone);

      const { error } = await supabaseAdmin
        .from("solar_market_clients")
        .upsert(
          {
            tenant_id: config.tenant_id,
            sm_client_id: smClientId,
            name: client.name || client.nome || "",
            email: client.email || "",
            phone: phone,
            phone_normalized: phoneNorm,
            payload: client,
          },
          { onConflict: "tenant_id,sm_client_id" }
        );

      if (error) {
        console.error(`[SM] Client upsert error for ${smClientId}:`, error.message);
        counts.errors.push(`client ${smClientId}: ${error.message}`);
      } else {
        counts.clients_synced++;
      }
    }

    return clients;
  } catch (err: any) {
    console.error("[SM] Sync clients error:", err.message);
    counts.errors.push(`clients: ${err.message}`);
    return [];
  }
}

async function syncProjectsForClient(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig,
  token: string,
  smClientId: number,
  counts: SyncCounts
) {
  try {
    const data = (await smFetch(
      config.base_url,
      `/projects?clientId=${smClientId}`,
      token
    )) as any;
    const projects = Array.isArray(data) ? data : data?.data || data?.projects || [];

    for (const project of projects) {
      const smProjectId = project.id || project.projectId;
      if (!smProjectId) continue;

      const { error } = await supabaseAdmin
        .from("solar_market_projects")
        .upsert(
          {
            tenant_id: config.tenant_id,
            sm_project_id: smProjectId,
            sm_client_id: smClientId,
            status: project.status || project.situacao || null,
            payload: project,
          },
          { onConflict: "tenant_id,sm_project_id" }
        );

      if (error) {
        counts.errors.push(`project ${smProjectId}: ${error.message}`);
      } else {
        counts.projects_synced++;
      }

      // Sync proposals for this project
      await syncProposalsForProject(
        supabaseAdmin, config, token, smProjectId, smClientId, counts
      );

      // Sync funnels for this project
      await syncFunnelsForProject(
        supabaseAdmin, config, token, smProjectId, counts
      );
    }
  } catch (err: any) {
    counts.errors.push(`projects for client ${smClientId}: ${err.message}`);
  }
}

async function syncProposalsForProject(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig,
  token: string,
  smProjectId: number,
  smClientId: number,
  counts: SyncCounts
) {
  try {
    const data = (await smFetch(
      config.base_url,
      `/projects/${smProjectId}/proposals`,
      token
    )) as any;
    const proposals = Array.isArray(data) ? data : data?.data || data?.proposals || [];

    for (const proposal of proposals) {
      const smProposalId = proposal.id || proposal.proposalId;
      if (!smProposalId) continue;

      const { error } = await supabaseAdmin
        .from("solar_market_proposals")
        .upsert(
          {
            tenant_id: config.tenant_id,
            sm_proposal_id: smProposalId,
            sm_project_id: smProjectId,
            sm_client_id: smClientId,
            status: proposal.status || null,
            generated_at: proposal.generatedAt || proposal.created_at || null,
            acceptance_date: proposal.acceptanceDate || null,
            rejection_date: proposal.rejectionDate || null,
            expiration_date: proposal.expirationDate || null,
            link_pdf: proposal.linkPdf || proposal.pdfUrl || null,
            payload: proposal,
          },
          { onConflict: "tenant_id,sm_proposal_id" }
        );

      if (error) {
        counts.errors.push(`proposal ${smProposalId}: ${error.message}`);
      } else {
        counts.proposals_synced++;
      }
    }
  } catch (err: any) {
    counts.errors.push(`proposals for project ${smProjectId}: ${err.message}`);
  }
}

async function syncFunnelsForProject(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig,
  token: string,
  smProjectId: number,
  counts: SyncCounts
) {
  try {
    const data = (await smFetch(
      config.base_url,
      `/projects/${smProjectId}/funnels`,
      token
    )) as any;

    const { error } = await supabaseAdmin
      .from("solar_market_funnels")
      .upsert(
        {
          tenant_id: config.tenant_id,
          sm_project_id: smProjectId,
          payload: data || {},
        },
        { onConflict: "tenant_id,sm_project_id" }
      );

    if (error) {
      counts.errors.push(`funnel ${smProjectId}: ${error.message}`);
    } else {
      counts.funnels_synced++;
    }
  } catch (err: any) {
    // Funnels endpoint may not exist for all projects
    console.warn(`[SM] Funnel fetch skipped for project ${smProjectId}: ${err.message}`);
  }
}

async function linkLeads(
  supabaseAdmin: ReturnType<typeof createClient>,
  config: SmConfig,
  counts: SyncCounts
) {
  console.log("[SM] Running automatic lead linking...");

  // Get all SM clients with phone_normalized
  const { data: smClients, error: fetchErr } = await supabaseAdmin
    .from("solar_market_clients")
    .select("sm_client_id, phone_normalized")
    .eq("tenant_id", config.tenant_id)
    .not("phone_normalized", "eq", "")
    .not("phone_normalized", "is", null);

  if (fetchErr || !smClients?.length) {
    console.log("[SM] No SM clients to link or error:", fetchErr?.message);
    return;
  }

  for (const smClient of smClients) {
    // Check if already linked
    const { data: existingLink } = await supabaseAdmin
      .from("lead_links")
      .select("id")
      .eq("sm_client_id", smClient.sm_client_id)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (existingLink) continue;

    // Find matching lead by phone
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("id")
      .eq("telefone_normalized", smClient.phone_normalized)
      .eq("tenant_id", config.tenant_id)
      .limit(1)
      .maybeSingle();

    if (!lead) continue;

    // Get first project for this client (if any)
    const { data: firstProject } = await supabaseAdmin
      .from("solar_market_projects")
      .select("sm_project_id")
      .eq("sm_client_id", smClient.sm_client_id)
      .eq("tenant_id", config.tenant_id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const { error: linkErr } = await supabaseAdmin
      .from("lead_links")
      .upsert(
        {
          tenant_id: config.tenant_id,
          lead_id: lead.id,
          sm_client_id: smClient.sm_client_id,
          sm_project_id: firstProject?.sm_project_id || null,
          link_reason: "auto_phone_match",
        },
        { onConflict: "tenant_id,lead_id,sm_client_id" }
      );

    if (!linkErr) {
      counts.leads_linked++;
      console.log(`[SM] Linked lead ${lead.id} ↔ SM client ${smClient.sm_client_id}`);
    }
  }
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Parse request
  let mode = "full";
  let source = "manual";
  let triggeredBy: string | null = null;
  let deltaPayload: any = null;

  try {
    if (req.method === "POST") {
      const body = await req.json();
      mode = body.mode || "full";
      source = body.source || "manual";
      triggeredBy = body.triggered_by || null;
      deltaPayload = body.delta || null;
    }
  } catch {
    // GET request or empty body = full sync
  }

  // Auth check for manual triggers
  if (source === "manual") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[SM] Auth error:", userError?.message);
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    triggeredBy = userData.user.id;

    // Verify admin role
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", triggeredBy);

    const isAdmin = roles?.some((r: any) =>
      ["admin", "gerente", "financeiro"].includes(r.role)
    );

    if (!isAdmin) {
      return jsonRes({ error: "Apenas administradores podem sincronizar" }, 403);
    }
  }

  // Get config
  const { data: config, error: configErr } = await supabaseAdmin
    .from("solar_market_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (configErr || !config) {
    return jsonRes({ error: "Configuração SolarMarket não encontrada" }, 404);
  }

  if (!config.enabled) {
    return jsonRes({ error: "Integração SolarMarket desabilitada" }, 400);
  }

  // ── Test mode: just verify we can authenticate ──
  if (mode === "test") {
    try {
      const smToken = await getSmToken(supabaseAdmin, config as SmConfig);
      // Try a simple API call to verify connectivity
      const testData = await smFetch(config.base_url, "/clients?limit=1", smToken, 0);
      console.log("[SM] Test connection successful");
      return jsonRes({ status: "ok", message: "Conexão com SolarMarket bem-sucedida" });
    } catch (err: any) {
      console.error("[SM] Test connection failed:", err.message);
      return jsonRes({ error: err.message }, 400);
    }
  }

  // Create sync log
  const { data: syncLog } = await supabaseAdmin
    .from("solar_market_sync_logs")
    .insert({
      tenant_id: config.tenant_id,
      status: "running",
      triggered_by: triggeredBy,
      source,
      mode,
    })
    .select("id")
    .single();

  const counts: SyncCounts = {
    clients_synced: 0,
    projects_synced: 0,
    proposals_synced: 0,
    funnels_synced: 0,
    leads_linked: 0,
    errors: [],
  };

  try {
    const smToken = await getSmToken(supabaseAdmin, config as SmConfig);

    if (mode === "delta" && deltaPayload) {
      // Delta sync - process specific items
      console.log("[SM] Delta sync:", JSON.stringify(deltaPayload));

      if (deltaPayload.type === "client" && deltaPayload.sm_client_id) {
        const clientData = await smFetch(
          config.base_url,
          `/clients/${deltaPayload.sm_client_id}`,
          smToken
        ) as any;

        if (clientData) {
          const phone = clientData.phone || clientData.telefone || "";
          await supabaseAdmin
            .from("solar_market_clients")
            .upsert({
              tenant_id: config.tenant_id,
              sm_client_id: deltaPayload.sm_client_id,
              name: clientData.name || clientData.nome || "",
              email: clientData.email || "",
              phone,
              phone_normalized: normalizePhone(phone),
              payload: clientData,
            }, { onConflict: "tenant_id,sm_client_id" });
          counts.clients_synced++;
        }
      }

      if (deltaPayload.sm_client_id) {
        await syncProjectsForClient(
          supabaseAdmin, config as SmConfig, smToken, deltaPayload.sm_client_id, counts
        );
      }

      if (deltaPayload.type === "project" && deltaPayload.sm_project_id) {
        await syncProposalsForProject(
          supabaseAdmin, config as SmConfig, smToken,
          deltaPayload.sm_project_id, deltaPayload.sm_client_id || 0, counts
        );
        await syncFunnelsForProject(
          supabaseAdmin, config as SmConfig, smToken,
          deltaPayload.sm_project_id, counts
        );
      }
    } else {
      // Full sync
      console.log("[SM] Starting full sync...");
      const clients = await syncClients(supabaseAdmin, config as SmConfig, smToken, counts);

      for (const client of clients) {
        const smClientId = client.id || client.clientId;
        if (!smClientId) continue;

        await syncProjectsForClient(
          supabaseAdmin, config as SmConfig, smToken, smClientId, counts
        );

        // Small delay to avoid rate limits
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Always run lead linking
    await linkLeads(supabaseAdmin, config as SmConfig, counts);

    const finalStatus = counts.errors.length > 0 ? "partial" : "success";

    // Update sync log
    if (syncLog?.id) {
      await supabaseAdmin
        .from("solar_market_sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: finalStatus,
          counts,
          error: counts.errors.length > 0 ? counts.errors.join("; ") : null,
        })
        .eq("id", syncLog.id);
    }

    console.log(`[SM] Sync finished: ${finalStatus}`, counts);

    return jsonRes({
      status: finalStatus,
      counts,
      sync_log_id: syncLog?.id,
    });
  } catch (err: any) {
    console.error("[SM] Sync fatal error:", err.message);

    if (syncLog?.id) {
      await supabaseAdmin
        .from("solar_market_sync_logs")
        .update({
          finished_at: new Date().toISOString(),
          status: "fail",
          error: err.message,
          counts,
        })
        .eq("id", syncLog.id);
    }

    return jsonRes({ error: err.message, counts }, 500);
  }
});
