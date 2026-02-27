import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Small delay helper to respect rate limits (60 req/min) */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Fetch all pages from a paginated SolarMarket endpoint with rate limiting */
async function fetchAllPages(url: string, headers: Record<string, string>): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const limit = 100; // SM API max is 100

  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const pageUrl = `${url}${sep}limit=${limit}&page=${page}`;
    console.log(`[SM Sync] Fetching: ${pageUrl} (accumulated: ${all.length})`);

    let res: Response;
    try {
      res = await fetch(pageUrl, { headers });
    } catch (fetchErr) {
      console.error(`[SM Sync] Network error on page ${page}:`, fetchErr);
      await delay(3000);
      res = await fetch(pageUrl, { headers });
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("retry-after") || "10", 10);
      console.log(`[SM Sync] Rate limited, waiting ${retryAfter}s...`);
      await delay(retryAfter * 1000);
      continue;
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SM API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const items = Array.isArray(json) ? json : json.data || [];
    all.push(...items);

    console.log(`[SM Sync] Page ${page}: got ${items.length} items, total: ${all.length}`);

    if (items.length < limit) break;
    page++;

    if (page > 100) {
      console.log(`[SM Sync] Hit max pages (100), stopping with ${all.length} items`);
      break;
    }

    // ~1.2s between pages (fits 60 req/min with margin)
    await delay(1200);
  }

  return all;
}

/** Extract equipment and financial data from SolarMarket proposal payload */
function extractProposalFields(pr: any) {
  const pricingTable = Array.isArray(pr.pricingTable) ? pr.pricingTable : [];
  const variables = Array.isArray(pr.variables) ? pr.variables : [];

  // Find variable by key
  const getVar = (key: string) => {
    const v = variables.find((v: any) => v.key === key);
    return v?.value ?? null;
  };

  // Extract from pricingTable by category
  const findPricing = (cat: string) => pricingTable.find((p: any) => p.category === cat);
  const moduloRow = findPricing("Módulo");
  const inversorRow = findPricing("Inversor");
  const kitRow = findPricing("KIT");
  const instRow = findPricing("Instalação");

  // Total value = sum of salesValue across all pricing items
  const valorTotal = pricingTable.reduce((sum: number, p: any) => sum + (Number(p.salesValue) || 0), 0);

  // Power from variables
  const potencia = Number(getVar("potencia_sistema")) || Number(getVar("vc_potencia_sistema")) || null;

  // Equipment cost = kit salesValue; Installation cost = instalação salesValue
  const equipmentCost = kitRow ? Number(kitRow.salesValue) || null : null;
  const installationCost = instRow ? Number(instRow.salesValue) || null : null;

  // Energy generation from variables
  const energyGen = Number(getVar("geracao_mensal")) || Number(getVar("geracao_media")) || null;

  return {
    titulo: pr.title || pr.titulo || pr.name || null,
    sm_project_id: pr.project?.id || pr.projectId || pr.project_id || null,
    sm_client_id: pr.clientId || pr.client_id || pr.project?.client?.id || null,
    description: pr.description || pr.descricao || null,
    potencia_kwp: potencia,
    valor_total: valorTotal > 0 ? valorTotal : (pr.totalValue || pr.valor_total || null),
    status: pr.status || null,
    modulos: moduloRow ? `${moduloRow.item} (${moduloRow.qnt}x)` : (pr.modules || pr.modulos || null),
    inversores: inversorRow ? `${inversorRow.item} (${inversorRow.qnt}x)` : (pr.inverters || pr.inversores || null),
    panel_model: moduloRow?.item || pr.panelModel || pr.panel_model || null,
    panel_quantity: moduloRow ? Number(moduloRow.qnt) || null : (pr.panelQuantity || null),
    inverter_model: inversorRow?.item || pr.inverterModel || pr.inverter_model || null,
    inverter_quantity: inversorRow ? Number(inversorRow.qnt) || null : (pr.inverterQuantity || null),
    discount: pr.discount || pr.desconto || null,
    installation_cost: installationCost,
    equipment_cost: equipmentCost,
    energy_generation: energyGen,
    roof_type: pr.roofType || pr.roof_type || getVar("tipo_telhado") || null,
    structure_type: pr.structureType || pr.structure_type || getVar("tipo_estrutura") || null,
    warranty: pr.warranty || pr.garantia || null,
    payment_conditions: pr.paymentConditions || pr.payment_conditions || null,
    valid_until: pr.validUntil || pr.valid_until || pr.expirationDate || null,
    sm_created_at: pr.createdAt || pr.created_at || pr.generatedAt || null,
    sm_updated_at: pr.updatedAt || pr.updated_at || null,
  };
}

/** Deduplicate rows by a key field (keep last occurrence) */
function deduplicateRows(rows: any[], keyField: string): any[] {
  const map = new Map<string | number, any>();
  for (const row of rows) {
    const key = row[keyField];
    if (key != null) map.set(key, row);
  }
  return Array.from(map.values());
}

/** Batch upsert helper — deduplicates then splits array into chunks */
async function batchUpsert(
  supabase: any,
  table: string,
  rows: any[],
  onConflict: string,
  batchSize = 50
): Promise<{ upserted: number; errors: string[] }> {
  // Deduplicate to avoid "ON CONFLICT DO UPDATE cannot affect row a second time"
  const conflictCols = onConflict.split(",").map(c => c.trim());
  const keyField = conflictCols.length > 1 ? conflictCols[1] : conflictCols[0];
  const uniqueRows = deduplicateRows(rows, keyField);
  if (uniqueRows.length < rows.length) {
    console.log(`[SM Sync] Deduplicated ${table}: ${rows.length} → ${uniqueRows.length} rows`);
  }

  let upserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < uniqueRows.length; i += batchSize) {
    const batch = uniqueRows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(batch, { onConflict });
    if (error) {
      console.error(`[SM Sync] Batch upsert error on ${table} (rows ${i}-${i + batch.length}):`, error.message);
      errors.push(`${table} batch ${i}: ${error.message}`);
      // Try one-by-one for this failed batch
      for (const row of batch) {
        const { error: singleErr } = await supabase.from(table).upsert(row, { onConflict });
        if (singleErr) {
          errors.push(`${table} row: ${singleErr.message}`);
        } else {
          upserted++;
        }
      }
    } else {
      upserted += batch.length;
    }
  }

  return { upserted, errors };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ─── Auth ──────────────────────────────────────────────
    const authHeader = req.headers.get("authorization");
    console.log("[SM Sync] Auth header present:", Boolean(authHeader));

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate user JWT directly against Supabase Auth API (more reliable in Edge runtime)
    let userId: string | null = null;
    try {
      const authRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: anonKey,
        },
      });

      const contentType = authRes.headers.get("content-type") || "";
      if (!authRes.ok) {
        const raw = await authRes.text();
        console.error(
          `[SM Sync] Auth validate failed: status=${authRes.status} body=${raw.slice(0, 300)}`
        );
      } else if (!contentType.includes("application/json")) {
        const raw = await authRes.text();
        console.error(`[SM Sync] Auth validate non-json response: ${raw.slice(0, 300)}`);
      } else {
        const authUser = await authRes.json();
        userId = authUser?.id ?? null;
      }
    } catch (authEx) {
      console.error("[SM Sync] Auth exception:", authEx);
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Tenant ────────────────────────────────────────────
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = profile.tenant_id;

    const { sync_type = "full" } = await req.json().catch(() => ({}));

    // ─── SolarMarket API Token ─────────────────────────────
    const { data: integrationConfig } = await supabase
      .from("integration_configs")
      .select("api_key, is_active")
      .eq("tenant_id", tenantId)
      .eq("service_key", "solarmarket")
      .maybeSingle();

    const { data: config } = await supabase
      .from("solar_market_config")
      .select("api_token, base_url, enabled")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const apiToken =
      (integrationConfig?.is_active ? integrationConfig.api_key : null) ||
      config?.api_token ||
      Deno.env.get("SOLARMARKET_TOKEN") ||
      null;
    const baseUrl = (config?.base_url || "https://business.solarmarket.com.br/api/v2").replace(/\/$/, "");

    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Token SolarMarket não configurado. Adicione na página de configuração." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SolarMarket API v2 — two-step auth: POST /auth/signin with token → get JWT
    console.log(`[SM Sync] Authenticating with /auth/signin (token len=${apiToken.length}, prefix=${apiToken.slice(0, 8)})`);

    const signinRes = await fetch(`${baseUrl}/auth/signin`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token: apiToken }),
    });

    if (!signinRes.ok) {
      const signinBody = await signinRes.text();
      console.error(`[SM Sync] /auth/signin failed: ${signinRes.status} ${signinBody.slice(0, 300)}`);
      return new Response(
        JSON.stringify({
          error: `Falha na autenticação SolarMarket (${signinRes.status}). Verifique se a API key em Integrações > SolarMarket está correta.`,
          details: signinBody.slice(0, 200),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const signinData = await signinRes.json();
    const accessToken = signinData.access_token || signinData.accessToken || signinData.token;

    if (!accessToken) {
      console.error("[SM Sync] /auth/signin response missing access_token:", JSON.stringify(signinData).slice(0, 300));
      return new Response(
        JSON.stringify({ error: "SolarMarket /auth/signin não retornou access_token." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[SM Sync] JWT obtained (len=${accessToken.length})`);

    const smHeaders: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    };

    // ─── Create sync log ───────────────────────────────────
    const { data: syncLog } = await supabase
      .from("solar_market_sync_logs")
      .insert({ tenant_id: tenantId, sync_type, status: "running" })
      .select("id")
      .single();

    const logId = syncLog?.id;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalErrors = 0;
    let hasSolarMarketAuthError = false;
    const errors: string[] = [];

    // ─── Sync Clients ──────────────────────────────────────
    if (sync_type === "full" || sync_type === "clients") {
      try {
        const clients = await fetchAllPages(`${baseUrl}/clients`, smHeaders);
        totalFetched += clients.length;

        // Filter: only clients with a name (all real clients have a name)
        const validClients = clients.filter((c: any) => {
          const name = c.name || c.nome || "";
          return typeof name === "string" && name.trim().length > 0;
        });
        const skipped = clients.length - validClients.length;
        console.log(`[SM Sync] Clients fetched: ${clients.length}, valid (with name): ${validClients.length}, skipped: ${skipped}`);

        const rows = validClients.map((c: any) => {
          const phone = c.primaryPhone || c.phone || c.telefone || "";
          const phoneNorm = phone.replace(/\D/g, "").slice(-11);
          return {
            tenant_id: tenantId,
            sm_client_id: c.id,
            name: (c.name || c.nome || "").trim(),
            email: c.email || null,
            phone: phone || null,
            phone_normalized: phoneNorm || null,
            document: c.cnpjCpf || c.document || c.cpf_cnpj || null,
            address: c.address || null,
            city: c.city || null,
            neighborhood: c.neighborhood || null,
            state: c.state || null,
            zip_code: c.zipCode || c.zip_code || null,
            number: c.number || null,
            complement: c.complement || null,
            company: c.company || null,
            secondary_phone: c.secondaryPhone || c.secondary_phone || null,
            representative: c.representative || null,
            responsible: c.responsible || null,
            sm_created_at: c.createdAt || c.created_at || null,
            raw_payload: c,
            synced_at: new Date().toISOString(),
          };
        });

        const result = await batchUpsert(supabase, "solar_market_clients", rows, "tenant_id,sm_client_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      } catch (e) {
        console.error("[SM Sync] Clients error:", e);
        const msg = (e as Error).message;
        if (msg.includes("SM API 401")) hasSolarMarketAuthError = true;
        totalErrors++;
        errors.push(`clients: ${msg}`);
      }
    }

    // ─── Sync Projects ─────────────────────────────────────
    const projectIds: number[] = [];
    if (sync_type === "full" || sync_type === "projects") {
      try {
        const projects = await fetchAllPages(`${baseUrl}/projects`, smHeaders);
        totalFetched += projects.length;
        console.log(`[SM Sync] Projects fetched: ${projects.length}`);

        const rows = projects.map((p: any) => {
          projectIds.push(p.id);
          return {
            tenant_id: tenantId,
            sm_project_id: p.id,
            sm_client_id: p.clientId || p.client_id || null,
            name: p.name || p.nome || null,
            description: p.description || p.descricao || null,
            potencia_kwp: p.potencia_kwp || p.power || null,
            status: p.status || null,
            valor: p.value || p.valor || null,
            address: p.address || null,
            city: p.city || null,
            neighborhood: p.neighborhood || null,
            state: p.state || null,
            zip_code: p.zipCode || p.zip_code || null,
            number: p.number || null,
            complement: p.complement || null,
            installation_type: p.installationType || p.installation_type || null,
            phase_type: p.phaseType || p.phase_type || null,
            voltage: p.voltage || null,
            energy_consumption: p.energyConsumption || p.energy_consumption || null,
            representative: p.representative || null,
            responsible: p.responsible || null,
            sm_created_at: p.createdAt || p.created_at || null,
            sm_updated_at: p.updatedAt || p.updated_at || null,
            raw_payload: p,
            synced_at: new Date().toISOString(),
          };
        });

        const result = await batchUpsert(supabase, "solar_market_projects", rows, "tenant_id,sm_project_id");
        totalUpserted += result.upserted;
        totalErrors += result.errors.length;
        errors.push(...result.errors);
      } catch (e) {
        console.error("[SM Sync] Projects error:", e);
        const msg = (e as Error).message;
        if (msg.includes("SM API 401")) hasSolarMarketAuthError = true;
        totalErrors++;
        errors.push(`projects: ${msg}`);
      }
    }

    // ─── Sync Proposals ───────────────────────────────────
    if (sync_type === "full" || sync_type === "proposals") {
      try {
        // Try bulk endpoint first: GET /proposals
        console.log(`[SM Sync] Trying bulk /proposals endpoint...`);
        const proposals = await fetchAllPages(`${baseUrl}/proposals`, smHeaders);
        totalFetched += proposals.length;
        console.log(`[SM Sync] Proposals fetched (bulk): ${proposals.length}`);

        if (proposals.length > 0) {
          const rows = proposals.map((pr: any) => ({
            tenant_id: tenantId,
            sm_proposal_id: pr.id,
            ...extractProposalFields(pr),
            raw_payload: pr,
            synced_at: new Date().toISOString(),
          }));

          const result = await batchUpsert(supabase, "solar_market_proposals", rows, "tenant_id,sm_proposal_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }
      } catch (bulkErr) {
        console.warn(`[SM Sync] Bulk /proposals failed: ${(bulkErr as Error).message}, trying per-project fallback (limited)...`);

        // Fallback: fetch per-project but limit to avoid timeout
        // Limit to 50 most recent projects to avoid compute resource exhaustion
        let ids = projectIds;
        if (ids.length === 0) {
          const { data: dbProjects } = await supabase
            .from("solar_market_projects")
            .select("sm_project_id")
            .eq("tenant_id", tenantId)
            .order("synced_at", { ascending: false })
            .limit(50);
          ids = (dbProjects || []).map((p: any) => p.sm_project_id);
        } else {
          ids = ids.slice(0, 50);
        }

        console.log(`[SM Sync] Fetching proposals for ${ids.length} projects (fallback, limited)`);
        const allProposalRows: any[] = [];

        for (const projId of ids) {
          try {
            const url = `${baseUrl}/projects/${projId}/proposals`;
            const res = await fetch(url, { headers: smHeaders });
            if (!res.ok) {
              if (res.status === 404) { await res.text(); continue; }
              if (res.status === 429) {
                const ra = parseInt(res.headers.get("retry-after") || "10", 10);
                await delay(ra * 1000);
                continue;
              }
              await res.text();
              continue;
            }
            const propData = await res.json();
            const proposals = Array.isArray(propData) ? propData : propData.data ? [propData.data] : propData ? [propData] : [];
            totalFetched += proposals.length;

            for (const pr of proposals) {
              const extracted = extractProposalFields(pr);
              allProposalRows.push({
                tenant_id: tenantId,
                sm_proposal_id: pr.id,
                ...extracted,
                // Override sm_project_id with the known project ID from the URL
                sm_project_id: projId,
                raw_payload: pr,
                synced_at: new Date().toISOString(),
              });
            }
            await delay(400);
          } catch (e) {
            totalErrors++;
            errors.push(`proposals proj ${projId}: ${(e as Error).message}`);
          }
        }

        if (allProposalRows.length > 0) {
          const result = await batchUpsert(supabase, "solar_market_proposals", allProposalRows, "tenant_id,sm_proposal_id");
          totalUpserted += result.upserted;
          totalErrors += result.errors.length;
          errors.push(...result.errors);
        }
      }
    }

    // ─── Finalize ──────────────────────────────────────────
    if (hasSolarMarketAuthError && totalUpserted === 0) {
      if (logId) {
        await supabase
          .from("solar_market_sync_logs")
          .update({
            status: "failed",
            total_fetched: totalFetched,
            total_upserted: totalUpserted,
            total_errors: totalErrors,
            finished_at: new Date().toISOString(),
          })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({
          error: "SolarMarket retornou 401 Unauthorized. Verifique se a API key em Integrações > SolarMarket está correta e ativa.",
          total_errors: totalErrors,
          error_details: errors.slice(0, 10),
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const finalStatus = totalErrors > 0 ? "completed_with_errors" : "completed";

    if (logId) {
      await supabase
        .from("solar_market_sync_logs")
        .update({
          status: finalStatus,
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          total_errors: totalErrors,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    await supabase
      .from("solar_market_config")
      .upsert(
        { tenant_id: tenantId, last_sync_at: new Date().toISOString(), enabled: true },
        { onConflict: "tenant_id" }
      );

    console.log(`[SM Sync] Done: fetched=${totalFetched} upserted=${totalUpserted} errors=${totalErrors}`);

    return new Response(
      JSON.stringify({
        success: true,
        sync_type,
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        total_errors: totalErrors,
        error_details: errors.length > 0 ? errors.slice(0, 10) : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SM Sync] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
