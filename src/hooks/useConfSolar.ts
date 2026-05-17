import { useQuery, useQueryClient } from "@tanstack/react-query";
import { solarConfigService } from "@/services/solar/solarConfigService";

const STALE_CONFIG = 1000 * 60 * 15;

// ── Pricing Config ───────────────────────────────────────────
export function usePricingConfig() {
  return useQuery({
    queryKey: ["pricing-config"],
    queryFn: () => solarConfigService.fetchPricingConfig(),
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPricingConfig() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["pricing-config"] });
}

// ── Premissas Tecnicas ───────────────────────────────────────
/**
 * @deprecated Migrado para `tenant_premises` (SSOT). Mantido por compat
 * de assinatura. Lê de `tenant_premises` e mapeia para o shape antigo.
 */
export function usePremissasTecnicas() {
  return useQuery({
    queryKey: ["premissas-tecnicas"],
    queryFn: () => solarConfigService.fetchPremissasTecnicas(),
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPremissasTecnicas() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["premissas-tecnicas"] });
    qc.invalidateQueries({ queryKey: ["tenant-premises"] });
    qc.invalidateQueries({ queryKey: ["solar-premises"] });
  };
}

// ── Proposta Templates ───────────────────────────────────────
export function usePropostaTemplates() {
  return useQuery({
    queryKey: ["proposta-templates-config"],
    queryFn: () => solarConfigService.fetchPropostaTemplates(),
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPropostaTemplates() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["proposta-templates-config"] });
}

// ── Variáveis Custom ─────────────────────────────────────────
export function usePropostaVariaveisCustom() {
  return useQuery({
    queryKey: ["proposta-variaveis-custom"],
    queryFn: () => solarConfigService.fetchPropostaVariaveisCustom(),
    staleTime: STALE_CONFIG,
  });
}

export function useRefreshPropostaVariaveis() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["proposta-variaveis-custom"] });
}
