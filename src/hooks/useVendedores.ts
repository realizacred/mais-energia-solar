import { useQuery, useQueryClient } from "@tanstack/react-query";
import { consultantService } from "@/services/admin/consultantService";

const STALE_TIME = 1000 * 60 * 5;

export function useVendedoresList() {
  return useQuery({
    queryKey: ["vendedores-list"],
    queryFn: () => consultantService.fetchAll(),
    staleTime: STALE_TIME,
  });
}

export function useUserProfiles() {
  return useQuery({
    queryKey: ["user-profiles-active"],
    queryFn: () => consultantService.fetchActiveProfiles(),
    staleTime: STALE_TIME,
  });
}

export function useRefreshVendedores() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["vendedores-list"] });
}
