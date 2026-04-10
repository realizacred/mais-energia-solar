import { supabase } from "@/integrations/supabase/client";

function extractDistributorNamesFromFirstLine(firstLine: string): string[] {
  const cols = firstLine.split(";").map(c => c.trim());
  const names: string[] = [];

  for (let i = 2; i < cols.length; i++) {
    const col = cols[i];
    const match = col.match(/^\d+\s*-\s*(.+)$/);
    if (match) names.push(match[1].trim());
    else if (col && col.trim() !== "") names.push(col.trim());
  }

  return [...new Set(names.filter(Boolean))];
}

export function extractDistributorNames(headerLine: string): string[] {
  return extractDistributorNamesFromFirstLine(headerLine);
}

export async function importFornecedoresFromHeader(
  csvText: string,
  tenantId: string
): Promise<number> {
  const firstLine = csvText.split("\n")[0] || "";
  const unique = extractDistributorNamesFromFirstLine(firstLine);

  if (unique.length === 0) return 0;

  const { data: existing, error: fetchError } = await supabase
    .from("fornecedores")
    .select("nome")
    .eq("tenant_id", tenantId);

  if (fetchError) {
    console.error("[importFornecedores] erro ao buscar existentes:", fetchError);
  }

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
    console.error("[importFornecedores] erro no insert:", error.message, error);
    return 0;
  }

  return toCreate.length;
}
