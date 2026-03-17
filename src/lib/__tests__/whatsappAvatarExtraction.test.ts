/**
 * §41 — WhatsApp Webhook: extração robusta de avatar
 * Testa extractContactProfilePictureUrl com múltiplos formatos de payload.
 */
import { describe, it, expect } from "vitest";

// ─── Replicated from process-webhook-events/index.ts ───

const INVALID_PROFILE_PICTURE_VALUES = new Set(["", "none", "null", "undefined"]);

function extractContactProfilePictureUrl(contact: any): string | null {
  const candidate =
    contact?.profilePictureUrl ??
    contact?.imgUrl ??
    contact?.profilePicUrl ??
    contact?.pictureUrl ??
    contact?.data?.profilePictureUrl ??
    contact?.data?.imgUrl ??
    contact?.data?.profilePicUrl ??
    contact?.data?.pictureUrl ??
    null;

  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  if (INVALID_PROFILE_PICTURE_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
}

// ─── Tests ───────────────────────────────────────────────

describe("extractContactProfilePictureUrl (§41)", () => {
  const VALID_URL = "https://pps.whatsapp.net/v/t61/photo.jpg";

  it("extrai de profilePictureUrl (Evolution API v1)", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: VALID_URL })).toBe(VALID_URL);
  });

  it("extrai de imgUrl (Baileys)", () => {
    expect(extractContactProfilePictureUrl({ imgUrl: VALID_URL })).toBe(VALID_URL);
  });

  it("extrai de profilePicUrl (variante)", () => {
    expect(extractContactProfilePictureUrl({ profilePicUrl: VALID_URL })).toBe(VALID_URL);
  });

  it("extrai de pictureUrl (variante)", () => {
    expect(extractContactProfilePictureUrl({ pictureUrl: VALID_URL })).toBe(VALID_URL);
  });

  it("extrai de data.profilePictureUrl (nested)", () => {
    expect(
      extractContactProfilePictureUrl({ data: { profilePictureUrl: VALID_URL } })
    ).toBe(VALID_URL);
  });

  it("extrai de data.imgUrl (nested Baileys)", () => {
    expect(
      extractContactProfilePictureUrl({ data: { imgUrl: VALID_URL } })
    ).toBe(VALID_URL);
  });

  it("prioriza campo top-level sobre nested", () => {
    const result = extractContactProfilePictureUrl({
      profilePictureUrl: "https://top-level.jpg",
      data: { profilePictureUrl: "https://nested.jpg" },
    });
    expect(result).toBe("https://top-level.jpg");
  });

  // ─── Invalid values ───

  it("rejeita string vazia", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: "" })).toBeNull();
  });

  it("rejeita 'none'", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: "none" })).toBeNull();
  });

  it("rejeita 'null' (string)", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: "null" })).toBeNull();
  });

  it("rejeita 'undefined' (string)", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: "undefined" })).toBeNull();
  });

  it("rejeita 'None' (case insensitive)", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: "None" })).toBeNull();
  });

  it("rejeita ' none ' com espaços", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: " none " })).toBeNull();
  });

  it("retorna null para payload vazio", () => {
    expect(extractContactProfilePictureUrl({})).toBeNull();
  });

  it("retorna null para null", () => {
    expect(extractContactProfilePictureUrl(null)).toBeNull();
  });

  it("retorna null para undefined", () => {
    expect(extractContactProfilePictureUrl(undefined)).toBeNull();
  });

  it("retorna null quando campo é número", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: 12345 })).toBeNull();
  });

  it("retorna null quando campo é boolean", () => {
    expect(extractContactProfilePictureUrl({ profilePictureUrl: false })).toBeNull();
  });

  it("faz trim de URLs válidas", () => {
    expect(
      extractContactProfilePictureUrl({ profilePictureUrl: "  https://pic.jpg  " })
    ).toBe("https://pic.jpg");
  });
});
