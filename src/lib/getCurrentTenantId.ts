/**
 * Central helper for resolving the current user's tenant_id.
 *
 * CANONICAL SOURCE: profiles.user_id = auth.uid()
 * NEVER use profiles.id — that is the table's own PK.
 *
 * Usage:
 *   const { tenantId, userId } = await getCurrentTenantId();
 */
import { supabase } from "@/integrations/supabase/client";

interface TenantContext {
  tenantId: string;
  userId: string;
}

export async function getCurrentTenantId(): Promise<TenantContext> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error("Usuário não autenticado. Faça login novamente.");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("[getCurrentTenantId] Erro ao buscar perfil:", profileError);
    throw new Error("Erro ao buscar seu perfil. Tente novamente.");
  }

  if (!profile?.tenant_id) {
    throw new Error(
      "Seu usuário não está vinculado a nenhuma empresa (tenant). " +
      "Solicite ao administrador que vincule seu usuário antes de continuar."
    );
  }

  return { tenantId: profile.tenant_id, userId: user.id };
}
