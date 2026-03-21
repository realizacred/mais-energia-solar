/**
 * featureAccessService — SSOT for resolving feature access.
 * Combines: role + plan + tenant overrides.
 * §17: Business logic in services, not components.
 */

export interface FeatureAccessResult {
  hasAccess: boolean;
  source: "role" | "plan" | "override" | "none";
  planCode: string | null;
  reason: string | null;
}

const ADMIN_ROLES = ["admin", "gerente", "financeiro"];

interface ResolveParams {
  featureKey: string;
  userRoles: string[];
  planCode: string | null;
  planFeatures: Record<string, boolean>;
  tenantOverrides: Record<string, boolean>; // feature_key → enabled
}

/**
 * Central resolution function — the single source of truth for feature access.
 * Priority:
 * 1. Admin role → always allowed
 * 2. Tenant override → explicit enable/disable per feature
 * 3. Plan features → plan-level enable/disable
 * 4. Default → denied
 */
export function resolveFeatureAccess({
  featureKey,
  userRoles,
  planCode,
  planFeatures,
  tenantOverrides,
}: ResolveParams): FeatureAccessResult {
  // 1. Admin/gerente bypass
  const isAdmin = userRoles.some((r) => ADMIN_ROLES.includes(r));
  if (isAdmin) {
    return {
      hasAccess: true,
      source: "role",
      planCode,
      reason: "Acesso administrativo",
    };
  }

  // 2. Tenant override takes precedence over plan
  if (featureKey in tenantOverrides) {
    const enabled = tenantOverrides[featureKey];
    return {
      hasAccess: enabled,
      source: "override",
      planCode,
      reason: enabled ? "Habilitado por override do tenant" : "Desabilitado por override do tenant",
    };
  }

  // 3. Plan-level feature check
  if (featureKey in planFeatures) {
    const enabled = planFeatures[featureKey];
    return {
      hasAccess: enabled,
      source: "plan",
      planCode,
      reason: enabled
        ? `Incluído no plano ${planCode ?? "atual"}`
        : `Não incluído no plano ${planCode ?? "atual"}`,
    };
  }

  // 4. Feature not found in plan at all → denied
  return {
    hasAccess: false,
    source: "none",
    planCode,
    reason: "Feature não configurada no plano",
  };
}
