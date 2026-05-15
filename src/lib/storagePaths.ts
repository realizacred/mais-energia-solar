import { supabase } from "@/integrations/supabase/client";

/**
 * Normalizes a string into a safe storage slug.
 * Removes accents, emojis, and replaces spaces/special chars with hyphens.
 */
export function toSafeSlug(text: string): string {
  if (!text) return "unnamed";
  
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Remove accents
    .replace(/[^\w\s/.-]/gi, "") // Keep alphanumeric, spaces, slashes, dots, hyphens
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-") // Spaces to hyphens
    .replace(/-+/g, "-"); // Double hyphens
}

/**
 * Build a tenant-scoped storage path with slug normalization.
 */
export function tenantPath(tenantId: string, ...segments: string[]): string {
  const safeSegments = segments.map(s => toSafeSlug(s));
  return [tenantId, ...safeSegments].join("/");
}

/**
 * Resolve current tenant ID.
 */
export async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return profile?.tenant_id || null;
}

/**
 * Build a safe storage path for authenticated uploads.
 */
export async function buildStoragePath(...segments: string[]): Promise<string> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error("Não foi possível determinar o tenant para upload. Faça login novamente.");
  }
  return tenantPath(tenantId, ...segments);
}
