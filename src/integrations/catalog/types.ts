/**
 * Catalog Provider Adapter — Canonical interface for ALL supplier integrations.
 * SSOT: Every catalog provider adapter MUST implement this interface.
 * 
 * Current providers: Edeltec
 * Planned: WEG, Intelbras, Aldo, etc.
 */

// ─── Provider Capabilities ──────────────────────────────────
export interface CatalogProviderCapabilities {
  supportsIncremental: boolean;
  supportsFullReplace: boolean;
  paginationMode: "page" | "cursor" | "offset";
  maxItemsPerPage: number;
  pagesPerBatch: number;
}

// ─── Provider Config (from DB) ──────────────────────────────
export interface CatalogProviderConfig {
  id: string;
  tenant_id: string;
  provider_key: string;
  provider_name: string;
  is_active: boolean;
  priority: number;
  base_url: string;
  credentials: Record<string, unknown>;
  last_test_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Canonical Product Row ──────────────────────────────────
export interface CanonicalCatalogProduct {
  tenant_id: string;
  source: string;
  external_id: string;
  external_code: string | null;
  name: string;
  description: string | null;
  fabricante: string | null;
  marca: string | null;
  tipo: string | null;
  product_kind: string;
  is_generator: boolean;
  estimated_kwp: number | null;
  potencia_inversor: number | null;
  potencia_modulo: number | null;
  fase: string | null;
  tensao: string | null;
  estrutura: string | null;
  fixed_price: number | null;
  preco_consumidor: number | null;
  valor_avulso: number | null;
  preco_por_kwp: number | null;
  disponivel: boolean;
  permite_compra_sem_estoque: boolean;
  is_available_now: boolean;
  previsao: string | null;
  thumbnail_url: string | null;
  imagem_principal_url: string | null;
  external_data: Record<string, unknown>;
}

// ─── Sync State ─────────────────────────────────────────────
export type SyncStatus = "idle" | "running" | "completed" | "error";
export type SyncMode = "incremental" | "full_replace";

// ─── Provider Adapter Interface ─────────────────────────────
export interface CatalogProviderAdapter {
  /** Unique provider key (e.g. 'edeltec', 'weg', 'intelbras') */
  readonly providerKey: string;

  /** Display name for UI */
  readonly displayName: string;

  /** Get provider capabilities */
  getCapabilities(): CatalogProviderCapabilities;

  /** Classify a raw product from the provider API */
  classifyProduct(raw: Record<string, unknown>): {
    is_generator: boolean;
    product_kind: string;
  };

  /** Map raw provider product to canonical catalog row */
  mapToCanonical(
    raw: Record<string, unknown>,
    context: { tenant_id: string }
  ): CanonicalCatalogProduct;

  /** Derive availability from raw product data */
  normalizeAvailability(raw: Record<string, unknown>): {
    disponivel: boolean;
    permite_compra_sem_estoque: boolean;
    is_available_now: boolean;
    previsao: string | null;
  };
}

// ─── Provider Registry ──────────────────────────────────────
export const KNOWN_PROVIDERS: Record<string, { displayName: string; logoKey?: string }> = {
  edeltec: { displayName: "Edeltec", logoKey: "edeltec" },
  weg: { displayName: "WEG", logoKey: "weg" },
  intelbras: { displayName: "Intelbras", logoKey: "intelbras" },
  aldo: { displayName: "Aldo Solar", logoKey: "aldo" },
};
