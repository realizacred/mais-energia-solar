/**
 * Enphase Enlighten Adapter
 * Doc: https://developer-v4.enphase.com/docs
 *
 * Auth: OAuth2 required for v4 API (client_id + client_secret + authorization_code)
 *
 * STATUS: BLOCKED — Full OAuth2 flow not implemented.
 * PRE-REQUISITES for full implementation:
 * 1) Register app at https://developer-v4.enphase.com
 * 2) Obtain client_id and client_secret
 * 3) Implement OAuth2 authorization code flow with redirect URI
 * 4) Store access_token + refresh_token
 * 5) Implement token refresh (expires in 1 day, refresh token in 30 days)
 *
 * ALL methods throw PERMISSION errors with retryable=false.
 * Connect sets status=blocked. Sync is disabled.
 */
import {
  normalizeError,
  type ProviderAdapter,
  type AuthResult,
  type NormalizedPlant,
  type DailyMetrics,
  type ProviderError,
} from "../provider-core/index.ts";

function blockedError(method: string): ProviderError {
  return {
    category: "PERMISSION",
    provider: "enphase",
    statusCode: null,
    providerErrorCode: "OAUTH2_REQUIRED",
    message: `Enphase ${method} BLOCKED: OAuth2 v4 flow not implemented. ` +
      `Pre-requisites: 1) Register app at developer-v4.enphase.com, ` +
      `2) Implement OAuth2 authorization code flow, ` +
      `3) Store access_token + refresh_token.`,
    retryable: false,
  };
}

export class EnphaseAdapter implements ProviderAdapter {
  readonly providerId = "enphase";

  validateCredentials(creds: Record<string, string>): void {
    // Enphase requires OAuth2, not just an API key.
    // We accept apiKey for legacy compatibility but it cannot unlock full API.
    if (!creds.apiKey) throw new Error("Missing: apiKey (Enphase API Key)");
  }

  async authenticate(creds: Record<string, string>): Promise<AuthResult> {
    this.validateCredentials(creds);
    const { apiKey } = creds;

    // Verify key works by listing systems (limited read-only access)
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

    // Auth succeeds but integration is BLOCKED for sync.
    // The monolith connect handler checks for BLOCKED status via health check.
    return {
      credentials: { apiKey },
      tokens: { _blocked: true, _reason: "oauth2_required" },
    };
  }

  async fetchPlants(_auth: AuthResult): Promise<NormalizedPlant[]> {
    throw blockedError("fetchPlants");
  }

  async fetchMetrics(_auth: AuthResult, _externalPlantId: string): Promise<DailyMetrics> {
    throw blockedError("fetchMetrics");
  }
}
