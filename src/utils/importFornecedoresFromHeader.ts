/**
 * Utilitário compartilhado para criar fornecedores a partir do header do CSV de distribuidora.
 * Formato esperado: "Categoria;Item;19646 - WEG;19647 - SICES;..."
 * Extrai nomes das colunas a partir da coluna 3.
 */
import { supabase } from "@/integrations/supabase/client";

export function extractDistributorNames(headerLine: string): string[] {
  const cols = headerLine.split(";").map(c => c.trim());
  const names: string[] = [];
  for (let i = 2; i < cols.length; i++) {
    const col = cols[i];
    const match = col.match(/^\d+\s*-\s*(.+)$/);
    if (match) names.push(match[1].trim());
    else if (col && col !== "") names.push(col);
  }
  return [...new Set(names.filter(Boolean))];
}

export async function importFornecedoresFromHeader(
  headerLine: string,
  tenantId: string
): Promise<number> {
  const unique = extractDistributorNames(headerLine);
  if (unique.length === 0) return 0;

  const { data: existing } = await supabase
    .from("fornecedores")
    .select("nome")
    .eq("tenant_id", tenantId)
    .eq("tipo", "distribuidor");

  const existingNames = new Set(
    (existing || []).map(f => f.nome.toLowerCase().trim())
  );

  const toCreate = unique.filter(
    name => !existingNames.has(name.toLowerCase().trim())
  );

  if (toCreate.length === 0) return 0;

  const { error } = await supabase
    .from("fornecedores")
    .insert(toCreate.map(nome => ({
      nome,
      tipo: "distribuidor",
      tenant_id: tenantId,
      ativo: true,
    })));

  if (error) {
    console.error("[importFornecedores] erro:", error.message);
    return 0;
  }

  console.log(`[importFornecedores] ${toCreate.length} fornecedores criados:`, toCreate);
  return toCreate.length;
}
