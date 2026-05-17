/**
 * useLeadFormVendedor — Resolves vendedor (consultant) from URL code or logged-in user.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { consultantService, type VendedorResolved } from "@/services/admin/consultantService";

const STALE_TIME = 1000 * 60 * 15; // 15 min — dados de apoio

export type { VendedorResolved };

/**
 * Resolves vendedor from a public vendor code (URL param).
 */
export function useVendedorFromCode(codigo: string | undefined) {
  return useQuery<VendedorResolved | null>({
    queryKey: ["vendedor-from-code", codigo],
    enabled: !!codigo,
    staleTime: STALE_TIME,
    queryFn: () => consultantService.resolveFromCode(codigo!),
  });
}

/**
 * Resolves vendedor from the currently logged-in user (auto-attribution).
 */
export function useVendedorFromUser(userId: string | undefined, hasCode: boolean) {
  return useQuery<VendedorResolved | null>({
    queryKey: ["vendedor-from-user", userId],
    enabled: !!userId && !hasCode,
    staleTime: STALE_TIME,
    queryFn: () => consultantService.resolveFromUser(userId!),
  });
}

/**
 * Resolves the vendedor ID for the current user.
 */
export function useResolveVendedorId(userId: string | undefined, alreadyResolved: boolean) {
  return useQuery<string | null>({
    queryKey: ["resolve-vendedor-id", userId],
    enabled: !!userId && !alreadyResolved,
    staleTime: STALE_TIME,
    queryFn: () => consultantService.resolveIdOnly(userId!),
  });
}
