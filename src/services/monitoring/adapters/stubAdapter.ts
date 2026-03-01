/**
 * Stub Adapter — placeholder for providers without real API implementation yet.
 * Returns empty results and identifies itself as "not implemented".
 */
import { BaseAdapter, type AdapterConfig } from "./types";

export class StubAdapter extends BaseAdapter {
  readonly providerId: string;

  constructor(providerId: string) {
    super();
    this.providerId = providerId;
  }

  async testConnection(_config: AdapterConfig) {
    return {
      ok: false,
      error: `O adapter para "${this.providerId}" ainda não foi implementado. Em breve estará disponível.`,
    };
  }
}
