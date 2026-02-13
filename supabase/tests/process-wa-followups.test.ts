/**
 * Smoke test for process-wa-followups Edge Function.
 * Lives OUTSIDE the function folder to avoid bundle inflation.
 *
 * Run:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     deno test --allow-net --allow-env supabase/tests/process-wa-followups.test.ts
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

async function invoke(): Promise<{ status: number; body: Record<string, any> }> {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
  });
  return { status: res.status, body: await res.json() };
}

Deno.test("responds 200 with success", async () => {
  const { status, body } = await invoke();
  assertEquals(status, 200);
  assertEquals(body.success, true);
});

Deno.test("timing breakdown complete", async () => {
  const { body } = await invoke();
  for (const key of ["total_ms", "rpc_ms", "reconcile_ms", "insert_ms", "ai_total_ms", "send_ms"]) {
    assert(typeof body.timing?.[key] === "number", `timing.${key} missing`);
  }
});

Deno.test("backlog counters present", async () => {
  const { body } = await invoke();
  assert(typeof body.backlog?.pendente === "number", "backlog.pendente missing");
  assert(typeof body.backlog?.pendente_revisao === "number", "backlog.pendente_revisao missing");
});

Deno.test("alarm fields present", async () => {
  const { body } = await invoke();
  for (const key of ["total_ms_high", "rpc_ms_high", "backlog_pendente_high", "backlog_pendente_revisao_high"]) {
    assert(typeof body.alarms?.[key] === "boolean", `alarms.${key} missing`);
  }
});

Deno.test("counters present", async () => {
  const { body } = await invoke();
  for (const key of ["conflicts_23505", "instance_rate_limited", "ai_budget_exhausted"]) {
    assert(typeof body[key] === "number", `${key} missing`);
  }
});

Deno.test("wall-clock safety", async () => {
  const { body } = await invoke();
  assert(body.timing.total_ms < 45000, `total_ms=${body.timing.total_ms} exceeds 45s`);
});
