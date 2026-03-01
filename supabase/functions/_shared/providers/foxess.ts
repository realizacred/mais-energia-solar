/**
 * Fox ESS OpenAPI v1.1 Adapter
 * Doc: https://www.foxesscloud.com/public/i18n/en/OpenApiDocument.html
 *
 * Auth: API Key + HMAC-MD5 signature per request
 * Signature: MD5(path + "\r\n" + token + "\r\n" + timestamp)
 * Headers: token, timestamp, signature, lang, Content-Type
 * Plants: POST /op/v0/plant/list (v0 still works, signature required in v1.1)
 * Metrics: POST /op/v0/device/real/query
 *
 * STATUS: PRODUCTION — uses v1.1 signature scheme on v0 endpoints.
 */
import {
  ProviderHttpClient,
  md5Hex,
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
} from "../provider-core/index.ts";

const FOXESS_BASE = "https://www.foxesscloud.com";

export class FoxEssAdapter implements ProviderAdapter {
  readonly providerId = "fox_ess";
  private client: ProviderHttpClient;

  constructor() {
    this.client = new ProviderHttpClient({
      provider: "foxess",
      baseUrl: FOXESS_BASE,
      timeoutMs: 20_000,
      maxRetries: 2,
    });
  }

  validateCredentials(creds: Record<string, string>): void {
    const apiKey = creds.apiKey || creds.token || "";
    if (!apiKey) throw new Error("Missing: apiKey (Fox ESS OpenAPI token)");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const apiKey = creds.apiKey || creds.token || "";

    // Verify by listing plants
    const result = await this.signedPost<Record<string, unknown>>(
      "/op/v0/plant/list",
      apiKey,
      { currentPage: 1, pageSize: 1 },
    );

    if ((result as any).errno !== 0) {
      throw normalizeError(
        new Error((result as any).msg || "Fox ESS auth failed"),
        this.providerId,
        { statusCode: 401 },
      );
    }

    return {
      credentials: { apiKey },
      tokens: { apiKey },
    };
  }

  // Fox ESS uses non-expiring API keys — no refresh needed
  // refreshToken is intentionally not defined

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const apiKey = (auth.tokens.apiKey || auth.credentials.apiKey) as string;
    const plants: NormalizedPlant[] = [];
    let page = 1;

    while (true) {
      const json = await this.signedPost<Record<string, unknown>>(
        "/op/v0/plant/list",
        apiKey,
        { currentPage: page, pageSize: 100 },
      );

      if ((json as any).errno !== 0) {
        throw normalizeError(
          new Error((json as any).msg || `Fox ESS error errno=${(json as any).errno}`),
          this.providerId,
        );
      }

      const list = ((json as any).result?.data || []) as Record<string, unknown>[];
      if (!list.length) break;

      for (const r of list) {
        plants.push({
          external_id: String(r.stationID || r.id || ""),
          name: String(r.stationName || r.name || ""),
          capacity_kw: r.installedCapacity != null ? Number(r.installedCapacity) : null,
          address: (r.address as string) || null,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          status: r.status === 1 ? "normal" : "offline",
          metadata: r,
        });
      }

      const total = (json as any).result?.total || (json as any).result?.pageCount || 0;
      if (page * 100 >= Number(total)) break;
      page++;
    }

    return plants;
  }

  async fetchMetrics(auth: AuthResult, externalPlantId: string): Promise<DailyMetrics> {
    const apiKey = (auth.tokens.apiKey || auth.credentials.apiKey) as string;

    const json = await this.signedPost<Record<string, unknown>>(
      "/op/v0/plant/real/query",
      apiKey,
      { stationID: externalPlantId },
    );

    if ((json as any).errno !== 0) {
      throw normalizeError(
        new Error((json as any).msg || `Fox ESS metrics error`),
        this.providerId,
      );
    }

    const d = (json as any).result || {};
    const hasData = d.currentPower != null || d.todayGeneration != null || d.cumulativeGeneration != null;

    if (!hasData) {
      return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: { ...d, reason: "no_data" } };
    }

    return {
      power_kw: d.currentPower != null ? Number(d.currentPower) : null,
      energy_kwh: d.todayGeneration != null ? Number(d.todayGeneration) : null,
      total_energy_kwh: d.cumulativeGeneration != null ? Number(d.cumulativeGeneration) : null,
      metadata: d,
    };
  }

  // ─── Fox ESS v1.1 Signed Request ─────────────────────
  private async signedPost<T>(path: string, apiKey: string, body: unknown): Promise<T> {
    const timestamp = String(Math.floor(Date.now() / 1000));
    // Signature = MD5(path + "\r\n" + token + "\r\n" + timestamp)
    const signStr = `${path}\r\n${apiKey}\r\n${timestamp}`;
    const signature = await md5Hex(signStr);

    return this.client.post<T>(path, body, {
      headers: {
        token: apiKey,
        timestamp,
        signature,
        lang: "en",
      },
    });
  }
}
