/**
 * useEnergyFinancial — Hooks for energy financial views.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import {
  getEnergyFinancialOverview,
  getGdFinancialSummary,
  getClienteFinancialSummary,
  getEnergyFinancialRanking,
  getEnergyFinancialHistory,
} from "@/services/energia/energyFinancialService";

const STALE_TIME = 1000 * 60 * 5;

export function useEnergyFinancialOverview() {
  return useQuery({
    queryKey: ["energy_financial_overview"],
    queryFn: getEnergyFinancialOverview,
    staleTime: STALE_TIME,
  });
}

export function useGdFinancialSummary(gdGroupId: string | null, months = 12) {
  return useQuery({
    queryKey: ["gd_financial_summary", gdGroupId, months],
    queryFn: () => getGdFinancialSummary(gdGroupId!, months),
    staleTime: STALE_TIME,
    enabled: !!gdGroupId,
  });
}

export function useClienteFinancialSummary(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_financial_summary", clienteId],
    queryFn: () => getClienteFinancialSummary(clienteId!),
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

export function useEnergyFinancialRanking(limit = 10) {
  return useQuery({
    queryKey: ["energy_financial_ranking", limit],
    queryFn: () => getEnergyFinancialRanking(limit),
    staleTime: STALE_TIME,
  });
}

export function useEnergyFinancialHistory(months = 12) {
  return useQuery({
    queryKey: ["energy_financial_history", months],
    queryFn: () => getEnergyFinancialHistory(months),
    staleTime: STALE_TIME,
  });
}
