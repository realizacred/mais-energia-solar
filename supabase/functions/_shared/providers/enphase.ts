/**
 * Enphase Enlighten Adapter
 * Doc: https://developer-v4.enphase.com/docs
 *
 * Auth: OAuth2 required for v4 API (client_id + client_secret + authorization_code)
 * Current implementation uses API Key only (legacy v4 key-based, limited access).
 *
 * STATUS: BLOCKED — Full OAuth2 flow not implemented.
 * PRE-REQUISITES for full implementation:
 * 1) Register app at https://developer-v4.enphase.com
 * 2) Obtain client_id and client_secret
 * 3) Implement OAuth2 authorization code flow with redirect URI
 * 4) Store access_token + refresh_token
 * 5) Implement token refresh (expires in 1 day, refresh token in 30 days)
 *
 * Current: API key mode works for systems listing only (read-only, limited fields).
 * Sync is DISABLED until OAuth2 is implemented.
 */
import {
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
} from "../provider-core/index.ts";

export class EnphaseAdapter implements ProviderAdapter {
  readonly providerId = "enphase";

  validateCredentials(creds: Record<string, string>): void {
    if (!creds.apiKey) throw new Error("Missing: apiKey (Enphase API Key)");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const { apiKey } = creds;

    // Verify key works by listing systems
    const res = await fetch(
      `https://api.enphaseenergy.com/api/v4/systems?key=${encodeURIComponent(apiKey)}&size=1`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw normalizeError(
        new Error(`Enphase auth failed (${res.status}): ${text.slice(0, 200)}`),
        this.providerId,
        { statusCode: res.status },
      );
    }

    return {
      credentials: { apiKey },
      tokens: {},
    };
  }

  // OAuth2 refresh not implemented — BLOCKED
  // async refreshToken() { ... }

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const apiKey = auth.credentials.apiKey as string;

    const res = await fetch(
      `https://api.enphaseenergy.com/api/v4/systems?key=${encodeURIComponent(apiKey)}&size=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );

    if (!res.ok) {
      throw normalizeError(
        new Error(`Enphase systems list failed (${res.status})`),
        this.providerId,
        { statusCode: res.status },
      );
    }

    const json = await res.json();
    const list = (json.systems || []) as Record<string, unknown>[];

    return list.map((r) => ({
      external_id: String(r.system_id || ""),
      name: String(r.system_name || ""),
      capacity_kw: r.system_size != null ? Number(r.system_size) / 1000 : null,
      address: (r.city as string) || null,
      latitude: null,
      longitude: null,
      status: (r.status as string) === "normal" ? "normal" : "offline",
      metadata: r,
    }));
  }

  async fetchMetrics(_auth: AuthResult, _externalPlantId: string): Promise<DailyMetrics> {
    // BLOCKED: Metrics require OAuth2 token with telemetry scope
    console.warn(`[Enphase] fetchMetrics BLOCKED — OAuth2 not implemented. Returning empty.`);
    return {
      power_kw: null,
      energy_kwh: null,
      total_energy_kwh: null,
      metadata: { reason: "blocked_oauth2_required" },
    };
  }
}
