/**
 * invoiceBootstrapService — Rules for first invoice import on empty UC.
 * SRP: Determine what UC fields to auto-fill from first invoice extraction.
 * 
 * Policy (from memory: uc-enrichment-policy-v3):
 * - First import (no history): fill all empty cadastral fields
 * - Subsequent imports: fill only empty fields, preserve manual edits
 * - Never overwrite valid existing data
 */

import { ucValidation } from "@/services/ucValidation";

export interface InvoiceExtractionFields {
  cliente_nome?: string | null;
  numero_uc?: string | null;
  numero_cliente?: string | null;
  concessionaria?: string | null;
  tipo_ligacao?: string | null;
  classificacao_grupo?: string | null;
  classificacao_subgrupo?: string | null;
  modalidade_tarifaria?: string | null;
  endereco_rua?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_estado?: string | null;
  endereco_cep?: string | null;
  proxima_leitura?: string | null;
}

export interface UCCurrentFields {
  nome: string;
  codigo_uc: string;
  concessionaria_nome: string | null;
  classificacao_grupo: string | null;
  classificacao_subgrupo: string | null;
  modalidade_tarifaria: string | null;
  endereco: Record<string, any>;
  unit_identifier: string | null;
  proxima_leitura_data: string | null;
  hasInvoiceHistory: boolean;
}

export interface EnrichmentResult {
  fieldsToUpdate: Record<string, any>;
  isFirstImport: boolean;
  enrichedFields: string[];
  skippedFields: string[];
}

export const invoiceBootstrapService = {
  /**
   * Determine which UC fields should be auto-filled from invoice extraction.
   * Returns only the fields that should be updated.
   */
  resolveEnrichment(
    extraction: InvoiceExtractionFields,
    current: UCCurrentFields
  ): EnrichmentResult {
    const fieldsToUpdate: Record<string, any> = {};
    const enrichedFields: string[] = [];
    const skippedFields: string[] = [];
    const isFirstImport = !current.hasInvoiceHistory;

    // Nome — only if current is generic/empty
    if (extraction.cliente_nome) {
      const sanitized = ucValidation.sanitizeExtractedName(extraction.cliente_nome);
      if (sanitized) {
        const currentValid = ucValidation.validateName(current.nome);
        if (!currentValid.valid || isFirstImport) {
          fieldsToUpdate.nome = sanitized;
          enrichedFields.push("nome");
        } else {
          skippedFields.push("nome");
        }
      }
    }

    // Concessionária
    if (extraction.concessionaria && !current.concessionaria_nome) {
      fieldsToUpdate.concessionaria_nome = extraction.concessionaria;
      enrichedFields.push("concessionaria_nome");
    }

    // Classificação
    if (extraction.classificacao_grupo && !current.classificacao_grupo) {
      fieldsToUpdate.classificacao_grupo = extraction.classificacao_grupo;
      enrichedFields.push("classificacao_grupo");
    }

    if (extraction.classificacao_subgrupo && !current.classificacao_subgrupo) {
      fieldsToUpdate.classificacao_subgrupo = extraction.classificacao_subgrupo;
      enrichedFields.push("classificacao_subgrupo");
    }

    if (extraction.modalidade_tarifaria && !current.modalidade_tarifaria) {
      fieldsToUpdate.modalidade_tarifaria = extraction.modalidade_tarifaria;
      enrichedFields.push("modalidade_tarifaria");
    }

    // Unit identifier (número da UC or número do cliente)
    if (!current.unit_identifier) {
      const identifier = extraction.numero_uc || extraction.numero_cliente;
      if (identifier && identifier.trim().length >= 3) {
        fieldsToUpdate.unit_identifier = identifier.trim();
        enrichedFields.push("unit_identifier");
      }
    }

    // Endereço — only fill if current is empty
    const currentEndereco = current.endereco || {};
    const hasAddress = currentEndereco.rua || currentEndereco.cidade || currentEndereco.cep;
    if (!hasAddress && isFirstImport) {
      const newEndereco: Record<string, any> = { ...currentEndereco };
      let addressEnriched = false;
      if (extraction.endereco_rua) { newEndereco.rua = extraction.endereco_rua; addressEnriched = true; }
      if (extraction.endereco_bairro) { newEndereco.bairro = extraction.endereco_bairro; addressEnriched = true; }
      if (extraction.endereco_cidade) { newEndereco.cidade = extraction.endereco_cidade; addressEnriched = true; }
      if (extraction.endereco_estado) { newEndereco.estado = extraction.endereco_estado; addressEnriched = true; }
      if (extraction.endereco_cep) { newEndereco.cep = extraction.endereco_cep; addressEnriched = true; }
      if (addressEnriched) {
        fieldsToUpdate.endereco = newEndereco;
        enrichedFields.push("endereco");
      }
    }

    // Próxima leitura
    if (extraction.proxima_leitura && !current.proxima_leitura_data) {
      fieldsToUpdate.proxima_leitura_data = extraction.proxima_leitura;
      enrichedFields.push("proxima_leitura_data");
    }

    return { fieldsToUpdate, isFirstImport, enrichedFields, skippedFields };
  },

  /**
   * Validate that critical invoice fields are present before persistence.
   * Returns list of missing critical fields.
   */
  validateCriticalFields(extraction: {
    reference_month?: number | null;
    reference_year?: number | null;
    total_amount?: number | null;
  }): { valid: boolean; missingFields: string[] } {
    const missing: string[] = [];

    if (!extraction.reference_month || extraction.reference_month < 1 || extraction.reference_month > 12) {
      missing.push("reference_month");
    }
    if (!extraction.reference_year || extraction.reference_year < 2000 || extraction.reference_year > 2100) {
      missing.push("reference_year");
    }

    return { valid: missing.length === 0, missingFields: missing };
  },
};
