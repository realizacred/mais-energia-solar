import { useMemo } from "react";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
import type { OrcamentoSortOption } from "@/hooks/useOrcamentoSort";

export interface GroupedOrcamento {
  lead_id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  latestOrcamento: OrcamentoDisplayItem | OrcamentoVendedor;
  firstOrcamento: OrcamentoDisplayItem | OrcamentoVendedor;
  allOrcamentos: (OrcamentoDisplayItem | OrcamentoVendedor)[];
  count: number;
}

/**
 * Extract numeric part from a code string like "ORC-0042" → 42
 */
function extractCodeNumber(code: string | null): number {
  if (!code) return 0;
  const match = code.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Groups orcamentos by lead_id, showing the latest orcamento
 * with count of how many previous ones exist.
 * Accepts a sortOption to control the final ordering (default: "recent").
 */
export function useGroupedOrcamentos<T extends OrcamentoDisplayItem | OrcamentoVendedor>(
  orcamentos: T[],
  sortOption: OrcamentoSortOption = "recent"
): GroupedOrcamento[] {
  return useMemo(() => {
    const groupedMap = new Map<string, T[]>();
    
    // Group by lead_id
    orcamentos.forEach((orc) => {
      const existing = groupedMap.get(orc.lead_id) || [];
      existing.push(orc);
      groupedMap.set(orc.lead_id, existing);
    });

    // Transform to GroupedOrcamento array
    const result: GroupedOrcamento[] = [];
    
    groupedMap.forEach((orcs, leadId) => {
      // Sort by created_at descending (latest first) within each group
      const sorted = [...orcs].sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      
      const latestOrcamento = sorted[0];
      const firstOrcamento = sorted[sorted.length - 1];
      
      result.push({
        lead_id: leadId,
        lead_code: latestOrcamento.lead_code,
        nome: latestOrcamento.nome,
        telefone: latestOrcamento.telefone,
        latestOrcamento,
        firstOrcamento,
        allOrcamentos: sorted,
        count: sorted.length,
      });
    });

    // Apply sort based on sortOption
    return result.sort((a, b) => {
      switch (sortOption) {
        case "recent":
          return new Date(b.latestOrcamento.created_at).getTime() - new Date(a.latestOrcamento.created_at).getTime();
        case "oldest":
          return new Date(a.latestOrcamento.created_at).getTime() - new Date(b.latestOrcamento.created_at).getTime();
        case "name_asc":
          return a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" });
        case "name_desc":
          return b.nome.localeCompare(a.nome, "pt-BR", { sensitivity: "base" });
        case "orc_desc":
          return extractCodeNumber(b.latestOrcamento.orc_code) - extractCodeNumber(a.latestOrcamento.orc_code);
        case "orc_asc":
          return extractCodeNumber(a.latestOrcamento.orc_code) - extractCodeNumber(b.latestOrcamento.orc_code);
        case "cli_desc":
          return extractCodeNumber(b.lead_code) - extractCodeNumber(a.lead_code);
        case "cli_asc":
          return extractCodeNumber(a.lead_code) - extractCodeNumber(b.lead_code);
        default:
          return new Date(b.latestOrcamento.created_at).getTime() - new Date(a.latestOrcamento.created_at).getTime();
      }
    });
  }, [orcamentos, sortOption]);
}
