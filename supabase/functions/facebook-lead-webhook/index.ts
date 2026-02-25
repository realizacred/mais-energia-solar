import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ─────────────────────────────────────────────────

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
  const expected = "sha256=" + Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === signature;
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ── Resolve tenant from webhook endpoint registry ───────────
async function resolveTenantFromPageId(
  supabase: ReturnType<typeof createClient>,
  pageId: string
): Promise<string | null> {
  // First try: integration_configs with service_key = meta_facebook where metadata contains page_id
  // Since integration_configs doesn't have metadata, we look up integration_webhook_endpoints
  const { data } = await supabase
    .from("integration_webhook_endpoints")
    .select("tenant_id")
    .eq("provider", "meta_facebook")
    .eq("is_active", true)
    .limit(50);

  if (data && data.length === 1) return data[0].tenant_id;

  // If multiple tenants, try matching via integration_configs metadata
  // For now, look for a config with service_key containing the page_id
  if (data && data.length > 1) {
    // Multi-tenant disambiguation: check integrations table metadata
    for (const endpoint of data) {
      const { data: integration } = await supabase
        .from("integrations")
        .select("metadata")
        .eq("tenant_id", endpoint.tenant_id)
        .eq("provider", "meta_facebook")
        .maybeSingle();

      if (integration?.metadata && (integration.metadata as any).page_id === pageId) {
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

  const url = new URL(req.url);

  // ── GET: Hub challenge verification (Meta subscription verification) ──
  if (req.method === "GET") {
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    // Verify token should match the one configured per-tenant
    // For simplicity, we use a shared FACEBOOK_VERIFY_TOKEN or accept any valid format
    const expectedToken = Deno.env.get("FACEBOOK_VERIFY_TOKEN") || "mais_energia_fb_verify";

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
    const appSecret = Deno.env.get("FACEBOOK_APP_SECRET");
    if (!appSecret) {
      console.error("[FB-WEBHOOK][ERROR] FACEBOOK_APP_SECRET not configured");
      return new Response(JSON.stringify({ error: "Server misconfiguration" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();

    // ── Signature verification ──────────────────────────────
    const signature = req.headers.get("x-hub-signature-256");
    const isValid = await verifySignature(rawBody, signature, appSecret);
    if (!isValid) {
      console.error("[FB-WEBHOOK][SECURITY] Invalid signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: any;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error("[FB-WEBHOOK][ERROR] Invalid JSON body");
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabaseAdmin();
    let processedCount = 0;
    let errorCount = 0;

    // Meta sends { object: "page", entry: [...] }
    if (payload.object !== "page" || !Array.isArray(payload.entry)) {
      // Acknowledge but skip non-page events
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
          console.warn("[FB-WEBHOOK][WARN] Missing leadgen_id, skipping");
          errorCount++;
          continue;
        }

        // Resolve tenant
        const tenantId = await resolveTenantFromPageId(supabase, pageId);
        if (!tenantId) {
          console.error(`[FB-WEBHOOK][ERROR] No tenant found for page_id=${pageId}`);
          errorCount++;
          continue;
        }

        // Idempotent insert (ON CONFLICT DO NOTHING)
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
          console.error(`[FB-WEBHOOK][ERROR] Insert failed for lead ${fbLeadId}: ${insertError.message}`);
          errorCount++;
        } else {
          processedCount++;
          console.log(`[FB-WEBHOOK] Lead ${fbLeadId} stored for tenant ${tenantId.slice(0, 8)}...`);
        }
      }
    }

    return new Response(
      JSON.stringify({ received: true, processed: processedCount, errors: errorCount }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response("Method not allowed", { status: 405, headers: corsHeaders });
});
