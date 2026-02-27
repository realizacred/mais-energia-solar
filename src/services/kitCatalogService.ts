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

const ITEM_TYPE_TO_CATEGORIA: Record<string, string> = {
  modulo: "modulo",
  inversor: "inversor",
  bateria: "outros",
  generico: "outros",
  estrutura: "estrutura",
  string_box: "string_box",
  cabos: "cabos",
  conectores: "conectores",
  mao_obra: "mao_obra",
};

function mapCategoria(itemType: string): string {
  return ITEM_TYPE_TO_CATEGORIA[itemType] ?? "outros";
}

// ─── Public API ───────────────────────────────────────────

/**
 * Lista kits ativos do tenant (RLS filtra automaticamente).
 */
export async function fetchActiveKits(): Promise<CatalogKit[]> {
  const { data, error } = await supabase
    .from("solar_kit_catalog")
    .select("id, name, description, estimated_kwp, pricing_mode, fixed_price")
    .eq("status", "active")
    .order("name");

  if (error) throw new Error(`Erro ao buscar kits: ${error.message}`);
  return data ?? [];
}

/**
 * Retorna itens de um kit do catálogo.
 */
export async function fetchKitItems(kitId: string): Promise<CatalogKitItem[]> {
  const { data, error } = await supabase
    .from("solar_kit_catalog_items")
    .select("id, kit_id, item_type, ref_id, description, quantity, unit, notes, created_at")
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
        // baterias don't have a direct potencia_w equivalent
      }
    }

    return {
      id: crypto.randomUUID(),
      descricao: buildDescricao(item, fabricante, modelo, potencia_w),
      fabricante,
      modelo,
      potencia_w,
      quantidade: Math.max(1, item.quantity),
      preco_unitario: 0, // Pricing stays in the existing flow
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
