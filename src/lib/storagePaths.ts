import { supabase } from "@/integrations/supabase/client";

/**
 * Build a tenant-scoped storage path.
 *
 * Pattern: {tenantId}/{...rest}
 *
 * The first path segment MUST be the tenant_id so that storage RLS
 * policies can enforce tenant isolation via `(storage.foldername(name))[1]`.
 */
export function tenantPath(tenantId: string, ...segments: string[]): string {
  return [tenantId, ...segments].join("/");
}

/**
 * Resolve the current user's tenant_id from their profile.
 * Returns null if the user is not authenticated or has no tenant.
 */
let cachedTenantId: string | null = null;
let cachedUserId: string | null = null;

export async function getCurrentTenantId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Use cache if same user
  if (cachedUserId === user.id && cachedTenantId) {
    return cachedTenantId;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  cachedUserId = user.id;
  cachedTenantId = profile?.tenant_id || null;
  return cachedTenantId;
}

/**
 * Clear the cached tenant (call on auth state change).
 */
export function clearTenantCache() {
  cachedTenantId = null;
  cachedUserId = null;
}

/**
 * Build a storage path for authenticated uploads.
 * Automatically prepends the user's tenant_id.
 *
 * @example
 *   await buildStoragePath("contas-luz", `uploads/${Date.now()}.jpg`)
 *   // => "00000000-0000-0000-0000-000000000001/uploads/1234567890.jpg"
 */
export async function buildStoragePath(...segments: string[]): Promise<string> {
  const tenantId = await getCurrentTenantId();
  if (!tenantId) {
    throw new Error("Não foi possível determinar o tenant para upload. Faça login novamente.");
  }
  return tenantPath(tenantId, ...segments);
}

/**
 * Resolve tenant_id for anonymous uploads (public forms).
 * Resolves tenant_id from consultor code. NO FALLBACK — code is required.
 */
export async function resolvePublicTenantId(consultorCode?: string | null): Promise<string | null> {
  if (!consultorCode) {
    console.warn("[resolvePublicTenantId] No consultor code provided. Cannot resolve tenant.");
    return null;
  }

  // Resolve via secure RPC
  const { data: consultor } = await supabase
    .rpc("resolve_consultor_public", { _codigo: consultorCode })
    .maybeSingle();
  
  if ((consultor as any)?.tenant_id) return (consultor as any).tenant_id;

  return null;
}
