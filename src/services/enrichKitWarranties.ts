/**
 * enrichKitWarranties — Enrich kit items with warranty data from catalog tables.
 * Used when restoring snapshot items for editing (snapshot doesn't persist warranty fields).
 */
import { supabase } from "@/integrations/supabase/client";

interface KitItem {
  id: string;
  categoria: string;
  produto_ref: string | null;
  garantia_produto_anos?: number | null;
  garantia_performance_anos?: number | null;
  garantia_anos?: number | null;
  [key: string]: any;
}

export async function enrichKitWarranties<T extends KitItem>(itens: T[]): Promise<T[]> {
  if (!itens.length) return itens;

  // Collect produto_refs by category
  const moduloRefs = itens
    .filter((it) => it.categoria === "modulo" && it.produto_ref)
    .map((it) => it.produto_ref!);
  const inversorRefs = itens
    .filter((it) => it.categoria === "inversor" && it.produto_ref)
    .map((it) => it.produto_ref!);

  const uniqueModuloRefs = [...new Set(moduloRefs)];
  const uniqueInversorRefs = [...new Set(inversorRefs)];

  // Batch fetch warranty data
  const [modulosRes, inversoresRes] = await Promise.all([
    uniqueModuloRefs.length > 0
      ? supabase
          .from("modulos_solares")
          .select("id, garantia_produto_anos, garantia_performance_anos")
          .in("id", uniqueModuloRefs)
      : Promise.resolve({ data: [] as any[], error: null }),
    uniqueInversorRefs.length > 0
      ? supabase
          .from("inversores_catalogo")
          .select("id, garantia_anos")
          .in("id", uniqueInversorRefs)
      : Promise.resolve({ data: [] as any[], error: null }),
  ]);

  // Build lookup maps
  const moduloMap = new Map<string, { garantia_produto_anos: number | null; garantia_performance_anos: number | null }>();
  (modulosRes.data || []).forEach((m: any) => {
    moduloMap.set(m.id, {
      garantia_produto_anos: m.garantia_produto_anos,
      garantia_performance_anos: m.garantia_performance_anos,
    });
  });

  const inversorMap = new Map<string, number | null>();
  (inversoresRes.data || []).forEach((inv: any) => {
    inversorMap.set(inv.id, inv.garantia_anos);
  });

  // Enrich items
  return itens.map((it) => {
    if (it.categoria === "modulo" && it.produto_ref && moduloMap.has(it.produto_ref)) {
      const warranty = moduloMap.get(it.produto_ref)!;
      return {
        ...it,
        garantia_produto_anos: warranty.garantia_produto_anos,
        garantia_performance_anos: warranty.garantia_performance_anos,
      };
    }
    if (it.categoria === "inversor" && it.produto_ref && inversorMap.has(it.produto_ref)) {
      return {
        ...it,
        garantia_anos: inversorMap.get(it.produto_ref),
      };
    }
    return it;
  });
}
