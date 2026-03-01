/**
 * SAJ eSolar Adapter
 * Doc: https://fop.saj-electric.com (login-based, cookie auth)
 *
 * Auth: POST /saj/login → session cookies
 * Plants: GET /saj/monitor/site/getUserPlantList
 * Metrics: GET /saj/monitor/site/getPlantDetailInfo?plantuid=X
 *
 * NOTE: SAJ uses cookie-based auth with session expiration.
 * refreshToken re-authenticates using stored email/password.
 * Password is required for re-auth and persisted in tokens (encrypted at rest).
 *
 * STATUS: PRODUCTION — cookie auth with auto re-auth
 */
import {
  ProviderHttpClient,
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
} from "../provider-core/index.ts";

const SAJ_BASE = "https://fop.saj-electric.com";

export class SajAdapter implements ProviderAdapter {
  readonly providerId = "saj";
  private client: ProviderHttpClient;

  constructor() {
    this.client = new ProviderHttpClient({
      provider: "saj",
      baseUrl: SAJ_BASE,
      timeoutMs: 20_000,
      maxRetries: 1, // Cookie auth — retries won't help
    });
  }

  validateCredentials(creds: Record<string, string>): void {
    if (!creds.email) throw new Error("Missing: email");
    if (!creds.password) throw new Error("Missing: password");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const { email, password } = creds;

    const res = await fetch(`${SAJ_BASE}/saj/login`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}&lang=en`,
      redirect: "manual",
    });

    if (!res.ok && res.status !== 302) {
      const text = await res.text().catch(() => "");
      throw normalizeError(
        new Error(`SAJ login failed (${res.status}): ${text.slice(0, 200)}`),
        this.providerId,
        { statusCode: res.status },
      );
    }

    const cookies = res.headers.get("set-cookie") || "";
    if (!cookies) {
      throw normalizeError(
        new Error("SAJ login: no session cookies returned"),
        this.providerId,
        { statusCode: 401 },
      );
    }

    return {
      credentials: { email },
      tokens: { cookies, password_for_reauth: password },
    };
  }

  /**
   * SAJ cookie sessions expire. Re-authenticate using stored password.
   */
  async refreshToken(
    tokens: Record<string, unknown>,
    credentials: Record<string, unknown>,
  ): Promise<AuthResult> {
    const email = (credentials.email as string) || "";
    const password = (tokens.password_for_reauth as string) || "";

    if (!email || !password) {
      throw normalizeError(
        new Error("SAJ re-auth requires email/password. User must reconnect."),
        this.providerId,
        { statusCode: 401 },
      );
    }

    console.log(`[SAJ] Re-authenticating for ${email}...`);
    return this.authenticate({ email, password });
  }

  async fetchPlants(auth: AuthResult): Promise<NormalizedPlant[]> {
    const cookies = auth.tokens.cookies as string;

    const res = await fetch(`${SAJ_BASE}/saj/monitor/site/getUserPlantList`, {
      headers: { Cookie: cookies },
    });

    if (!res.ok) {
      throw normalizeError(
        new Error(`SAJ plants list failed (${res.status})`),
        this.providerId,
        { statusCode: res.status },
      );
    }

    const json = await res.json();
    const list = (json.plantList || []) as Record<string, unknown>[];

    return list.map((r) => ({
      external_id: String(r.plantuid || r.id || ""),
      name: String(r.plantname || r.name || ""),
      capacity_kw: r.peakpower != null ? Number(r.peakpower) : null,
      address: (r.address as string) || null,
      latitude: r.lat != null ? Number(r.lat) : null,
      longitude: r.lng != null ? Number(r.lng) : null,
      status: r.isOnline === true || r.isOnline === 1 ? "normal" : "offline",
      metadata: r,
    }));
  }

  async fetchMetrics(auth: AuthResult, plantUid: string): Promise<DailyMetrics> {
    const cookies = auth.tokens.cookies as string;

    const res = await fetch(
      `${SAJ_BASE}/saj/monitor/site/getPlantDetailInfo?plantuid=${encodeURIComponent(plantUid)}`,
      { headers: { Cookie: cookies } },
    );

    if (!res.ok) {
      throw normalizeError(
        new Error(`SAJ metrics failed (${res.status})`),
        this.providerId,
        { statusCode: res.status },
      );
    }

    const json = await res.json();
    const d = json.plantDetail || {};

    const hasData = d.nowPower != null || d.todayElectricity != null || d.totalElectricity != null;
    if (!hasData) {
      return { power_kw: null, energy_kwh: null, total_energy_kwh: null, metadata: { ...d, reason: "no_data" } };
    }

    return {
      power_kw: d.nowPower != null ? Number(d.nowPower) : null,
      energy_kwh: d.todayElectricity != null ? Number(d.todayElectricity) : null,
      total_energy_kwh: d.totalElectricity != null ? Number(d.totalElectricity) : null,
      metadata: d,
    };
  }
}
