/**
 * gdTypeRules — Business rules for GD types (GD1, GD2, GD3).
 * SRP: Validation and distribution rules per GD category.
 * 
 * GD1 = Autoconsumo local (geração e consumo no mesmo local/UC)
 * GD2 = Autoconsumo remoto (geração e consumo em UCs diferentes, mesmo titular CPF/CNPJ)
 * GD3 = Compartilhado / Cooperativa (múltiplos titulares, consórcio ou cooperativa)
 */

export type GdCategory = "gd1" | "gd2" | "gd3";

export interface GdTypeRule {
  category: GdCategory;
  label: string;
  description: string;
  allowsMultipleBeneficiaries: boolean;
  requiresSameTitular: boolean;
  maxBeneficiaries: number | null; // null = unlimited
}

const GD_TYPE_RULES: Record<GdCategory, GdTypeRule> = {
  gd1: {
    category: "gd1",
    label: "GD I — Autoconsumo Local",
    description: "Geração e consumo na mesma UC ou no mesmo endereço.",
    allowsMultipleBeneficiaries: false,
    requiresSameTitular: true,
    maxBeneficiaries: 1, // only the generator itself
  },
  gd2: {
    category: "gd2",
    label: "GD II — Autoconsumo Remoto",
    description: "Geração e consumo em UCs diferentes, mesmo titular (CPF/CNPJ).",
    allowsMultipleBeneficiaries: true,
    requiresSameTitular: true,
    maxBeneficiaries: null,
  },
  gd3: {
    category: "gd3",
    label: "GD III — Compartilhado / Cooperativa",
    description: "Múltiplos titulares participam do rateio (consórcio ou cooperativa).",
    allowsMultipleBeneficiaries: true,
    requiresSameTitular: false,
    maxBeneficiaries: null,
  },
};

export const gdTypeRules = {
  /**
   * Get rules for a given GD category.
   */
  getRules(category: GdCategory): GdTypeRule {
    return GD_TYPE_RULES[category];
  },

  /**
   * Get all categories with labels for UI dropdowns.
   */
  getAllCategories(): Array<{ value: GdCategory; label: string; description: string }> {
    return Object.values(GD_TYPE_RULES).map((r) => ({
      value: r.category,
      label: r.label,
      description: r.description,
    }));
  },

  /**
   * Validate if a GD category is valid.
   */
  isValidCategory(category: string | null | undefined): category is GdCategory {
    if (!category) return false;
    return category in GD_TYPE_RULES;
  },

  /**
   * Validate beneficiary count against GD type rules.
   */
  validateBeneficiaryCount(
    category: GdCategory,
    activeBeneficiaryCount: number
  ): { valid: boolean; message: string | null } {
    const rules = GD_TYPE_RULES[category];
    if (rules.maxBeneficiaries !== null && activeBeneficiaryCount > rules.maxBeneficiaries) {
      return {
        valid: false,
        message: `${rules.label} permite no máximo ${rules.maxBeneficiaries} beneficiária(s).`,
      };
    }
    return { valid: true, message: null };
  },

  /**
   * Check if distribution type is compatible with category.
   * GD1: only self-consumption (100% to generator UC).
   * GD2/GD3: percentage-based allocation.
   */
  getDistributionType(category: GdCategory): "self" | "percentage" {
    return category === "gd1" ? "self" : "percentage";
  },

  /**
   * Validate that the titular requirement is met.
   * GD2 requires same CPF/CNPJ across all UCs.
   * GD3 does not.
   */
  requiresSameTitular(category: GdCategory): boolean {
    return GD_TYPE_RULES[category].requiresSameTitular;
  },
};
