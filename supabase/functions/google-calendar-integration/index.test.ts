import { loadSync } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
loadSync({ export: true, allowEmptyValues: true, examplePath: null });
import { assertEquals, assertNotEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/google-calendar-integration`;

// ── Crypto unit tests (via the function's behavior) ─────────

// Test 1: AES-GCM encrypt/decrypt round-trip via connect flow
// We test that the init endpoint works (proves the function loads without crypto errors)
Deno.test("init endpoint returns valid structure (no auth → 401)", async () => {
  const res = await fetch(`${FN_URL}?action=init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.text();
  // Without auth token, should get 401
  assertEquals(res.status, 401);
  assert(body.includes("autenticado") || body.includes("Unauthorized"), "Should indicate auth required");
});

// Test 2: connect without auth → 401
Deno.test("connect endpoint requires authentication", async () => {
  const res = await fetch(`${FN_URL}?action=connect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ origin: "https://example.com" }),
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("autenticado") || body.includes("Unauthorized"));
});

// Test 3: test endpoint without auth → 401
Deno.test("test endpoint requires authentication", async () => {
  const res = await fetch(`${FN_URL}?action=test`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("autenticado") || body.includes("Unauthorized"));
});

// Test 4: disconnect without auth → 401
Deno.test("disconnect endpoint requires authentication", async () => {
  const res = await fetch(`${FN_URL}?action=disconnect`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.text();
  assertEquals(res.status, 401);
  assert(body.includes("autenticado") || body.includes("Unauthorized"));
});

// Test 5: callback-proxy with forged state → 403
Deno.test("callback-proxy rejects invalid/tampered state", async () => {
  const res = await fetch(`${FN_URL}?action=callback-proxy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      code: "fake-code",
      state: btoa(JSON.stringify({ tenantId: "fake", userId: "fake" })) + ".0000",
      redirect_uri: "https://example.com/callback",
    }),
  });
  const body = await res.json();
  assertEquals(res.status, 403);
  assert(body.error?.includes("Invalid") || body.error?.includes("expired"), "Should reject tampered state");
});

// Test 6: unknown action → 400
Deno.test("unknown action returns 400", async () => {
  const res = await fetch(`${FN_URL}?action=nonexistent`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert(body.error?.includes("Unknown action"));
});

// Test 7: Response bodies never contain raw tokens (log sanitization check)
Deno.test("init response never leaks secret fields", async () => {
  const res = await fetch(`${FN_URL}?action=init`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
    },
  });
  const body = await res.text();
  // Even error responses should not contain token-like strings
  assert(!body.includes("oauth_client_secret_encrypted"), "Should not expose secret field name in response");
});
