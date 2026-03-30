/**
 * Edeltec Catalog Provider Adapter
 * Encapsulates all Edeltec-specific logic for product classification,
 * mapping, and availability normalization.
 * 
 * SSOT: All Edeltec-specific business rules live HERE, not in UI components.
 */

import type {
  CatalogProviderAdapter,
  CatalogProviderCapabilities,
  CanonicalCatalogProduct,
} from "../../types";

export class EdeltecAdapter implements CatalogProviderAdapter {
  readonly providerKey = "edeltec" as const;
  readonly displayName = "Edeltec";

  getCapabilities(): CatalogProviderCapabilities {
    return {
      supportsIncremental: true,
      supportsFullReplace: true,
      paginationMode: "page",
      maxItemsPerPage: 50,
      pagesPerBatch: 5,
    };
  }

  classifyProduct(raw: Record<string, unknown>): { is_generator: boolean; product_kind: string } {
    const tipo = (String(raw.tipoDeProduto || "")).toLowerCase();
    const isGen =
      raw.ehGerador === true ||
      tipo.includes("gerador") ||
      tipo.includes("kit") ||
      ((raw.potenciaGerador as number) > 0 && ((raw.potenciaModulo as number) > 0 || (raw.potenciaInversor as number) > 0)) ||
      (Array.isArray(raw.codMateriaPrima) && raw.codMateriaPrima.length > 0);

    return {
      is_generator: isGen,
      product_kind: isGen ? "generator" : "component",
    };
  }

  mapToCanonical(
    raw: Record<string, unknown>,
    context: { tenant_id: string }
  ): CanonicalCatalogProduct {
    const classification = this.classifyProduct(raw);
    const availability = this.normalizeAvailability(raw);

    const potKwp = raw.potenciaGerador as number || null;
    const precoInt = raw.precoDoIntegrador as number || null;

    return {
      tenant_id: context.tenant_id,
      source: this.providerKey,
      external_id: String(raw.id || ""),
      external_code: raw.codProd as string || null,
      name: String(raw.titulo || ""),
      description: raw.descricao as string || null,
      fabricante: raw.fabricante as string || null,
      marca: raw.marca as string || null,
      tipo: raw.tipoDeProduto as string || null,
      product_kind: classification.product_kind,
      is_generator: classification.is_generator,
      estimated_kwp: potKwp,
      potencia_inversor: raw.potenciaInversor as number || null,
      potencia_modulo: raw.potenciaModulo as number || null,
      fase: raw.fase as string || null,
      tensao: raw.tensaoSaida as string || null,
      estrutura: raw.estrutura as string || null,
      fixed_price: precoInt,
      preco_consumidor: raw.precoDoConsumidorFinal as number || null,
      valor_avulso: raw.valorAvulso as number || null,
      preco_por_kwp: (precoInt && potKwp && potKwp > 0) ? Math.round((precoInt / potKwp) * 100) / 100 : null,
      ...availability,
      thumbnail_url: null, // Edeltec uses bucket/key, not direct URL
      imagem_principal_url: null,
      external_data: raw,
    };
  }

  normalizeAvailability(raw: Record<string, unknown>): {
    disponivel: boolean;
    permite_compra_sem_estoque: boolean;
    is_available_now: boolean;
    previsao: string | null;
  } {
    const disponivel = raw.disponivelEmEstoque === true;
    const permiteCompra = raw.permiteCompraSemEstoque === true;
    return {
      disponivel,
      permite_compra_sem_estoque: permiteCompra,
      is_available_now: disponivel || permiteCompra,
      previsao: raw.dataPrevistaParaDisponibilidade as string || null,
    };
  }
}

/** Singleton instance */
export const edeltecAdapter = new EdeltecAdapter();
