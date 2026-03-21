/**
 * gdService — Service for GD Groups & Beneficiaries validation logic.
 * SRP: Business rules for Geração Distribuída.
 */

export interface GdGroupInput {
  nome: string;
  concessionaria_id: string;
  uc_geradora_id: string;
  cliente_id?: string | null;
  notes?: string | null;
  status?: string;
}

export interface GdBeneficiaryInput {
  gd_group_id: string;
  uc_beneficiaria_id: string;
  allocation_percent: number;
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export const gdService = {
  /**
   * Validate that active beneficiary percentages sum to 100%.
   * Returns { valid, totalPercent }.
   */
  validateAllocationSum(
    beneficiaries: Array<{ allocation_percent: number; is_active: boolean }>
  ): { valid: boolean; totalPercent: number } {
    const total = beneficiaries
      .filter((b) => b.is_active)
      .reduce((sum, b) => sum + Number(b.allocation_percent), 0);
    const rounded = Math.round(total * 100) / 100;
    return { valid: Math.abs(rounded - 100) < 0.01, totalPercent: rounded };
  },

  /**
   * Check for duplicate UC in a group's active beneficiaries.
   */
  hasDuplicateUC(
    existingBeneficiaries: Array<{ uc_beneficiaria_id: string; is_active: boolean; id?: string }>,
    newUcId: string,
    excludeId?: string
  ): boolean {
    return existingBeneficiaries.some(
      (b) => b.uc_beneficiaria_id === newUcId && b.is_active && b.id !== excludeId
    );
  },

  /**
   * Validate that allocation_percent > 0.
   */
  isValidPercent(percent: number): boolean {
    return percent > 0 && percent <= 100;
  },

  /**
   * Validate concessionária compatibility between group and UC.
   */
  isConcessionariaCompatible(
    groupConcessionariaId: string,
    ucConcessionariaId: string | null
  ): boolean {
    if (!ucConcessionariaId) return true; // UC without concessionária is allowed
    return groupConcessionariaId === ucConcessionariaId;
  },
};
