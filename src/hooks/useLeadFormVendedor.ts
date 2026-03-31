/**
 * useLeadFormVendedor — Resolves vendedor (consultant) from URL code or logged-in user.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 * Replaces direct supabase.from("consultores") calls in LeadFormWizard.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 15; // 15 min — dados de apoio

interface VendedorResolved {
  id: string | null;
  nome: string | null;
  codigo: string | null;
}

/**
 * Resolves vendedor from a public vendor code (URL param).
 * Uses RPCs (validate_consultor_code + resolve_consultor_public) for anon safety.
 */
export function useVendedorFromCode(codigo: string | undefined) {
  return useQuery<VendedorResolved | null>({
    queryKey: ["vendedor-from-code", codigo],
    enabled: !!codigo,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("validate_consultor_code", {
        _codigo: codigo!,
      });

      if (error) {
        console.error("[useVendedorFromCode] Erro ao validar vendedor:", error.message);
        return null;
      }

      const results = Array.isArray(data) ? data : data ? [data] : [];
      const result = results[0];
      if (!result?.valid || !result?.nome) return null;

      // Resolve ID via secure RPC
      const { data: consultorRecord } = await supabase
        .rpc("resolve_consultor_public", { _codigo: codigo! })
        .maybeSingle();

      return {
        id: (consultorRecord as any)?.id ?? null,
        nome: result.nome,
        codigo: codigo!,
      };
    },
  });
}

/**
 * Resolves vendedor from the currently logged-in user (auto-attribution).
 * Only runs when there's no vendor code AND user is authenticated.
 */
export function useVendedorFromUser(userId: string | undefined, hasCode: boolean) {
  return useQuery<VendedorResolved | null>({
    queryKey: ["vendedor-from-user", userId],
    enabled: !!userId && !hasCode,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("consultores")
        .select("id, nome, codigo")
        .eq("user_id", userId!)
        .eq("ativo", true)
        .maybeSingle();

      if (error) {
        console.error("[useVendedorFromUser] Erro ao resolver vendedor logado:", error.message);
        return null;
      }

      if (!data) return null;

      return {
        id: data.id,
        nome: data.nome,
        codigo: data.codigo,
      };
    },
  });
}

/**
 * Resolves the vendedor ID for the current user (used in WA message flow).
 * Only fetches when userId exists and no vendedorId is already known.
 */
export function useResolveVendedorId(userId: string | undefined, alreadyResolved: boolean) {
  return useQuery<string | null>({
    queryKey: ["resolve-vendedor-id", userId],
    enabled: !!userId && !alreadyResolved,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id")
        .eq("user_id", userId!)
        .eq("ativo", true)
        .maybeSingle();

      return (data as any)?.id ?? null;
    },
  });
}
