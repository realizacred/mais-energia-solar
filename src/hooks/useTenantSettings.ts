import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TenantConfig = {
  crm?: {
    block_duplicate_clients?: boolean;
    required_fields?: string[];
  };
  branding?: {
    ai_name?: string;
    ai_emoji?: string;
    wa_name?: string;
    wa_emoji?: string;
  };
};

export type TenantData = {
  id: string;
  nome: string;
  slug: string;
  documento: string | null;
  inscricao_estadual: string | null;
  estado: string | null;
  cidade: string | null;
  tenant_config: TenantConfig;
};

async function fetchTenantSettings(): Promise<TenantData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profileError || !profile?.tenant_id) {
    console.error("[useTenantSettings] Error loading profile:", profileError);
    throw new Error("Não foi possível identificar a empresa");
  }

  const { data, error } = await supabase
    .from("tenants")
    .select("id, nome, slug, documento, inscricao_estadual, estado, cidade, tenant_config")
    .eq("id", profile.tenant_id)
    .single();

  if (error) {
    console.error("[useTenantSettings] Error loading tenant:", error);
    throw new Error(error.message);
  }

  return {
    ...data,
    tenant_config: (data.tenant_config as TenantConfig) || {},
  };
}

export function useTenantSettings() {
  const query = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
    staleTime: 1000 * 60 * 5,
  });

  return {
    tenant: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
