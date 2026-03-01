/**
 * Provider Adapter Registry — maps provider IDs to adapter instances.
 * Import from here in edge functions.
 */
import type { ProviderAdapter } from "../provider-core/index.ts";
import { SolarmanAdapter } from "./solarman.ts";
import { SolisAdapter } from "./solis.ts";
import { FoxEssAdapter } from "./foxess.ts";
import { SolaXAdapter } from "./solax.ts";
import { SajAdapter } from "./saj.ts";
import { EnphaseAdapter } from "./enphase.ts";

const adapters: Record<string, () => ProviderAdapter> = {
  solarman_business: () => new SolarmanAdapter(),
  solarman_business_api: () => new SolarmanAdapter(), // legacy alias
  sofar: () => new SolarmanAdapter(), // Sofar uses Solarman platform
  solis_cloud: () => new SolisAdapter(),
  fox_ess: () => new FoxEssAdapter(),
  solax: () => new SolaXAdapter(),
  saj: () => new SajAdapter(),
  enphase: () => new EnphaseAdapter(),
};

/**
 * Get a provider adapter by ID.
 * Returns null if no canonical adapter exists (fall back to legacy monolith).
 */
export function getAdapter(providerId: string): ProviderAdapter | null {
  const factory = adapters[providerId];
  return factory ? factory() : null;
}

/** Check if a provider has a canonical adapter */
export function hasCanonicalAdapter(providerId: string): boolean {
  return providerId in adapters;
}
