/**
 * Hook de enforcement para geração de proposta.
 * Executa o resolver, controla aceite de estimativa e bloqueia PDF se necessário.
 */

import { useState, useMemo, useCallback } from "react";
import {
  resolveProposalVariables,
  type ProposalResolverContext,
  type ResolverResult,
} from "@/lib/resolveProposalVariables";
import { supabase } from "@/integrations/supabase/client";

export interface EnforcementGateResult {
  allowed: boolean;
  reason?: "missing_required" | "estimativa_not_accepted";
  missingVariables?: string[];
}

export interface UseProposalEnforcementReturn {
  /** Resultado completo do resolver (recalculado quando context muda) */
  resolverResult: ResolverResult;
  /** Precisão: exato | estimado | desconhecido */
  precisao: ResolverResult["precisao"];
  /** Se o usuário já aceitou a estimativa */
  aceiteEstimativa: boolean;
  /** Setter para aceite */
  setAceiteEstimativa: (v: boolean) => void;
  /** Verifica se pode gerar PDF — retorna gate result */
  checkGate: () => EnforcementGateResult;
  /** Salva auditoria na proposta (após geração bem-sucedida) */
  persistAudit: (propostaId: string) => Promise<void>;
  /** Loga bloqueio de PDF */
  logBlock: (propostaId: string | null, reason: string, missing: string[]) => Promise<void>;
}

export function useProposalEnforcement(
  context: ProposalResolverContext
): UseProposalEnforcementReturn {
  const [aceiteEstimativa, setAceiteEstimativa] = useState(false);

  const resolverResult = useMemo(
    () => resolveProposalVariables(context),
    [context]
  );

  const precisao = resolverResult.precisao;

  const checkGate = useCallback((): EnforcementGateResult => {
    // 1) Variáveis obrigatórias ausentes
    if (resolverResult.missing_required.length > 0) {
      return {
        allowed: false,
        reason: "missing_required",
        missingVariables: resolverResult.missing_required,
      };
    }
    // 2) Estimativa sem aceite
    if (precisao === "estimado" && !aceiteEstimativa) {
      return {
        allowed: false,
        reason: "estimativa_not_accepted",
      };
    }
    return { allowed: true };
  }, [resolverResult, precisao, aceiteEstimativa]);

  const persistAudit = useCallback(
    async (propostaId: string) => {
      const ctx = context;
      const gd = ctx.gdResult;
      const tariff = ctx.tariffVersion;
      const aneel = ctx.aneelRun;

      const updatePayload: Record<string, unknown> = {
        precisao_calculo: precisao,
        regra_gd: gd?.regra_aplicada || null,
        ano_gd: gd ? 2026 : null,
        fio_b_percent_aplicado: gd?.fio_b_percent_cobrado ?? null,
        origem_tarifa: tariff?.origem ?? gd?.origem_tariff ?? null,
        vigencia_tarifa: tariff?.vigencia_inicio ?? gd?.vigencia_tariff ?? null,
        snapshot_hash: aneel?.snapshot_hash ?? null,
        missing_variables: resolverResult.missing_required.length > 0
          ? resolverResult.missing_required
          : null,
        tariff_version_id: null, // can be enriched if tariff version id is in context
        aneel_run_id: aneel?.run_id ?? null,
      };

      // Aceite estimativa
      if (precisao === "estimado" && aceiteEstimativa) {
        updatePayload.aceite_estimativa = true;
        updatePayload.data_aceite_estimativa = new Date().toISOString();
      }

      await supabase
        .from("propostas_nativas")
        .update(updatePayload)
        .eq("id", propostaId);
    },
    [context, resolverResult, precisao, aceiteEstimativa]
  );

  const logBlock = useCallback(
    async (_propostaId: string | null, reason: string, missing: string[]) => {
      // audit_logs blocks direct INSERTs — log to console instead
      console.warn("[useProposalEnforcement] PDF bloqueado:", {
        reason, missing, precisao,
      });
    },
    [precisao]
  );

  return {
    resolverResult,
    precisao,
    aceiteEstimativa,
    setAceiteEstimativa,
    checkGate,
    persistAudit,
    logBlock,
  };
}
