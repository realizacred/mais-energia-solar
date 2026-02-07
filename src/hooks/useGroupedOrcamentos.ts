import { useMemo } from "react";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";

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
 * Groups orcamentos by lead_id, showing the latest orcamento
 * with count of how many previous ones exist
 */
export function useGroupedOrcamentos<T extends OrcamentoDisplayItem | OrcamentoVendedor>(
  orcamentos: T[]
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
      // Sort by created_at descending (latest first)
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

    // Sort by status_id first (nulls last), then by name alphabetically
    return result.sort((a, b) => {
      const statusA = a.latestOrcamento.status_id || '';
      const statusB = b.latestOrcamento.status_id || '';
      
      // Compare status first
      if (statusA !== statusB) {
        if (!statusA) return 1; // nulls last
        if (!statusB) return -1;
        return statusA.localeCompare(statusB);
      }
      
      // Then sort by name alphabetically
      return a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' });
    });
  }, [orcamentos]);
}
