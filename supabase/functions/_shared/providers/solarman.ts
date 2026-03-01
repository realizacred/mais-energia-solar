/**
 * Solarman Business API Adapter — REFERENCE IMPLEMENTATION.
 * Doc: https://doc.solarmanpv.com/api/business-api
 *
 * Auth: POST /account/v1.0/token?appId=X — SHA-256 hashed password
 * Plants: POST /station/v1.0/list — paginated (page/size)
 * Metrics: POST /station/v1.0/realTime — by stationId
 * Token expires in ~7200s (returned in response).
 *
 * NOTE: Solarman has NO refresh token endpoint.
 * Re-authentication requires the original password, which is NOT persisted.
 * If token expires, user must reconnect.
 */
import {
  ProviderHttpClient,
  sha256Hex,
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
} from "../provider-core/index.ts";

const SOLARMAN_BASE = "https://api.solarmanpv.com";

const STATUS_MAP: Record<string, string> = {
  "1": "normal", "2": "offline", "3": "alarm", "4": "no_communication",
};

export class SolarmanAdapter implements ProviderAdapter {
  readonly providerId = "solarman_business";
  private client: ProviderHttpClient;

  constructor() {
    this.client = new ProviderHttpClient({
      provider: "solarman",
      baseUrl: SOLARMAN_BASE,
      timeoutMs: 20_000,
      maxRetries: 2,
    });
  }

  validateCredentials(creds: Record<string, string>): void {
    const appId = creds.appId || Deno.env.get("SOLARMAN_APP_ID") || "";
    const appSecret = creds.appSecret || Deno.env.get("SOLARMAN_APP_SECRET") || "";
    if (!appId) throw new Error("Missing: appId");
    if (!appSecret) throw new Error("Missing: appSecret");
    if (!creds.email) throw new Error("Missing: email");
    if (!creds.password) throw new Error("Missing: password");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    const appId = creds.appId || Deno.env.get("SOLARMAN_APP_ID") || "";
    const appSecret = creds.appSecret || Deno.env.get("SOLARMAN_APP_SECRET") || "";
    const { email, password } = creds;

    this.validateCredentials(creds);

    const hashHex = await sha256Hex(password);

    const json = await this.client.post<Record<string, unknown>>(
      `/account/v1.0/token?appId=${encodeURIComponent(appId)}&language=en`,
      { appSecret, email, password: hashHex },
    );

    const accessToken = json.access_token as string;
    if (!accessToken) {
      throw normalizeError(
        new Error(String(json.msg || "Solarman auth failed")),
        this.providerId,
        { statusCode: 401 },
      );
    }

    const expiresAt = new Date(
      Date.now() + ((json.expires_in as number) || 7200) * 1000,
    ).toISOString();

    return {
      credentials: { appId, appSecret, email },
      tokens: {
        access_token: accessToken,
        token_type: (json.token_type as string) || "bearer",
        expires_at: expiresAt,
        uid: json.uid,
        orgId: json.orgId,
      },
    };
  }

  /**
   * Solarman has NO refresh token mechanism.
   * Re-authentication requires the original password, which is stripped
   * from storage for security. If the token is expired, the user MUST
   * reconnect via the UI.
   */
  async refreshToken(
    _tokens: Record<string, unknown>,
    _credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    throw normalizeError(
      new Error("Solarman tokens cannot be refreshed. Password not stored. User must reconnect."),
      this.providerId,
      { statusCode: 401 },
    );
  }

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const token = auth.tokens.access_token as string;
    const plants: NormalizedPlant[] = [];
    let page = 1;

    while (true) {
      const json = await this.authedPost<Record<string, unknown>>(
        "/station/v1.0/list",
        token,
        { page, size: 100 },
      );

      const list = (json.stationList || json.data || []) as Record<string, unknown>[];
      if (!list.length) break;

      for (const r of list) {
        plants.push({
          external_id: String(r.stationId || r.id || ""),
          name: String(r.stationName || r.name || ""),
          capacity_kw: r.installedCapacity != null ? Number(r.installedCapacity) : null,
          address: r.locationAddress ? String(r.locationAddress) : null,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          status: STATUS_MAP[String(r.status)] || "unknown",
          metadata: r,
        });
      }

      if (page * 100 >= ((json.total as number) || 0)) break;
      page++;
    }

    return plants;
  }

  async fetchMetrics(auth: AuthResult, externalPlantId: string): Promise<DailyMetrics> {
    const token = auth.tokens.access_token as string;

    const json = await this.authedPost<Record<string, unknown>>(
      "/station/v1.0/realTime",
      token,
      { stationId: Number(externalPlantId) },
    );

    // Check if data is genuinely empty (no generation fields at all)
    const hasData = json.generationPower != null || json.generationValue != null ||
      json.totalGenerationValue != null || json.generationTotal != null;

    if (!hasData) {
      return {
        power_kw: null,
        energy_kwh: null,
        total_energy_kwh: null,
        metadata: { ...json, reason: "no_data" },
      };
    }

    return {
      power_kw: json.generationPower != null ? Number(json.generationPower) / 1000 : null,
      energy_kwh: json.generationValue != null ? Number(json.generationValue) : null,
      total_energy_kwh:
        (json.totalGenerationValue ?? json.generationTotal) != null
          ? Number(json.totalGenerationValue ?? json.generationTotal)
          : null,
      metadata: json,
    };
  }

  // ─── Internal ──────────────────────────────────────────
  private authedPost<T>(path: string, token: string, body: unknown) {
    return this.client.post<T>(path, body, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
}
