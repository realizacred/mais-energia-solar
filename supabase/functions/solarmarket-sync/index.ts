import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Fetch all pages from a paginated SolarMarket endpoint */
async function fetchAllPages(url: string, headers: Record<string, string>): Promise<any[]> {
  const all: any[] = [];
  let page = 1;
  const limit = 100;

  while (true) {
    const sep = url.includes("?") ? "&" : "?";
    const pageUrl = `${url}${sep}limit=${limit}&page=${page}`;
    console.log(`[SM Sync] Fetching: ${pageUrl}`);

    const res = await fetch(pageUrl, { headers });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`SM API ${res.status}: ${body.slice(0, 300)}`);
    }

    const json = await res.json();
    const items = Array.isArray(json) ? json : json.data || [];
    all.push(...items);

    if (items.length < limit) break; // last page
    page++;

    // Safety: max 50 pages (5000 records)
    if (page > 50) break;
  }

  return all;
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

    const token = authHeader.replace("Bearer ", "").trim();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate user JWT
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    const userId = userData?.user?.id;

    if (userError || !userId) {
      console.error("[SM Sync] Auth failed:", userError?.message);
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
    const { data: config } = await supabase
      .from("solar_market_config")
      .select("api_token, base_url, enabled")
      .eq("tenant_id", tenantId)
      .single();

    const apiToken = config?.api_token || Deno.env.get("SOLARMARKET_TOKEN") || null;
    const baseUrl = (config?.base_url || "https://business.solarmarket.com.br/api/v2").replace(/\/$/, "");

    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Token SolarMarket não configurado. Adicione na página de configuração." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SolarMarket API uses the token directly (no Bearer prefix per docs)
    const smHeaders: Record<string, string> = {
      Accept: "application/json",
      Authorization: `Bearer ${apiToken}`,
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
    const errors: string[] = [];

    // ─── Sync Clients ──────────────────────────────────────
    if (sync_type === "full" || sync_type === "clients") {
      try {
        const clients = await fetchAllPages(`${baseUrl}/clients`, smHeaders);
        totalFetched += clients.length;
        console.log(`[SM Sync] Clients fetched: ${clients.length}`);

        for (const c of clients) {
          try {
            const phone = c.primaryPhone || c.phone || c.telefone || "";
            const phoneNorm = phone.replace(/\D/g, "").slice(-11);
            await supabase.from("solar_market_clients").upsert(
              {
                tenant_id: tenantId,
                sm_client_id: c.id,
                name: c.name || c.nome || null,
                email: c.email || null,
                phone: phone || null,
                phone_normalized: phoneNorm || null,
                document: c.cnpjCpf || c.document || c.cpf_cnpj || null,
                address: c.address || null,
                raw_payload: c,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,sm_client_id" }
            );
            totalUpserted++;
          } catch (e) {
            totalErrors++;
            errors.push(`client ${c.id}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        console.error("[SM Sync] Clients error:", e);
        totalErrors++;
        errors.push(`clients: ${(e as Error).message}`);
      }
    }

    // ─── Sync Projects ─────────────────────────────────────
    const projectIds: number[] = [];
    if (sync_type === "full" || sync_type === "projects") {
      try {
        const projects = await fetchAllPages(`${baseUrl}/projects`, smHeaders);
        totalFetched += projects.length;
        console.log(`[SM Sync] Projects fetched: ${projects.length}`);

        for (const p of projects) {
          try {
            projectIds.push(p.id);
            await supabase.from("solar_market_projects").upsert(
              {
                tenant_id: tenantId,
                sm_project_id: p.id,
                sm_client_id: p.clientId || p.client_id || null,
                name: p.name || p.nome || null,
                potencia_kwp: p.potencia_kwp || p.power || null,
                status: p.status || null,
                valor: p.value || p.valor || null,
                raw_payload: p,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,sm_project_id" }
            );
            totalUpserted++;
          } catch (e) {
            totalErrors++;
            errors.push(`project ${p.id}: ${(e as Error).message}`);
          }
        }
      } catch (e) {
        console.error("[SM Sync] Projects error:", e);
        totalErrors++;
        errors.push(`projects: ${(e as Error).message}`);
      }
    }

    // ─── Sync Proposals (per project: GET /projects/{id}/proposals) ──
    if (sync_type === "full" || sync_type === "proposals") {
      // If we didn't fetch projects above, get project IDs from DB
      let ids = projectIds;
      if (ids.length === 0) {
        const { data: dbProjects } = await supabase
          .from("solar_market_projects")
          .select("sm_project_id")
          .eq("tenant_id", tenantId);
        ids = (dbProjects || []).map((p: any) => p.sm_project_id);
      }

      console.log(`[SM Sync] Fetching proposals for ${ids.length} projects`);

      for (const projId of ids) {
        try {
          const url = `${baseUrl}/projects/${projId}/proposals`;
          const res = await fetch(url, { headers: smHeaders });
          if (!res.ok) {
            // Some projects may have no proposals — skip 404s
            if (res.status === 404) continue;
            const body = await res.text();
            throw new Error(`SM proposals ${res.status}: ${body.slice(0, 200)}`);
          }
          const propData = await res.json();
          const proposals = Array.isArray(propData) ? propData : propData.data ? [propData.data] : propData ? [propData] : [];
          totalFetched += proposals.length;

          for (const pr of proposals) {
            try {
              await supabase.from("solar_market_proposals").upsert(
                {
                  tenant_id: tenantId,
                  sm_proposal_id: pr.id,
                  sm_project_id: projId,
                  sm_client_id: pr.clientId || pr.client_id || null,
                  titulo: pr.title || pr.titulo || pr.name || null,
                  potencia_kwp: pr.potencia_kwp || pr.power || null,
                  valor_total: pr.totalValue || pr.total_value || pr.valor_total || null,
                  status: pr.status || null,
                  modulos: pr.modules || pr.modulos || null,
                  inversores: pr.inverters || pr.inversores || null,
                  raw_payload: pr,
                  synced_at: new Date().toISOString(),
                },
                { onConflict: "tenant_id,sm_proposal_id" }
              );
              totalUpserted++;
            } catch (e) {
              totalErrors++;
              errors.push(`proposal ${pr.id}: ${(e as Error).message}`);
            }
          }

          // Small delay to respect rate limits
          await new Promise((r) => setTimeout(r, 100));
        } catch (e) {
          console.error(`[SM Sync] Proposals for project ${projId} error:`, e);
          totalErrors++;
          errors.push(`proposals proj ${projId}: ${(e as Error).message}`);
        }
      }
    }

    // ─── Finalize ──────────────────────────────────────────
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
