import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    console.log("[SM Sync] Request auth header present:", Boolean(authHeader));

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

    // Validate JWT claims explicitly (verify_jwt = false in config)
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const userId = claimsData?.claims?.sub;

    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: "Invalid token claims" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id, role")
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

    // Get API token — first check tenant config, then fallback to secret
    let apiToken: string | null = null;

    const { data: config } = await supabase
      .from("solar_market_config")
      .select("api_token, base_url, enabled")
      .eq("tenant_id", tenantId)
      .single();

    apiToken = config?.api_token || Deno.env.get("SOLARMARKET_TOKEN") || null;
    const baseUrl = config?.base_url || "https://business.solarmarket.com.br/api/v2";

    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Token SolarMarket não configurado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync log
    const { data: syncLog } = await supabase
      .from("solar_market_sync_logs")
      .insert({ tenant_id: tenantId, sync_type, status: "running" })
      .select("id")
      .single();

    const logId = syncLog?.id;
    let totalFetched = 0;
    let totalUpserted = 0;
    let totalErrors = 0;

    const smHeaders = {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    };

    // ─── Sync Clients ───────────────────────────────────────
    if (sync_type === "full" || sync_type === "clients") {
      try {
        const res = await fetch(`${baseUrl}/clients`, { headers: smHeaders });
        if (!res.ok) throw new Error(`SM API clients: ${res.status} ${res.statusText}`);
        const clientsData = await res.json();
        const clients = Array.isArray(clientsData) ? clientsData : clientsData.data || [];
        totalFetched += clients.length;

        for (const c of clients) {
          try {
            const phone = c.phone || c.telefone || "";
            const phoneNorm = phone.replace(/\D/g, "").slice(-11);
            await supabase.from("solar_market_clients").upsert(
              {
                tenant_id: tenantId,
                sm_client_id: c.id,
                name: c.name || c.nome || null,
                email: c.email || null,
                phone: phone || null,
                phone_normalized: phoneNorm || null,
                document: c.document || c.cpf_cnpj || null,
                address: c.address || null,
                raw_payload: c,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,sm_client_id" }
            );
            totalUpserted++;
          } catch {
            totalErrors++;
          }
        }
      } catch (e) {
        console.error("[SM Sync] Clients error:", e);
        totalErrors++;
      }
    }

    // ─── Sync Projects ──────────────────────────────────────
    if (sync_type === "full" || sync_type === "projects") {
      try {
        const res = await fetch(`${baseUrl}/projects`, { headers: smHeaders });
        if (!res.ok) throw new Error(`SM API projects: ${res.status} ${res.statusText}`);
        const projData = await res.json();
        const projects = Array.isArray(projData) ? projData : projData.data || [];
        totalFetched += projects.length;

        for (const p of projects) {
          try {
            await supabase.from("solar_market_projects").upsert(
              {
                tenant_id: tenantId,
                sm_project_id: p.id,
                sm_client_id: p.client_id || p.cliente_id || null,
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
          } catch {
            totalErrors++;
          }
        }
      } catch (e) {
        console.error("[SM Sync] Projects error:", e);
        totalErrors++;
      }
    }

    // ─── Sync Proposals ─────────────────────────────────────
    if (sync_type === "full" || sync_type === "proposals") {
      try {
        const res = await fetch(`${baseUrl}/proposals`, { headers: smHeaders });
        if (!res.ok) throw new Error(`SM API proposals: ${res.status} ${res.statusText}`);
        const propData = await res.json();
        const proposals = Array.isArray(propData) ? propData : propData.data || [];
        totalFetched += proposals.length;

        for (const pr of proposals) {
          try {
            await supabase.from("solar_market_proposals").upsert(
              {
                tenant_id: tenantId,
                sm_proposal_id: pr.id,
                sm_project_id: pr.project_id || pr.projeto_id || null,
                sm_client_id: pr.client_id || pr.cliente_id || null,
                titulo: pr.title || pr.titulo || null,
                potencia_kwp: pr.potencia_kwp || pr.power || null,
                valor_total: pr.total_value || pr.valor_total || null,
                status: pr.status || null,
                modulos: pr.modules || pr.modulos || null,
                inversores: pr.inverters || pr.inversores || null,
                raw_payload: pr,
                synced_at: new Date().toISOString(),
              },
              { onConflict: "tenant_id,sm_proposal_id" }
            );
            totalUpserted++;
          } catch {
            totalErrors++;
          }
        }
      } catch (e) {
        console.error("[SM Sync] Proposals error:", e);
        totalErrors++;
      }
    }

    // Update sync log
    if (logId) {
      await supabase
        .from("solar_market_sync_logs")
        .update({
          status: totalErrors > 0 ? "completed_with_errors" : "completed",
          total_fetched: totalFetched,
          total_upserted: totalUpserted,
          total_errors: totalErrors,
          finished_at: new Date().toISOString(),
        })
        .eq("id", logId);
    }

    // Update last_sync_at on config
    await supabase
      .from("solar_market_config")
      .upsert(
        { tenant_id: tenantId, last_sync_at: new Date().toISOString(), enabled: true },
        { onConflict: "tenant_id" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        sync_type,
        total_fetched: totalFetched,
        total_upserted: totalUpserted,
        total_errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[SM Sync] Fatal error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
