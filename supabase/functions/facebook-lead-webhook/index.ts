import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ─────────────────────────────────────────────────

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

async function verifySignature(
  body: string,
  signature: string | null,
  appSecret: string
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const expected =
    "sha256=" +
    Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  return expected === signature;
}

// ── Read Meta config from integration_configs (DB, not env) ──
async function getMetaConfig(
  supabase: ReturnType<typeof createClient>
): Promise<{ appSecret: string | null; verifyToken: string | null }> {
  const { data } = await supabase
    .from("integration_configs")
    .select("service_key, api_key")
    .in("service_key", ["meta_facebook_app_secret", "meta_facebook_verify_token"])
    .eq("is_active", true);

  let appSecret: string | null = null;
  let verifyToken: string | null = null;

  for (const row of data ?? []) {
    if (row.service_key === "meta_facebook_app_secret") appSecret = row.api_key;
    if (row.service_key === "meta_facebook_verify_token") verifyToken = row.api_key;
  }
  return { appSecret, verifyToken };
}

// ── Resolve tenant from webhook endpoint registry ───────────
async function resolveTenantFromPageId(
  supabase: ReturnType<typeof createClient>,
  pageId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("integration_webhook_endpoints")
    .select("tenant_id")
    .eq("provider", "meta_facebook")
    .eq("is_active", true)
    .limit(50);

  if (data && data.length === 1) return data[0].tenant_id;

  if (data && data.length > 1) {
    for (const endpoint of data) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("metadata")
        .eq("tenant_id", endpoint.tenant_id)
        .eq("provider", "meta_facebook")
        .maybeSingle();

      if (
        integration?.metadata &&
        (integration.metadata as any).page_id === pageId
      ) {
        return endpoint.tenant_id;
      }
    }
  }

  // Fallback: single active meta_facebook integration_config
  const { data: configs } = await supabase
    .from("integration_configs")
    .select("tenant_id")
    .eq("service_key", "meta_facebook")
    .eq("is_active", true)
    .limit(1);

  return configs?.[0]?.tenant_id || null;
}

// ── Main handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  const url = new URL(req.url);

  // ── GET: Hub challenge verification ───────────────────────
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    const { verifyToken } = await getMetaConfig(supabase);
    const expectedToken = verifyToken || "mais_energia_fb_verify";

    if (mode === "subscribe" && token === expectedToken) {
      console.log("[FB-WEBHOOK] Hub challenge verified");
      return new Response(challenge, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }

    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ── POST: Lead data from Meta ─────────────────────────────
  if (req.method === "POST") {
    const { appSecret } = await getMetaConfig(supabase);
    if (!appSecret) {
      console.error("[FB-WEBHOOK][ERROR] App Secret não configurado no sistema");
      return new Response(
        JSON.stringify({ error: "App Secret não configurado" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rawBody = await req.text();

    // ── Signature verification ──────────────────────────────
    const signature = req.headers.get("x-hub-signature-256");
    const isValid = await verifySignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.error("[FB-WEBHOOK][SECURITY] Invalid signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let processedCount = 0;
    let errorCount = 0;

    if (payload.object !== "page" || !Array.isArray(payload.entry)) {
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const entry of payload.entry) {
      const pageId = entry.id?.toString();
      const changes = entry.changes || [];

      for (const change of changes) {
        if (change.field !== "leadgen") continue;

        const leadgenValue = change.value;
        const fbLeadId = leadgenValue?.leadgen_id?.toString();
        const formId = leadgenValue?.form_id?.toString();
        const adId = leadgenValue?.ad_id?.toString();

        if (!fbLeadId) {
          console.warn("[FB-WEBHOOK][WARN] Missing leadgen_id");
          errorCount++;
          continue;
        }

        const tenantId = await resolveTenantFromPageId(supabase, pageId);
        if (!tenantId) {
          console.error(`[FB-WEBHOOK][ERROR] No tenant for page_id=${pageId}`);
          errorCount++;
          continue;
        }

        const { error: insertError } = await supabase
          .from("facebook_leads")
          .upsert(
            {
              tenant_id: tenantId,
              facebook_lead_id: fbLeadId,
              form_id: formId || null,
              page_id: pageId || null,
              ad_id: adId || null,
              raw_json: leadgenValue,
              processing_status: "received",
              received_at: new Date().toISOString(),
            },
            { onConflict: "facebook_lead_id", ignoreDuplicates: true }
          );

        if (insertError) {
          console.error(`[FB-WEBHOOK][ERROR] Insert failed: ${insertError.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`[FB-WEBHOOK] Lead ${fbLeadId} stored`);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: processedCount, errors: errorCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
