/**
 * extractionOrchestrator — Resolves extraction config for a given concessionária.
 * Used by process-fatura-pdf to decide strategy (native/provider/auto).
 * This is the frontend-side config resolver; actual execution happens in Edge Functions.
 */
import { supabase } from "@/integrations/supabase/client";
import type { ExtractionConfig, ExtractionStrategyMode } from "@/hooks/useExtractionConfigs";

export interface ResolvedExtractionStrategy {
  config: ExtractionConfig | null;
  strategy: ExtractionStrategyMode;
  providerName: string | null;
  providerEndpointKey: string | null;
  requiresBase64: boolean;
  requiresPassword: boolean;
  fallbackEnabled: boolean;
  requiredFields: string[];
}

/**
 * Resolve the extraction config for a concessionária code.
 * Priority: tenant-specific > global (tenant_id IS NULL).
 */
export async function resolveExtractionConfig(
  concessionariaCode: string,
): Promise<ResolvedExtractionStrategy> {
  const normalizedCode = concessionariaCode.toLowerCase().trim();

  // Try tenant-specific first, then global
  const { data: configs } = await supabase
    .from("invoice_extraction_configs")
    .select("*")
    .eq("concessionaria_code", normalizedCode)
    .eq("active", true)
    .order("tenant_id", { ascending: false, nullsFirst: false }); // tenant-specific first

  const config = ((configs || []) as unknown as ExtractionConfig[])[0] || null;

  if (!config) {
    return {
      config: null,
      strategy: "native",
      providerName: null,
      providerEndpointKey: null,
      requiresBase64: false,
      requiresPassword: false,
      fallbackEnabled: false,
      requiredFields: ["consumo_kwh", "valor_total"],
    };
  }

  return {
    config,
    strategy: config.strategy_mode,
    providerName: config.provider_name,
    providerEndpointKey: config.provider_endpoint_key,
    requiresBase64: config.provider_requires_base64,
    requiresPassword: config.provider_requires_password,
    fallbackEnabled: config.fallback_enabled,
    requiredFields: config.required_fields || [],
  };
}

/**
 * Detect concessionária code from extracted text (simple heuristic).
 */
export function detectConcessionariaFromText(text: string): string | null {
  const upper = text.toUpperCase();

  if (upper.includes("ENERGISA")) return "energisa";
  if (upper.includes("LIGHT S") || upper.includes("LIGHT -")) return "light";
  if (upper.includes("ENEL") || upper.includes("ELETROPAULO")) return "enel";
  if (upper.includes("CEMIG")) return "cemig";
  if (upper.includes("CPFL")) return "cpfl";
  if (upper.includes("CELESC")) return "celesc";
  if (upper.includes("COPEL")) return "copel";
  if (upper.includes("EQUATORIAL")) return "equatorial";
  if (upper.includes("NEOENERGIA") || upper.includes("COELBA") || upper.includes("CELPE") || upper.includes("COSERN")) return "neoenergia";

  return null;
}
