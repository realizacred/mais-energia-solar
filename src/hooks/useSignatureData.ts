/**
 * Hooks para dados de assinatura eletrônica.
 * §16: Queries/mutations só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import type { SignatureSettings, Signer } from "@/components/admin/documentos/types";

const STALE_TIME = 1000 * 60 * 5;

// ─── Queries ───────────────────────────────────────

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
    staleTime: STALE_TIME,
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
    staleTime: STALE_TIME,
  });
}

// ─── Mutations ─────────────────────────────────────

export function useSaveSignatureSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      settings,
      enabled,
      provider,
      sandbox,
      apiToken,
      webhookSecret,
    }: {
      settings: SignatureSettings | null;
      enabled: boolean;
      provider: string;
      sandbox: boolean;
      apiToken: string;
      webhookSecret: string;
    }) => {
      const { tenantId, userId } = await getCurrentTenantId();

      const payload: Record<string, unknown> = {
        tenant_id: tenantId,
        enabled,
        provider,
        sandbox_mode: sandbox,
        updated_by: userId,
      };

      if (apiToken.trim()) {
        payload.api_token_encrypted = apiToken.trim();
      }
      if (webhookSecret.trim()) {
        payload.webhook_secret_encrypted = webhookSecret.trim();
      }

      if (settings) {
        const { error } = await supabase.from("signature_settings").update(payload).eq("tenant_id", tenantId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("signature_settings").insert({
          ...payload,
          api_token_encrypted: apiToken.trim() || null,
          webhook_secret_encrypted: webhookSecret.trim() || null,
          created_by: userId,
        } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signature_settings"] });
    },
  });
}

export function useDeleteSigner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("signers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signers"] });
    },
  });
}

export function useSaveSigner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      signerId,
      payload,
    }: {
      signerId?: string;
      payload: Record<string, unknown>;
    }) => {
      const { tenantId, userId } = await getCurrentTenantId();

      const fullPayload = { ...payload, tenant_id: tenantId, updated_by: userId };

      if (signerId) {
        const { error } = await supabase.from("signers").update(fullPayload).eq("id", signerId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("signers").insert({ ...fullPayload, created_by: userId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["signers"] });
    },
  });
}
