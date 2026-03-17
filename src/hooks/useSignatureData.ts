import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { SignatureSettings, Signer } from "@/components/admin/documentos/types";

export function useSignatureSettings() {
  return useQuery({
    queryKey: ["signature_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_settings")
        .select("tenant_id, enabled, provider, sandbox_mode, api_token_encrypted, webhook_secret_encrypted, updated_by")
        .maybeSingle();
      if (error) throw error;
      return data as unknown as SignatureSettings | null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useSigners() {
  return useQuery({
    queryKey: ["signers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signers")
        .select("id, tenant_id, full_name, email, auth_method, cpf, birth_date, phone, options")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as unknown as Signer[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
