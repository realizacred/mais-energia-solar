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
export async function fetchActiveKits(): Promise<CatalogKit[]> {
  const { data, error } = await supabase
    .from("solar_kit_catalog")
    .select("id, name, description, estimated_kwp, pricing_mode, fixed_price, source, external_data")
    .eq("status", "active")
    .order("name");

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

  if (error || !items) {
    console.error("[fetchKitsSummary] Error fetching items:", error?.message);
    return new Map();
  }

  // Collect ref_ids for lookups
  const moduloRefIds = items.filter(i => i.item_type === "modulo" && i.ref_id).map(i => i.ref_id!);
  const inversorRefIds = items.filter(i => i.item_type === "inversor" && i.ref_id).map(i => i.ref_id!);

  const [modulos, inversores] = await Promise.all([
    moduloRefIds.length > 0 ? lookupModulos(moduloRefIds) : Promise.resolve(new Map<string, ModuloRef>()),
    inversorRefIds.length > 0 ? lookupInversores(inversorRefIds) : Promise.resolve(new Map<string, InversorRef>()),
  ]);

  const result = new Map<string, CatalogKitSummary>();

  for (const kitId of kitIds) {
    const kitItems = items.filter(i => i.kit_id === kitId);
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
  if (items.length === 0) return [];

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
