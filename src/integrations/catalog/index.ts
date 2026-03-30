/**
 * Catalog Integration — Barrel export.
 * Import provider adapters and types from here.
 */

export type {
  CatalogProviderAdapter,
  CatalogProviderCapabilities,
  CatalogProviderConfig,
  CanonicalCatalogProduct,
  SyncStatus,
  SyncMode,
} from "./types";

export { KNOWN_PROVIDERS } from "./types";

export { edeltecAdapter } from "./providers/edeltec/adapter";
