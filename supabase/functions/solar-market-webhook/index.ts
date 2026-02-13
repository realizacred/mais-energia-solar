import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ══════════════════════════════════════════════════════════════
// Event type → delta sync mapping (expanded for all SM events)
// ══════════════════════════════════════════════════════════════

interface DeltaPayload {
  type: string;
  sm_client_id?: number;
  sm_project_id?: number;
  sm_proposal_id?: number;
}

function extractDeltaPayload(body: any): DeltaPayload | null {
  const eventType = (body.event || body.type || body.eventType || "").toLowerCase();
  const clientId = body.clientId || body.client_id || body.data?.clientId || body.data?.client?.id;
  const projectId = body.projectId || body.project_id || body.data?.projectId || body.data?.project?.id;
  const proposalId = body.proposalId || body.proposal_id || body.data?.proposalId || body.data?.proposal?.id;

  // ── Client events ──
  // criado, atualizado, reincluído, excluído
  if (eventType.includes("client") || eventType.includes("cliente")) {
    if (eventType.includes("delet") || eventType.includes("exclu")) {
      return clientId ? { type: "client_deleted", sm_client_id: Number(clientId) } : null;
    }
    // criado, atualizado, reincluído → full client sync
    return clientId ? { type: "client", sm_client_id: Number(clientId) } : null;
  }

  // ── Project events ──
  // criado, excluído, ganho, perdido, movido etapa, removido funil, reaberto, reincluído
  if (eventType.includes("project") || eventType.includes("projeto")) {
    if (eventType.includes("delet") || eventType.includes("exclu")) {
      return projectId ? { type: "project_deleted", sm_project_id: Number(projectId) } : null;
    }
    // ganho, perdido, movido, removido funil, reaberto, reincluído, criado → full project sync
    return projectId
      ? { type: "project", sm_project_id: Number(projectId), sm_client_id: clientId ? Number(clientId) : undefined }
      : null;
  }

  // ── Proposal events ──
  // gerada, aceita, rejeitada, reaberta, excluída
  if (eventType.includes("propos") || eventType.includes("proposta")) {
    if (eventType.includes("delet") || eventType.includes("exclu")) {
      // Proposal deleted → resync active proposal for project
      return projectId
        ? { type: "proposal", sm_project_id: Number(projectId), sm_proposal_id: proposalId ? Number(proposalId) : undefined }
        : null;
    }
    // gerada, aceita, rejeitada, reaberta → sync proposal
    return projectId || proposalId
      ? { type: "proposal", sm_project_id: projectId ? Number(projectId) : undefined, sm_proposal_id: proposalId ? Number(proposalId) : undefined }
      : null;
  }

  // ── Custom field events ──
  // atualizado
  if (eventType.includes("custom") || eventType.includes("campo")) {
    return projectId
      ? { type: "project", sm_project_id: Number(projectId) }
      : null;
  }

  // ── Funnel/stage events ──
  // movido etapa, removido funil
  if (eventType.includes("funnel") || eventType.includes("funil") || eventType.includes("stage") || eventType.includes("etapa")) {
    return projectId
      ? { type: "project", sm_project_id: Number(projectId) }
      : null;
  }

  // ── Activity events ──
  // criada, excluída, concluída, reaberta
  // Activities are logged but mapped to project sync if project context exists
  if (eventType.includes("activit") || eventType.includes("atividade") || eventType.includes("task") || eventType.includes("tarefa")) {
    if (projectId) {
      return { type: "project", sm_project_id: Number(projectId), sm_client_id: clientId ? Number(clientId) : undefined };
    }
    if (clientId) {
      return { type: "client", sm_client_id: Number(clientId) };
    }
    // Activity without context — just log, no delta
    return null;
  }

  // ── Won/Lost events (may come as standalone) ──
  if (eventType.includes("won") || eventType.includes("ganh") || eventType.includes("lost") || eventType.includes("perd")) {
    if (projectId) {
      return { type: "project", sm_project_id: Number(projectId), sm_client_id: clientId ? Number(clientId) : undefined };
    }
    return null;
  }

  // ── Reopen events ──
  if (eventType.includes("reopen") || eventType.includes("reabert") || eventType.includes("reinclu")) {
    if (projectId) return { type: "project", sm_project_id: Number(projectId) };
    if (clientId) return { type: "client", sm_client_id: Number(clientId) };
    return null;
  }

  // ── Fallback: infer from IDs present ──
  if (clientId) return { type: "client", sm_client_id: Number(clientId) };
  if (projectId) return { type: "project", sm_project_id: Number(projectId) };
  if (proposalId) return { type: "proposal", sm_proposal_id: Number(proposalId) };

  return null;
}

function extractEntityInfo(body: any, delta: DeltaPayload | null): { entity_type: string | null; entity_id: number | null } {
  if (!delta) {
    // Try to extract from raw body for logging purposes
    const eventType = (body.event || body.type || body.eventType || "").toLowerCase();
    if (eventType.includes("activit") || eventType.includes("atividade")) {
      const actId = body.activityId || body.activity_id || body.data?.activityId || body.data?.activity?.id;
      return { entity_type: "activity", entity_id: actId ? Number(actId) : null };
    }
    return { entity_type: null, entity_id: null };
  }

  if (delta.sm_client_id) return { entity_type: "client", entity_id: delta.sm_client_id };
  if (delta.sm_project_id) return { entity_type: "project", entity_id: delta.sm_project_id };
  if (delta.sm_proposal_id) return { entity_type: "proposal", entity_id: delta.sm_proposal_id };

  return { entity_type: null, entity_id: null };
}

// ══════════════════════════════════════════════════════════════
// Background processor
// ══════════════════════════════════════════════════════════════

async function processWebhookEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  eventId: string,
  delta: DeltaPayload
) {
  try {
    await supabaseAdmin.from("solar_market_webhook_events")
      .update({ status: "processing" })
      .eq("id", eventId);

    console.log(`[SM Webhook] Processing event ${eventId}: ${JSON.stringify(delta)}`);

    const { error: syncError } = await supabaseAdmin.functions.invoke("solar-market-sync", {
      body: {
        mode: "delta",
        source: "webhook",
        delta,
      },
    });

    if (syncError) {
      console.error(`[SM Webhook] Sync failed for event ${eventId}:`, syncError.message);
      await supabaseAdmin.from("solar_market_webhook_events").update({
        status: "error",
        error: syncError.message,
        retries: 1,
        processed_at: new Date().toISOString(),
      }).eq("id", eventId);
      return;
    }

    await supabaseAdmin.from("solar_market_webhook_events").update({
      status: "done",
      processed_at: new Date().toISOString(),
    }).eq("id", eventId);

    console.log(`[SM Webhook] Event ${eventId} processed successfully`);
  } catch (err: any) {
    console.error(`[SM Webhook] Processing error for event ${eventId}:`, err.message);
    await supabaseAdmin.from("solar_market_webhook_events").update({
      status: "error",
      error: err.message,
      retries: 1,
      processed_at: new Date().toISOString(),
    }).eq("id", eventId);
  }
}

// ══════════════════════════════════════════════════════════════
// Main Handler
// ══════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const eventType = body.event || body.type || body.eventType || "unknown";
    console.log(`[SM Webhook] Received event: ${eventType}`, JSON.stringify(body).slice(0, 500));

    // ── Get config ──
    const { data: config } = await supabaseAdmin
      .from("solar_market_config")
      .select("tenant_id, enabled, webhook_secret")
      .limit(1)
      .maybeSingle();

    if (!config?.enabled) {
      return jsonRes({ error: "Integration disabled" }, 400);
    }

    // ── Validate webhook secret ──
    const receivedSecret = req.headers.get("x-webhook-secret") || req.headers.get("X-Webhook-Secret");
    if (config.webhook_secret) {
      if (!receivedSecret || receivedSecret !== config.webhook_secret) {
        console.error("[SM Webhook] Invalid or missing webhook secret");
        return jsonRes({ error: "Invalid webhook secret" }, 401);
      }
    }

    // ── Extract delta info ──
    const delta = extractDeltaPayload(body);
    const { entity_type, entity_id } = extractEntityInfo(body, delta);

    // ── Persist event in queue ──
    const { data: event, error: insertErr } = await supabaseAdmin
      .from("solar_market_webhook_events")
      .insert({
        tenant_id: config.tenant_id,
        event_type: eventType,
        entity_type,
        entity_id,
        payload: body,
        status: delta ? "pending" : "logged",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[SM Webhook] Failed to store event:", insertErr.message);
      return jsonRes({ error: "Failed to store event" }, 500);
    }

    console.log(`[SM Webhook] Event stored: ${event.id} (${eventType}) → ${delta ? `delta:${delta.type}` : "logged only"}`);

    // ── Process in background if actionable ──
    if (delta && event?.id) {
      // @ts-ignore - EdgeRuntime.waitUntil is available in Supabase edge functions
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(processWebhookEvent(supabaseAdmin, event.id, delta));
      } else {
        await processWebhookEvent(supabaseAdmin, event.id, delta);
      }
    }

    return jsonRes({
      success: true,
      event_id: event.id,
      event_type: eventType,
      action: delta ? "processing" : "logged",
      delta_type: delta?.type || null,
    });
  } catch (err: any) {
    console.error("[SM Webhook] Error:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});
