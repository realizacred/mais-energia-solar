/**
 * Adapter Registry — maps provider IDs to adapter instances.
 * Import and register each adapter here.
 */
import type { IProviderAdapter } from "./types";
import { StubAdapter } from "./stubAdapter";
import { PROVIDER_REGISTRY } from "../providerRegistry";

// ─── Concrete adapter imports ────────────────────────────────────
// Active adapters are resolved via Edge Functions, not client-side.
// This registry is for the client-side test-connection and UI hints only.

const _adapters = new Map<string, IProviderAdapter>();

/** Register a concrete adapter */
export function registerAdapter(adapter: IProviderAdapter): void {
  _adapters.set(adapter.providerId, adapter);
}

/** Get adapter for a provider (falls back to StubAdapter) */
export function getAdapter(providerId: string): IProviderAdapter {
  return _adapters.get(providerId) || new StubAdapter(providerId);
}

/** Get all registered (non-stub) adapter IDs */
export function getRegisteredAdapterIds(): string[] {
  return Array.from(_adapters.keys());
}

/** Check if a provider has a real (non-stub) adapter */
export function hasRealAdapter(providerId: string): boolean {
  return _adapters.has(providerId);
}

// ─── Auto-generate stub entries for all providers in registry ────
// This ensures every provider has at least a stub adapter available
PROVIDER_REGISTRY.forEach((p) => {
  if (!_adapters.has(p.id)) {
    // Will be overwritten when real adapters register
  }
});
