/**
 * Unit tests for Integration Core: ErrorNormalizer + ProviderHttpClient types
 */
import { assertEquals, assert } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { normalizeError } from "../_shared/provider-core/error-normalizer.ts";
import type { ProviderError } from "../_shared/provider-core/types.ts";

Deno.test("normalizeError: classifies 401 as AUTH", () => {
  const err = normalizeError(new Error("Unauthorized"), "test_provider", { statusCode: 401 });
  assertEquals(err.category, "AUTH");
  assertEquals(err.retryable, false);
  assertEquals(err.provider, "test_provider");
});

Deno.test("normalizeError: classifies 429 as RATE_LIMIT", () => {
  const err = normalizeError(new Error("Too many requests"), "solarman", { statusCode: 429 });
  assertEquals(err.category, "RATE_LIMIT");
  assertEquals(err.retryable, true);
});

Deno.test("normalizeError: classifies 500+ as PROVIDER_DOWN", () => {
  const err = normalizeError(new Error("Internal Server Error"), "solis", { statusCode: 502 });
  assertEquals(err.category, "PROVIDER_DOWN");
  assertEquals(err.retryable, true);
});

Deno.test("normalizeError: detects auth patterns in message", () => {
  const patterns = [
    "Invalid token provided",
    "wrong sign",
    "User Does Not Exist",
    "expired token",
    "not exit user",
  ];
  for (const msg of patterns) {
    const err = normalizeError(new Error(msg), "test");
    assertEquals(err.category, "AUTH", `Expected AUTH for: "${msg}", got ${err.category}`);
  }
});

Deno.test("normalizeError: detects network patterns", () => {
  const err = normalizeError(new Error("Failed to fetch"), "growatt");
  assertEquals(err.category, "PROVIDER_DOWN");
  assertEquals(err.retryable, true);
});

Deno.test("normalizeError: detects timeout", () => {
  const err = normalizeError(new Error("Request timed out"), "deye");
  assertEquals(err.category, "TIMEOUT");
  assertEquals(err.retryable, true);
});

Deno.test("normalizeError: detects parse errors", () => {
  const err = normalizeError(new Error("Unexpected token < in JSON"), "foxess");
  assertEquals(err.category, "PARSE");
  assertEquals(err.retryable, false);
});

Deno.test("normalizeError: passes through ProviderError", () => {
  const original: ProviderError = {
    category: "RATE_LIMIT",
    provider: "solis",
    statusCode: 429,
    providerErrorCode: null,
    message: "Rate limit",
    retryable: true,
  };
  const result = normalizeError(original, "ignored");
  assertEquals(result, original);
});

Deno.test("normalizeError: handles string errors", () => {
  const err = normalizeError("Something went wrong", "test");
  assertEquals(err.category, "UNKNOWN");
  assertEquals(err.message, "Something went wrong");
});

Deno.test("normalizeError: handles plain objects", () => {
  const err = normalizeError({ message: "forbidden", status: 403 }, "test");
  assertEquals(err.category, "AUTH");
});

// ─── Solarman Adapter: validateCredentials ────────────────
import { SolarmanAdapter } from "../_shared/providers/solarman.ts";

Deno.test("SolarmanAdapter: validateCredentials throws on missing fields", () => {
  const adapter = new SolarmanAdapter();
  let threw = false;
  try {
    adapter.validateCredentials({ email: "x@y.com", password: "p" });
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("appId") || (e as Error).message.includes("appSecret"));
  }
  assert(threw, "Should throw on missing appId/appSecret");
});

// ─── Solis Adapter: validateCredentials ────────────────
import { SolisAdapter } from "../_shared/providers/solis.ts";

Deno.test("SolisAdapter: validateCredentials throws on missing apiId", () => {
  const adapter = new SolisAdapter();
  let threw = false;
  try {
    adapter.validateCredentials({ apiSecret: "abc" });
  } catch (e) {
    threw = true;
    assert((e as Error).message.includes("apiId"));
  }
  assert(threw);
});
