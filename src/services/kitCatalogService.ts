/**
 * kitCatalogService.ts
 * 
 * Service dedicado para integração do Catálogo de Kits Solares com o Wizard de Propostas.
 * Responsabilidades: fetch de kits ativos, fetch de itens, snapshot/mapeamento para KitItemRow[].
 * 
 * SSOT: O kit na proposta é persistido como snapshot JSONB (proposta_versoes.snapshot → itens[]).
 * As tabelas proposta_kits / proposta_kit_itens são legado e NÃO são populadas pelo fluxo atual.
 * 
 * SRP: nenhuma lógica de UI aqui. Apenas data-fetching e mapeamento.
 */

import { supabase } from "@/integrations/supabase/client";
import type { KitItemRow } from "@/components/admin/propostas-nativas/wizard/types";

// ─── Types ─────────────────────────────────────────────────

export interface CatalogKit {
  id: string;
  name: string;
  description: string | null;
  estimated_kwp: number | null;
  pricing_mode: string;
  fixed_price: number | null;
  source: string | null;
  external_data: Record<string, any> | null;
  is_generator?: boolean;
  fabricante?: string | null;
  fase?: string | null;
  tensao?: string | null;
  estrutura?: string | null;
  disponivel?: boolean;
  permite_compra_sem_estoque?: boolean;
  preco_por_kwp?: number | null;
  is_available_now?: boolean;
  product_kind?: string | null;
  thumbnail_url?: string | null;
  potencia_inversor?: number | null;
  potencia_modulo?: number | null;
  previsao?: string | null;
}

interface CatalogKitItem {
  id: string;
  kit_id: string;
  item_type: string;
  ref_id: string | null;
  description: string;
  quantity: number;
  unit: string | null;
  notes: string | null;
  unit_price: number;
  created_at: string;
}

interface ModuloRef {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number;
}

interface InversorRef {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_kw: number;
}

interface BateriaRef {
  id: string;
  fabricante: string;
  modelo: string;
  energia_kwh: number | null;
}

// ─── Categoria mapping ────────────────────────────────────

import type { KitCategoria } from "@/components/admin/propostas-nativas/wizard/types";

const ITEM_TYPE_TO_CATEGORIA: Record<string, KitCategoria> = {
  modulo: "modulo",
  inversor: "inversor",
  bateria: "bateria",
  generico: "outros",
  estrutura: "estrutura",
  string_box: "string_box",
  cabos: "cabos",
  conectores: "conectores",
  mao_obra: "mao_obra",
};

function mapCategoria(itemType: string): KitCategoria {
  return ITEM_TYPE_TO_CATEGORIA[itemType] ?? "outros";
}

// ─── Public API ───────────────────────────────────────────

export interface CatalogKitSummary {
  moduloDescricao: string;
  moduloQtd: number;
  moduloPotenciaKwp: number;
  inversorDescricao: string;
  inversorQtd: number;
  inversorPotenciaKw: number;
  totalItens: number;
  custoTotal: number;
}

/**
 * Lista kits ativos do tenant (RLS filtra automaticamente).
 */
export async function fetchActiveKits(onlyGenerators = false): Promise<CatalogKit[]> {
  let query = supabase
    .from("solar_kit_catalog")
    .select("id, name, description, estimated_kwp, pricing_mode, fixed_price, source, external_data, is_generator, fabricante, fase, tensao, estrutura, disponivel, permite_compra_sem_estoque, preco_por_kwp, is_available_now, product_kind, thumbnail_url, potencia_inversor, potencia_modulo, previsao")
    .eq("status", "active")
    .order("name");

  if (onlyGenerators) {
    query = query.eq("is_generator", true);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Erro ao buscar kits: ${error.message}`);
  return (data ?? []) as unknown as CatalogKit[];
}

/**
 * Fetch summary info (module/inverter descriptions, quantities) for a set of catalog kits.
 */
export async function fetchKitsSummary(kitIds: string[]): Promise<Map<string, CatalogKitSummary>> {
  if (kitIds.length === 0) return new Map();

  const { data: items, error } = await supabase
    .from("solar_kit_catalog_items")
    .select("kit_id, item_type, ref_id, description, quantity, unit_price")
    .in("kit_id", kitIds);

  if (error) {
    console.error("[fetchKitsSummary] Error fetching items:", error?.message);
    // Don't return empty — integrated kits may not have items, that's OK
  }

  const safeItems = items ?? [];

  // Collect ref_ids for lookups
  const moduloRefIds = safeItems.filter(i => i.item_type === "modulo" && i.ref_id).map(i => i.ref_id!);
  const inversorRefIds = safeItems.filter(i => i.item_type === "inversor" && i.ref_id).map(i => i.ref_id!);

  const [modulos, inversores] = await Promise.all([
    moduloRefIds.length > 0 ? lookupModulos(moduloRefIds) : Promise.resolve(new Map<string, ModuloRef>()),
    inversorRefIds.length > 0 ? lookupInversores(inversorRefIds) : Promise.resolve(new Map<string, InversorRef>()),
  ]);

  const result = new Map<string, CatalogKitSummary>();

  for (const kitId of kitIds) {
    const kitItems = safeItems.filter(i => i.kit_id === kitId);
    const modItems = kitItems.filter(i => i.item_type === "modulo");
    const invItems = kitItems.filter(i => i.item_type === "inversor");

    // Module summary: prefer ref lookup, fallback to description
    let moduloDescricao = "—";
    let moduloPotWp = 0;
    let moduloQtd = 0;
    for (const modItem of modItems) {
      moduloQtd += modItem.quantity || 0;
      if (modItem.ref_id) {
        const ref = modulos.get(modItem.ref_id);
        if (ref) {
          moduloDescricao = `${ref.fabricante} ${ref.modelo} ${ref.potencia_wp}W`;
          moduloPotWp = ref.potencia_wp;
        }
      } else if (modItem.description) {
        moduloDescricao = modItem.description;
        // Extract W from description like "Fabricante 640W"
        const wMatch = modItem.description.match(/(\d+)\s*W/i);
        if (wMatch) moduloPotWp = parseInt(wMatch[1], 10);
      }
    }

    // Inverter summary: prefer ref lookup, fallback to description
    let inversorDescricao = "—";
    let inversorPotKw = 0;
    let inversorQtd = 0;
    for (const invItem of invItems) {
      inversorQtd += invItem.quantity || 0;
      if (invItem.ref_id) {
        const ref = inversores.get(invItem.ref_id);
        if (ref) {
          inversorDescricao = `${ref.fabricante} ${ref.modelo}`;
          inversorPotKw = ref.potencia_nominal_kw;
        }
      } else if (invItem.description) {
        inversorDescricao = invItem.description;
        // Extract kW from description like "Inversor 6kW"
        const kwMatch = invItem.description.match(/(\d+(?:[.,]\d+)?)\s*kW/i);
        if (kwMatch) inversorPotKw = parseFloat(kwMatch[1].replace(",", "."));
      }
    }

    const custoTotal = kitItems.reduce((s, i) => s + (i.quantity || 0) * (i.unit_price || 0), 0);

    result.set(kitId, {
      moduloDescricao,
      moduloQtd,
      moduloPotenciaKwp: (moduloQtd * moduloPotWp) / 1000,
      inversorDescricao,
      inversorQtd,
      inversorPotenciaKw: inversorPotKw * (inversorQtd || 1),
      totalItens: kitItems.length,
      custoTotal,
    });
  }

  return result;
}

/**
 * Retorna itens de um kit do catálogo.
 */
export async function fetchKitItems(kitId: string): Promise<CatalogKitItem[]> {
  const { data, error } = await supabase
    .from("solar_kit_catalog_items")
    .select("id, kit_id, item_type, ref_id, description, quantity, unit, notes, unit_price, created_at")
    .eq("kit_id", kitId)
    .order("created_at");

  if (error) throw new Error(`Erro ao buscar itens do kit: ${error.message}`);
  return data ?? [];
}

/**
 * Gera snapshot de KitItemRow[] a partir de um kit do catálogo.
 * Enriquece com fabricante/modelo/potencia_w via lookup nas tabelas de referência.
 * Retorna dados prontos para o Wizard (mesmo formato que as outras tabs).
 */
export async function snapshotCatalogKitToKitItemRows(kitId: string): Promise<KitItemRow[]> {
  const items = await fetchKitItems(kitId);

  // If no legacy items exist, check if this is a valid integrated kit
  // and generate synthetic rows from canonical catalog data
  if (items.length === 0) {
    return buildSyntheticRowsFromCatalog(kitId);
  }

  // Separate ref_ids by type for batch lookups
  const moduloRefIds = items.filter(i => i.item_type === "modulo" && i.ref_id).map(i => i.ref_id!);
  const inversorRefIds = items.filter(i => i.item_type === "inversor" && i.ref_id).map(i => i.ref_id!);
  const bateriaRefIds = items.filter(i => i.item_type === "bateria" && i.ref_id).map(i => i.ref_id!);

  // Parallel lookups
  const [modulos, inversores, baterias] = await Promise.all([
    moduloRefIds.length > 0 ? lookupModulos(moduloRefIds) : Promise.resolve(new Map<string, ModuloRef>()),
    inversorRefIds.length > 0 ? lookupInversores(inversorRefIds) : Promise.resolve(new Map<string, InversorRef>()),
    bateriaRefIds.length > 0 ? lookupBaterias(bateriaRefIds) : Promise.resolve(new Map<string, BateriaRef>()),
  ]);

  return items.map((item) => {
    let fabricante = "";
    let modelo = "";
    let potencia_w = 0;

    if (item.item_type === "modulo" && item.ref_id) {
      const ref = modulos.get(item.ref_id);
      if (ref) {
        fabricante = ref.fabricante;
        modelo = ref.modelo;
        potencia_w = ref.potencia_wp;
      }
    } else if (item.item_type === "inversor" && item.ref_id) {
      const ref = inversores.get(item.ref_id);
      if (ref) {
        fabricante = ref.fabricante;
        modelo = ref.modelo;
        potencia_w = ref.potencia_nominal_kw * 1000; // kW → W
      }
    } else if (item.item_type === "bateria" && item.ref_id) {
      const ref = baterias.get(item.ref_id);
      if (ref) {
        fabricante = ref.fabricante;
        modelo = ref.modelo;
      }
    }

    // Fallback for items without ref_id (e.g. Edeltec synced items)
    if (!fabricante && !modelo && item.description) {
      // Try to extract fabricante and modelo from description like "Fabricante Modelo 640W"
      const wMatch = item.description.match(/(\d+)\s*W/i);
      if (wMatch) potencia_w = parseInt(wMatch[1], 10);
      const kwMatch = item.description.match(/(\d+(?:[.,]\d+)?)\s*kW/i);
      if (kwMatch) potencia_w = Math.round(parseFloat(kwMatch[1].replace(",", ".")) * 1000);
      // Use full description as modelo, try to split fabricante
      const parts = item.description.split(" ");
      if (parts.length >= 2) {
        fabricante = parts[0];
        modelo = parts.slice(1).join(" ");
      } else {
        modelo = item.description;
      }
    }

    return {
      id: crypto.randomUUID(),
      descricao: buildDescricao(item, fabricante, modelo, potencia_w),
      fabricante,
      modelo,
      potencia_w,
      quantidade: Math.max(1, item.quantity),
      preco_unitario: item.unit_price || 0,
      categoria: mapCategoria(item.item_type),
      avulso: item.item_type === "generico",
      produto_ref: item.ref_id || null,
    } satisfies KitItemRow;
  });
}

// ─── Private helpers ──────────────────────────────────────

function buildDescricao(item: CatalogKitItem, fabricante: string, modelo: string, potencia_w: number): string {
  if (fabricante && modelo) {
    const potLabel = potencia_w > 0 ? ` ${potencia_w}W` : "";
    return `${fabricante} ${modelo}${potLabel}`.trim();
  }
  return item.description;
}

async function lookupModulos(ids: string[]): Promise<Map<string, ModuloRef>> {
  const { data } = await supabase
    .from("modulos_solares")
    .select("id, fabricante, modelo, potencia_wp")
    .in("id", ids);
  const map = new Map<string, ModuloRef>();
  data?.forEach(m => map.set(m.id, m));
  return map;
}

async function lookupInversores(ids: string[]): Promise<Map<string, InversorRef>> {
  const { data } = await supabase
    .from("inversores_catalogo")
    .select("id, fabricante, modelo, potencia_nominal_kw")
    .in("id", ids);
  const map = new Map<string, InversorRef>();
  data?.forEach(i => map.set(i.id, i));
  return map;
}

async function lookupBaterias(ids: string[]): Promise<Map<string, BateriaRef>> {
  const { data } = await supabase
    .from("baterias")
    .select("id, fabricante, modelo, energia_kwh")
    .in("id", ids);
  const map = new Map<string, BateriaRef>();
  data?.forEach(b => map.set(b.id, b));
  return map;
}

/**
 * Build synthetic KitItemRow[] from canonical solar_kit_catalog data
 * for integrated kits (e.g. Edeltec) that don't have solar_kit_catalog_items.
 * A kit is considered valid if it has source + external_id + name + price/potencia.
 */
async function buildSyntheticRowsFromCatalog(kitId: string): Promise<KitItemRow[]> {
  const { data: kit, error } = await supabase
    .from("solar_kit_catalog")
    .select("id, name, source, external_id, external_data, estimated_kwp, fixed_price, fabricante, potencia_inversor, potencia_modulo, estrutura, fase, tensao, product_kind, is_generator, disponivel")
    .eq("id", kitId)
    .maybeSingle();

  if (error || !kit) return [];

  // Only generate synthetic rows for integrated kits with valid canonical data
  const hasSource = !!kit.source && !!kit.external_id;
  const hasMinimalData = !!kit.name && (kit.fixed_price != null || kit.estimated_kwp != null);
  if (!hasSource || !hasMinimalData) return [];

  const toNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(/\./g, "").replace(",", ".").trim();
      const parsed = Number(normalized);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  };

  const round2 = (n: number): number => Math.round(n * 100) / 100;

  const estimatedKwp = toNumber(kit.estimated_kwp) ?? 0;
  const moduloPotenciaW =
    toNumber(kit.potencia_modulo) ??
    toNumber(extData?.potencia_modulo) ??
    toNumber(extData?.modulo?.potencia_w) ??
    toNumber(extData?.modulo?.potencia) ??
    0;

  const inversorPotenciaKw =
    toNumber(kit.potencia_inversor) ??
    toNumber(extData?.potencia_inversor) ??
    toNumber(extData?.inversor?.potencia_kw) ??
    toNumber(extData?.inversor?.potencia) ??
    0;

  const moduloQtdFromPayload =
    toNumber(extData?.quantidade_modulos) ??
    toNumber(extData?.qtd_modulos) ??
    toNumber(extData?.modulo?.quantidade) ??
    null;

  const inversorQtdFromPayload =
    toNumber(extData?.quantidade_inversores) ??
    toNumber(extData?.qtd_inversores) ??
    toNumber(extData?.inversor?.quantidade) ??
    null;

  const moduloQtd = Math.max(
    1,
    Math.round(
      moduloQtdFromPayload ??
      (moduloPotenciaW > 0 && estimatedKwp > 0
        ? (estimatedKwp * 1000) / moduloPotenciaW
        : 1),
    ),
  );

  const inversorQtd = Math.max(1, Math.round(inversorQtdFromPayload ?? 1));
  const kitPrice = toNumber(kit.fixed_price) ?? 0;

  const moduloWeight = estimatedKwp > 0 ? estimatedKwp : (moduloPotenciaW * moduloQtd) / 1000;
  const inversorWeight = inversorPotenciaKw > 0 ? inversorPotenciaKw * inversorQtd : 0;
  const totalWeight = moduloWeight + inversorWeight;

  const moduloTotal = totalWeight > 0 ? round2(kitPrice * (moduloWeight / totalWeight)) : kitPrice;
  const inversorTotal = round2(Math.max(0, kitPrice - moduloTotal));

  const fabricantePadrao = kit.fabricante || extData?.fabricante || "";
  const moduloModelo =
    extData?.modulo?.modelo ||
    extData?.modulo_modelo ||
    extData?.modelo_modulo ||
    (moduloPotenciaW > 0 ? `Módulo ${moduloPotenciaW}W` : "Módulo");

  const inversorModelo =
    extData?.inversor?.modelo ||
    extData?.inversor_modelo ||
    extData?.modelo_inversor ||
    (inversorPotenciaKw > 0 ? `Inversor ${inversorPotenciaKw}kW` : "Inversor");

  const rows: KitItemRow[] = [];
  if (moduloPotenciaW > 0 || estimatedKwp > 0) {
    rows.push({
      id: crypto.randomUUID(),
      descricao: `${moduloQtd}x ${moduloModelo}`,
      fabricante: fabricantePadrao,
      modelo: moduloModelo,
      potencia_w: moduloPotenciaW > 0 ? moduloPotenciaW : estimatedKwp * 1000,
      quantidade: moduloQtd,
      preco_unitario: moduloQtd > 0 ? round2(moduloTotal / moduloQtd) : 0,
      categoria: "modulo",
      avulso: false,
      produto_ref: kit.id,
    });
  }

  if (inversorPotenciaKw > 0) {
    rows.push({
      id: crypto.randomUUID(),
      descricao: `${inversorQtd}x ${inversorModelo}`,
      fabricante: fabricantePadrao,
      modelo: inversorModelo,
      potencia_w: inversorPotenciaKw * 1000,
      quantidade: inversorQtd,
      preco_unitario: inversorQtd > 0 ? round2(inversorTotal / inversorQtd) : 0,
      categoria: "inversor",
      avulso: false,
      produto_ref: kit.id,
    });
  }

  // Fallback extremo: mantém compatibilidade caso os campos técnicos não existam
  if (rows.length === 0) {
    rows.push({
      id: crypto.randomUUID(),
      descricao: kit.name,
      fabricante: fabricantePadrao,
      modelo: kit.name,
      potencia_w: estimatedKwp * 1000,
      quantidade: 1,
      preco_unitario: kitPrice,
      categoria: "outros",
      avulso: false,
      produto_ref: kit.id,
    });
  }

  return rows;
}
