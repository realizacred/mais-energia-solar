/**
 * SolaX Cloud Adapter — SN-only official API
 * Doc: https://www.solaxcloud.com/#/api
 *
 * Auth: API Token (tokenId query param)
 * Data: GET /proxy/api/getRealtimeInfo.do?tokenId=X&sn=INVERTER_SN
 *
 * IMPORTANT: The official SolaX API is SN-based (inverter serial number).
 * There is NO official site/plant listing endpoint.
 *
 * fetchPlants returns [] with explicit NOT_SUPPORTED reason.
 * Plants must be registered manually with their inverter SNs.
 *
 * STATUS: PRODUCTION (SN-only data retrieval)
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

  /**
   * SolaX has NO official plant listing endpoint.
   * Returns empty array with explicit NOT_SUPPORTED status.
   * Plants must be registered manually with inverter SNs.
   */
  async fetchPlants(_auth: AuthResult): Promise<NormalizedPlant[]> {
    console.log(
      `[SolaX] fetchPlants: NOT_SUPPORTED — SolaX official API is SN-only. ` +
      `No plant listing endpoint exists. Plants must be registered manually with inverter serial numbers.`,
    );
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
