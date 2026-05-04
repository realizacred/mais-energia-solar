// Worker de enriquecimento de equipamentos via IA — processa jobs persistentes em background.
// Pega 1 job pending/running, processa CHUNK_SIZE itens, atualiza progresso, reagenda via waitUntil.
// Pode ser disparado por: front (após criar job), pg_cron (safety net), ou auto-reagendamento.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHUNK_SIZE = 8;             // itens por invocação
const STALE_AFTER_MS = 90_000;    // job sem heartbeat por 90s = órfão
const ENRICH_DELAY_MS = 800;      // pequeno espaçamento entre chamadas

async function pickJob(admin: ReturnType<typeof createClient>) {
  // 1) Tenta um pending
  const { data: pending } = await admin
    .from("equipment_enrichment_jobs")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pending) return pending;

  // 2) Tenta um running órfão (sem heartbeat recente)
  const cutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { data: stale } = await admin
    .from("equipment_enrichment_jobs")
    .select("*")
    .eq("status", "running")
    .or(`last_heartbeat_at.is.null,last_heartbeat_at.lt.${cutoff}`)
    .order("last_heartbeat_at", { ascending: true, nullsFirst: true })
    .limit(1)
    .maybeSingle();
  return stale;
}

async function processJob(admin: ReturnType<typeof createClient>, job: any) {
  const ids: string[] = job.equipment_ids || [];
  const total = ids.length;
  let idx = job.last_processed_index || 0;
  let success = job.success || 0;
  let failed = job.failed || 0;
  let dualCount = job.dual_count || 0;
  let lastModel = job.last_model || null;

  // Marca como running e bate heartbeat
  await admin
    .from("equipment_enrichment_jobs")
    .update({
      status: "running",
      started_at: job.started_at || new Date().toISOString(),
      last_heartbeat_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  const end = Math.min(idx + CHUNK_SIZE, total);

  for (let i = idx; i < end; i++) {
    // Verifica cancelamento a cada item
    const { data: fresh } = await admin
      .from("equipment_enrichment_jobs")
      .select("status")
      .eq("id", job.id)
      .maybeSingle();
    if (fresh?.status === "cancelled") {
      console.warn(`[worker] job ${job.id} cancelled at ${i}`);
      return { done: true, cancelled: true };
    }

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/enrich-equipment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SERVICE_ROLE}`,
        },
        body: JSON.stringify({
          equipment_type: job.equipment_type,
          equipment_id: ids[i],
          tenant_id: job.tenant_id,
        }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || data?.error) {
        failed++;
      } else {
        success++;
        if (data?.winner_model) lastModel = data.winner_model;
        if (data?.dual_ai_used) dualCount++;
      }
    } catch (e) {
      failed++;
      console.error(`[worker] item ${ids[i]} error:`, e);
    }

    idx = i + 1;

    // heartbeat + progresso
    await admin
      .from("equipment_enrichment_jobs")
      .update({
        processed: idx,
        success,
        failed,
        dual_count: dualCount,
        last_model: lastModel,
        last_processed_index: idx,
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (i < end - 1) await new Promise((r) => setTimeout(r, ENRICH_DELAY_MS));
  }

  if (idx >= total) {
    await admin
      .from("equipment_enrichment_jobs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        last_heartbeat_at: new Date().toISOString(),
      })
      .eq("id", job.id);
    return { done: true, cancelled: false };
  }
  return { done: false, cancelled: false };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    const job = await pickJob(admin);
    if (!job) {
      return new Response(JSON.stringify({ ok: true, picked: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await processJob(admin, job);

    // Auto-reagenda se ainda não terminou
    if (!result.done) {
      // @ts-ignore EdgeRuntime is provided by Supabase
      EdgeRuntime.waitUntil(
        fetch(`${SUPABASE_URL}/functions/v1/equipment-enrichment-worker`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE}`,
          },
          body: "{}",
        }).catch((e) => console.error("[worker] reschedule failed:", e)),
      );
    }

    return new Response(
      JSON.stringify({ ok: true, picked: true, job_id: job.id, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[worker] fatal:", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
