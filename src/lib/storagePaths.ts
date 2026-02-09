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
 * Uses the vendedor code or falls back to the single active tenant.
 */
export async function resolvePublicTenantId(vendedorCode?: string | null): Promise<string | null> {
  // If we have a vendedor code, resolve through the validate function
  if (vendedorCode) {
    const { data } = await supabase.rpc("validate_vendedor_code", { _codigo: vendedorCode });
    if (data && data.length > 0) {
      // vendedores have tenant_id — but the RPC only returns codigo/nome
      // For anon, we need to query vendedores directly
      const { data: vendedor } = await supabase
        .from("vendedores")
        .select("tenant_id")
        .or(`codigo.eq.${vendedorCode},slug.eq.${vendedorCode}`)
        .eq("ativo", true)
        .maybeSingle();
      if (vendedor?.tenant_id) return vendedor.tenant_id;
    }
  }

  // Fallback: single-tenant mode — get the only active tenant
  const { data: tenants } = await supabase
    .from("tenants")
    .select("id")
    .eq("ativo", true)
    .limit(2);

  if (tenants && tenants.length === 1) {
    return tenants[0].id;
  }

  return null;
}
