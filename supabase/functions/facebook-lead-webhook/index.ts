import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sanitizeError } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ─────────────────────────────────────────────────

function getSupabaseAdmin(): any {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  ) as any;
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
  supabase: any
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
  supabase: any,
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

// ── Persist validation failures for audit ───────────────────
async function persistValidationFailure(
  supabase: any,
  reason: string,
  context: Record<string, unknown>,
) {
  try {
    await supabase.from("audit_logs").insert({
      tabela: "facebook_leads",
      acao: "webhook_validation_failure",
      dados_novos: { reason, ...context, timestamp: new Date().toISOString() },
    });
  } catch (e) {
    console.warn(`[FB-WEBHOOK] Failed to persist validation failure: ${sanitizeError(e)}`);
  }
}

// ── Create CRM lead from facebook_leads ─────────────────────
interface CrmLeadInput {
  tenantId: string;
  fbLeadId: string;
  formId: string | null;
  pageId: string | null;
  adId: string | null;
  leadgenValue: Record<string, unknown>;
}

async function createCrmLead(
  supabase: any,
  input: CrmLeadInput,
) {
  const { tenantId, fbLeadId, formId, pageId, adId, leadgenValue } = input;

  // 1. Fetch automation config for this tenant
  const { data: automation } = await supabase
    .from("facebook_lead_automations")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (!automation) {
    console.warn(`[FB-WEBHOOK][CRM] No active automation for tenant ${tenantId} — skipping CRM creation`);
    await supabase.from("facebook_leads")
      .update({ processing_status: "no_automation" })
      .eq("facebook_lead_id", fbLeadId);
    return;
  }

  // 2. Check for duplicate
  const { data: existing } = await supabase
    .from("leads")
    .select("id")
    .eq("facebook_lead_id", fbLeadId)
    .maybeSingle();

  if (existing) {
    console.warn(`[FB-WEBHOOK][CRM] Lead already exists for fb_lead ${fbLeadId}`);
    await supabase.from("facebook_leads")
      .update({ processing_status: "duplicate", processed_at: new Date().toISOString(), lead_id: existing.id })
      .eq("facebook_lead_id", fbLeadId);
    return;
  }

  // 3. Determine responsible user (round-robin or fixed)
  let responsibleUserId = automation.responsible_user_id;
  if (automation.round_robin && Array.isArray(automation.round_robin_users) && automation.round_robin_users.length > 0) {
    const idx = automation.round_robin_index ?? 0;
    responsibleUserId = automation.round_robin_users[idx];
    const nextIdx = (idx + 1) % automation.round_robin_users.length;
    await supabase.from("facebook_lead_automations")
      .update({ round_robin_index: nextIdx, updated_at: new Date().toISOString() })
      .eq("id", automation.id);
  }

  // 4. Extract lead data from raw webhook payload
  // Facebook sends field_data as array of { name, values }
  const fieldData: Array<{ name: string; values: string[] }> = (leadgenValue as any)?.field_data || [];
  const fieldMap: Record<string, string> = {};
  for (const f of fieldData) {
    if (f.name && f.values?.[0]) {
      fieldMap[f.name] = f.values[0];
    }
  }

  // Also check facebook_leads record for pre-extracted fields
  const { data: fbRecord } = await supabase
    .from("facebook_leads")
    .select("lead_name, lead_email, lead_phone, campaign_id, adset_id, raw_json")
    .eq("facebook_lead_id", fbLeadId)
    .maybeSingle();

  const mapping = (automation.field_mapping as Record<string, string>) || {};
  const nome = fieldMap[mapping.nome || "full_name"] || fbRecord?.lead_name || fieldMap["full_name"] || "Lead Facebook";
  const email = fieldMap[mapping.email || "email"] || fbRecord?.lead_email || fieldMap["email"] || null;
  const telefone = fieldMap[mapping.telefone || "phone_number"] || fbRecord?.lead_phone || fieldMap["phone_number"] || null;
  const cidade = fieldMap[mapping.cidade || "city"] || fieldMap["city"] || null;
  const estado = fieldMap[mapping.estado || "state"] || fieldMap["state"] || null;

  const campaignId = fbRecord?.campaign_id || (leadgenValue as any)?.campaign_id || null;
  const adsetId = fbRecord?.adset_id || (leadgenValue as any)?.adset_id || null;

  // 5. Insert lead into CRM
  const insertPayload: Record<string, unknown> = {
    tenant_id: tenantId,
    nome,
    telefone: telefone || "",
    email: email || null,
    cidade: cidade || null,
    estado: estado || null,
    origem: "Facebook Ads",
    utm_source: "facebook",
    utm_medium: "paid",
    facebook_lead_id: fbLeadId,
    campaign_id: campaignId,
    ad_id: adId,
    form_id: formId,
    page_id: pageId,
    adset_id: adsetId,
  };

  // Only set consultor_id if we resolved a responsible user
  if (responsibleUserId) {
    insertPayload.consultor_id = responsibleUserId;
  }

  // Set pipeline stage via status_id if configured
  if (automation.stage_id) {
    insertPayload.status_id = automation.stage_id;
  }

  const { data: newLead, error: leadError } = await supabase
    .from("leads")
    .insert(insertPayload)
    .select("id")
    .single();

  if (leadError) {
    console.error(`[FB-WEBHOOK][CRM] Error creating lead: ${leadError.message}`);
    await supabase.from("facebook_leads")
      .update({ processing_status: "crm_error", error_message: leadError.message })
      .eq("facebook_lead_id", fbLeadId);
    return;
  }

  // 6. Update facebook_leads with CRM lead ID
  await supabase.from("facebook_leads")
    .update({
      processing_status: "converted",
      processed_at: new Date().toISOString(),
      lead_id: newLead.id,
    })
    .eq("facebook_lead_id", fbLeadId);

  console.warn(`[FB-WEBHOOK][CRM] Lead created in CRM: ${newLead.id} for fb_lead ${fbLeadId}`);
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
      console.warn("[FB-WEBHOOK] Hub challenge verified");
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
          // Persist validation failure for audit
          await persistValidationFailure(supabase, "missing_leadgen_id", { pageId, change: change.value });
          errorCount++;
          continue;
        }

        const tenantId = await resolveTenantFromPageId(supabase, pageId);
        if (!tenantId) {
          console.error(`[FB-WEBHOOK][ERROR] No tenant for page_id=${pageId}`);
          await persistValidationFailure(supabase, "no_tenant_for_page", { pageId, fbLeadId });
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
          await persistValidationFailure(supabase, "insert_failed", {
            fbLeadId, tenantId, error: insertError.message,
          });
          errorCount++;
        } else {
          processedCount++;
          console.warn(`[FB-WEBHOOK] Lead ${fbLeadId} stored`);

          // ── Create CRM lead automatically ─────────────────
          try {
            await createCrmLead(supabase, {
              tenantId,
              fbLeadId,
              formId: formId || null,
              pageId: pageId || null,
              adId: adId || null,
              leadgenValue,
            });
          } catch (crmErr) {
            console.error(`[FB-WEBHOOK][CRM] Error creating CRM lead: ${sanitizeError(crmErr)}`);
          }
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
