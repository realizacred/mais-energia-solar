// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "commission-resolution" as const;

export type CommissionResolutionSource =
  | "consultor"
  | "assigned_plan"
  | "pricing_config"
  | "none";

export interface CommissionResolutionResult {
  leadId: string;
  tenantId: string | null;
  consultorId: string | null;
  consultorNome: string;
  consultorUserId: string | null;
  percentual: number;
  source: CommissionResolutionSource;
  sourceLabel: string;
  sourceRecordId: string | null;
  sourceRecordName: string | null;
  fallbackReason: string | null;
}

function extractPlanPercent(parameters: unknown): number {
  if (!parameters || typeof parameters !== "object") return 0;
  const raw = (parameters as Record<string, unknown>).percentual ?? (parameters as Record<string, unknown>).rate;
  return Number(raw) || 0;
}

export function useCommissionResolution(leadId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, leadId],
    queryFn: async (): Promise<CommissionResolutionResult | null> => {
      if (!leadId) return null;

      const { tenantId: sessionTenantId } = await getCurrentTenantId();

      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, consultor_id, tenant_id")
        .eq("id", leadId)
        .maybeSingle();

      if (leadError) throw leadError;

      const effectiveTenantId = (lead as any)?.tenant_id ?? sessionTenantId;
      const consultorId = (lead as any)?.consultor_id ?? null;

      if (!consultorId) {
        const result: CommissionResolutionResult = {
          leadId,
          tenantId: effectiveTenantId,
          consultorId: null,
          consultorNome: "",
          consultorUserId: null,
          percentual: 0,
          source: "none",
          sourceLabel: "Sem origem",
          sourceRecordId: null,
          sourceRecordName: null,
          fallbackReason: "lead_sem_consultor",
        };
        console.debug("[useCommissionResolution] resolved", result);
        return result;
      }

      const { data: consultor, error: consultorError } = await supabase
        .from("consultores")
        .select("id, nome, user_id, percentual_comissao, tenant_id")
        .eq("id", consultorId)
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      if (consultorError) throw consultorError;

      const consultorNome = (consultor as any)?.nome ?? "";
      const consultorUserId = (consultor as any)?.user_id ?? null;
      const consultorPercentual = Number((consultor as any)?.percentual_comissao) || 0;

      if (consultorPercentual > 0) {
        const result: CommissionResolutionResult = {
          leadId,
          tenantId: effectiveTenantId,
          consultorId,
          consultorNome,
          consultorUserId,
          percentual: consultorPercentual,
          source: "consultor",
          sourceLabel: "Consultor",
          sourceRecordId: consultorId,
          sourceRecordName: consultorNome,
          fallbackReason: null,
        };
        console.debug("[useCommissionResolution] resolved", result);
        return result;
      }

      if (consultorUserId) {
        const { data: assignment, error: assignmentError } = await supabase
          .from("user_pricing_assignments")
          .select("commission_plan_id")
          .eq("tenant_id", effectiveTenantId)
          .eq("user_id", consultorUserId)
          .maybeSingle();

        if (assignmentError) throw assignmentError;

        const commissionPlanId = (assignment as any)?.commission_plan_id ?? null;
        if (commissionPlanId) {
          const { data: plan, error: planError } = await supabase
            .from("commission_plans")
            .select("id, name, parameters, is_active")
            .eq("id", commissionPlanId)
            .eq("tenant_id", effectiveTenantId)
            .eq("is_active", true)
            .maybeSingle();

          if (planError) throw planError;

          const planPercentual = extractPlanPercent((plan as any)?.parameters);
          if (planPercentual > 0) {
            const result: CommissionResolutionResult = {
              leadId,
              tenantId: effectiveTenantId,
              consultorId,
              consultorNome,
              consultorUserId,
              percentual: planPercentual,
              source: "assigned_plan",
              sourceLabel: "Plano atribuído",
              sourceRecordId: (plan as any)?.id ?? commissionPlanId,
              sourceRecordName: (plan as any)?.name ?? null,
              fallbackReason: null,
            };
            console.debug("[useCommissionResolution] resolved", result);
            return result;
          }
        }
      }

      const { data: pricingConfig, error: pricingError } = await supabase
        .from("pricing_config")
        .select("id, comissao_padrao_percent")
        .eq("tenant_id", effectiveTenantId)
        .maybeSingle();

      if (pricingError) throw pricingError;

      const tenantPercentual = Number((pricingConfig as any)?.comissao_padrao_percent) || 0;
      if (tenantPercentual > 0) {
        const result: CommissionResolutionResult = {
          leadId,
          tenantId: effectiveTenantId,
          consultorId,
          consultorNome,
          consultorUserId,
          percentual: tenantPercentual,
          source: "pricing_config",
          sourceLabel: "Padrão do tenant",
          sourceRecordId: (pricingConfig as any)?.id ?? null,
          sourceRecordName: null,
          fallbackReason: "consultor_sem_percentual_e_sem_plano",
        };
        console.debug("[useCommissionResolution] resolved", result);
        return result;
      }

      const result: CommissionResolutionResult = {
        leadId,
        tenantId: effectiveTenantId,
        consultorId,
        consultorNome,
        consultorUserId,
        percentual: 0,
        source: "none",
        sourceLabel: "Sem origem",
        sourceRecordId: null,
        sourceRecordName: null,
        fallbackReason: "sem_percentual_configurado",
      };
      console.debug("[useCommissionResolution] resolved", result);
      return result;
    },
    staleTime: STALE_TIME,
    enabled: !!leadId,
  });
}
