// Smoke test: canonicalizePhoneForDedup deve casar com canonical_phone_digits do DB.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function canonicalizePhoneForDedup(raw: string): string {
  let d = raw;
  if (d.length === 13 && d.startsWith("55")) d = d.slice(2);
  if (d.length === 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length !== 10 && d.length !== 11) return raw;
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  const dddNum = Number(ddd);
  if (dddNum < 11 || dddNum > 99) return raw;
  if (rest.length === 8 && /^[89]/.test(rest)) return `${ddd}9${rest}`;
  return d;
}

Deno.test("celular 10d → 11d (caso 74)", () => {
  assertEquals(canonicalizePhoneForDedup("3299466877"), "32999466877");
});
Deno.test("celular 10d → 11d (caso 89)", () => {
  assertEquals(canonicalizePhoneForDedup("3299920419"), "32999920419");
});
Deno.test("celular 10d com 8 → 11d (caso 884)", () => {
  assertEquals(canonicalizePhoneForDedup("3298158283"), "32998158283");
});
Deno.test("celular 10d Rita (caso 925)", () => {
  assertEquals(canonicalizePhoneForDedup("3285157918"), "32985157918");
});
Deno.test("já 11d mantém", () => {
  assertEquals(canonicalizePhoneForDedup("32999466877"), "32999466877");
});
Deno.test("fixo 10d (2-7) mantém 10d", () => {
  assertEquals(canonicalizePhoneForDedup("3233334444"), "3233334444");
});
Deno.test("DDI 55 removido", () => {
  assertEquals(canonicalizePhoneForDedup("5532988887777"), "32988887777");
});
