/**
 * SolaX Cloud Adapter — SN-only official API
 * Doc: https://www.solaxcloud.com/#/api
 *
 * Auth: API Token (tokenId query param)
 * Data: GET /proxy/api/getRealtimeInfo.do?tokenId=X&sn=INVERTER_SN
 *
 * IMPORTANT: The official SolaX API is SN-based (inverter serial number).
 * There is NO official site/plant listing endpoint.
 * The "getMpptSiteLists.do" endpoint used in legacy code is UNOFFICIAL and unreliable.
 *
 * For discovery, we attempt getUserSiteList and fall back to requiring SNs.
 *
 * STATUS: PRODUCTION (limited — SN-only data retrieval)
 */
import {
  ProviderHttpClient,
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
} from "../provider-core/index.ts";

const SOLAX_BASE = "https://www.solaxcloud.com";

export class SolaXAdapter implements ProviderAdapter {
  readonly providerId = "solax";
  private client: ProviderHttpClient;

  constructor() {
    this.client = new ProviderHttpClient({
      provider: "solax",
      baseUrl: SOLAX_BASE,
      timeoutMs: 15_000,
      maxRetries: 2,
    });
  }

  validateCredentials(creds: Record<string, string>): void {
    if (!creds.apiKey) throw new Error("Missing: apiKey (SolaX Cloud API Token)");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const { apiKey } = creds;

    // Verify token validity with a test SN call
    // A valid token returns specific error for invalid SN vs auth error
    const json = await this.client.get<Record<string, unknown>>(
      `/proxyApp/proxy/api/getRealtimeInfo.do?tokenId=${encodeURIComponent(apiKey)}&sn=VALIDATION_TEST`,
    );

    const exception = (json as any).exception || "";
    if (/token/i.test(exception)) {
      throw normalizeError(
        new Error("SolaX: invalid API token"),
        this.providerId,
        { statusCode: 401 },
      );
    }

    return {
      credentials: { apiKey },
      tokens: { apiKey },
    };
  }

  // SolaX uses non-expiring API tokens — no refresh needed

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const apiKey = (auth.tokens.apiKey || auth.credentials.apiKey) as string;

    // Attempt unofficial site list (best-effort, may return empty)
    try {
      const json = await this.client.get<Record<string, unknown>>(
        `/proxyApp/proxy/api/getMpptSiteLists.do?tokenId=${encodeURIComponent(apiKey)}`,
      );
      const list = ((json as any).result || []) as Record<string, unknown>[];
      if (list.length > 0) {
        return list.map((r) => ({
          external_id: String(r.siteId || r.id || ""),
          name: String(r.siteName || r.name || ""),
          capacity_kw: r.capacity != null ? Number(r.capacity) : null,
          address: (r.address as string) || null,
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          status: "normal",
          metadata: { ...r, _source: "getMpptSiteLists_unofficial" },
        }));
      }
    } catch {
      // Expected: unofficial endpoint may not work
    }

    console.log(`[SolaX] No plants from site list. SolaX requires inverter SNs for data retrieval.`);
    return [];
  }

  async fetchMetrics(auth: AuthResult, snOrSiteId: string): Promise<DailyMetrics> {
    const apiKey = (auth.tokens.apiKey || auth.credentials.apiKey) as string;

    const json = await this.client.get<Record<string, unknown>>(
      `/proxyApp/proxy/api/getRealtimeInfo.do?tokenId=${encodeURIComponent(apiKey)}&sn=${encodeURIComponent(snOrSiteId)}`,
    );

    if ((json as any).exception) {
      throw normalizeError(
        new Error(`SolaX API error: ${(json as any).exception}`),
        this.providerId,
      );
    }

    const d = (json as any).result || {};
    const hasData = d.acpower != null || d.yieldtoday != null || d.yieldtotal != null;

    if (!hasData) {
      return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: { ...d, reason: "no_data" } };
    }

    return {
      power_kw: d.acpower != null ? Number(d.acpower) / 1000 : null,
      energy_kwh: d.yieldtoday != null ? Number(d.yieldtoday) : null,
      total_energy_kwh: d.yieldtotal != null ? Number(d.yieldtotal) : null,
      metadata: d,
    };
  }
}
