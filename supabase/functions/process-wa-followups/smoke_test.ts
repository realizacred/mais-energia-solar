/**
 * Smoke test for process-wa-followups Edge Function.
 *
 * Run with:
 *   deno test --allow-net --allow-env supabase/functions/process-wa-followups/smoke_test.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.
 *
 * These tests call the DEPLOYED function and verify:
 *   1) It responds 200 with structured metrics (MAX_AI effectively 0 when no candidates)
 *   2) Backlog + alarm fields are present in response
 *   3) Timing breakdown is complete
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/assert_equals.ts";
import { assert } from "https://deno.land/std@0.224.0/assert/assert.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.warn("⚠ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set — skipping smoke tests");
  Deno.exit(0);
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/process-wa-followups`;

async function invokeFunction(): Promise<{ status: number; body: Record<string, any> }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json();
  return { status: res.status, body };
}

Deno.test("Smoke: responds 200 with success", async () => {
  const { status, body } = await invokeFunction();
  assertEquals(status, 200);
  assertEquals(body.success, true);
});

Deno.test("Smoke: timing breakdown present", async () => {
  const { body } = await invokeFunction();
  const timing = body.timing;
  assert(timing != null, "timing must exist");
  assert(typeof timing.total_ms === "number", "total_ms required");
  assert(typeof timing.rpc_ms === "number", "rpc_ms required");
  assert(typeof timing.reconcile_ms === "number", "reconcile_ms required");
  assert(typeof timing.insert_ms === "number", "insert_ms required");
  assert(typeof timing.ai_total_ms === "number", "ai_total_ms required");
  assert(typeof timing.send_ms === "number", "send_ms required");
});

Deno.test("Smoke: backlog counters present", async () => {
  const { body } = await invokeFunction();
  const backlog = body.backlog;
  assert(backlog != null, "backlog must exist");
  assert(typeof backlog.pendente === "number", "backlog.pendente required");
  assert(typeof backlog.pendente_revisao === "number", "backlog.pendente_revisao required");
});

Deno.test("Smoke: alarm fields present", async () => {
  const { body } = await invokeFunction();
  const alarms = body.alarms;
  assert(alarms != null, "alarms must exist");
  assert(typeof alarms.total_ms_high === "boolean", "total_ms_high required");
  assert(typeof alarms.rpc_ms_high === "boolean", "rpc_ms_high required");
  assert(typeof alarms.backlog_pendente_high === "boolean", "backlog_pendente_high required");
  assert(typeof alarms.backlog_pendente_revisao_high === "boolean", "backlog_pendente_revisao_high required");
});

Deno.test("Smoke: counters present", async () => {
  const { body } = await invokeFunction();
  assert(typeof body.conflicts_23505 === "number", "conflicts_23505 required");
  assert(typeof body.instance_rate_limited === "number", "instance_rate_limited required");
  assert(typeof body.ai_budget_exhausted === "number", "ai_budget_exhausted required");
});

Deno.test("Smoke: total_ms within wall-clock safety", async () => {
  const { body } = await invokeFunction();
  assert(body.timing.total_ms < 45000, `total_ms=${body.timing.total_ms} exceeds 45s safety threshold`);
});
