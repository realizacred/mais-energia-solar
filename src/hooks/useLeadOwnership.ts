import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OwnershipEntry {
  tipo: "criacao" | "reatribuicao" | "distribuicao";
  consultor_id: string | null;
  consultor_anterior_id: string | null;
  consultor_nome: string | null;
  consultor_anterior_nome: string | null;
  data: string;
  motivo: string | null;
}

export interface LeadOwnershipData {
  consultor_atual_id: string | null;
  consultor_atual_nome: string | null;
  primeiro_consultor_nome: string | null;
  primeiro_consultor_data: string | null;
  foi_reatribuido: boolean;
  historico: OwnershipEntry[];
  loading: boolean;
}

/**
 * Fetches ownership history for a lead from audit_logs + lead_distribution_log.
 * Only queries when leadId is provided (detail view), avoiding N+1 in lists.
 */
export function useLeadOwnership(leadId: string | null): LeadOwnershipData {
  const [data, setData] = useState<LeadOwnershipData>({
    consultor_atual_id: null,
    consultor_atual_nome: null,
    primeiro_consultor_nome: null,
    primeiro_consultor_data: null,
    foi_reatribuido: false,
    historico: [],
    loading: false,
  });

  useEffect(() => {
    if (!leadId) return;

    let cancelled = false;

    const fetchOwnership = async () => {
      setData(prev => ({ ...prev, loading: true }));

      try {
        // 1) Get current lead info
        const { data: lead } = await supabase
          .from("leads")
          .select("vendedor_id, vendedor, created_at")
          .eq("id", leadId)
          .single();

        // 2) Get distribution log entries
        const { data: distLogs } = await supabase
          .from("lead_distribution_log")
          .select("vendedor_id, vendedor_anterior_id, motivo, distribuido_em")
          .eq("lead_id", leadId)
          .order("distribuido_em", { ascending: true });

        // 3) Get audit log entries for vendedor_id changes
        const { data: auditLogs } = await supabase
          .from("audit_logs")
          .select("acao, dados_anteriores, dados_novos, created_at")
          .eq("tabela", "leads")
          .eq("registro_id", leadId)
          .in("acao", ["INSERT", "UPDATE"])
          .order("created_at", { ascending: true })
          .limit(50);

        if (cancelled) return;

        // Collect all vendedor_ids to resolve names in one query
        const vendedorIds = new Set<string>();
        if (lead?.vendedor_id) vendedorIds.add(lead.vendedor_id);

        distLogs?.forEach(d => {
          if (d.vendedor_id) vendedorIds.add(d.vendedor_id);
          if (d.vendedor_anterior_id) vendedorIds.add(d.vendedor_anterior_id);
        });

        // Extract vendedor_id from audit logs
        const auditEntries: { vendedor_id: string | null; vendedor_anterior_id: string | null; data: string; tipo: "criacao" | "reatribuicao" }[] = [];
        
        auditLogs?.forEach(log => {
          const novos = log.dados_novos as Record<string, any> | null;
          const anteriores = log.dados_anteriores as Record<string, any> | null;

          if (log.acao === "INSERT" && novos?.vendedor_id) {
            vendedorIds.add(novos.vendedor_id);
            auditEntries.push({
              vendedor_id: novos.vendedor_id,
              vendedor_anterior_id: null,
              data: log.created_at,
              tipo: "criacao",
            });
          } else if (log.acao === "UPDATE" && novos?.vendedor_id && anteriores?.vendedor_id && novos.vendedor_id !== anteriores.vendedor_id) {
            vendedorIds.add(novos.vendedor_id);
            vendedorIds.add(anteriores.vendedor_id);
            auditEntries.push({
              vendedor_id: novos.vendedor_id,
              vendedor_anterior_id: anteriores.vendedor_id,
              data: log.created_at,
              tipo: "reatribuicao",
            });
          }
        });

        // Resolve names
        const vendedorIdsArr = Array.from(vendedorIds).filter(Boolean);
        let nameMap: Record<string, string> = {};
        if (vendedorIdsArr.length > 0) {
          const { data: vendedores } = await supabase
            .from("vendedores")
            .select("id, nome")
            .in("id", vendedorIdsArr);
          vendedores?.forEach(v => { nameMap[v.id] = v.nome; });
        }

        if (cancelled) return;

        // Build history
        const historico: OwnershipEntry[] = [];

        // From audit logs (INSERT = criação)
        auditEntries.forEach(ae => {
          historico.push({
            tipo: ae.tipo,
            consultor_id: ae.vendedor_id,
            consultor_anterior_id: ae.vendedor_anterior_id,
            consultor_nome: ae.vendedor_id ? nameMap[ae.vendedor_id] || null : null,
            consultor_anterior_nome: ae.vendedor_anterior_id ? nameMap[ae.vendedor_anterior_id] || null : null,
            data: ae.data,
            motivo: ae.tipo === "criacao" ? "Cadastro inicial" : "Reatribuição (admin)",
          });
        });

        // From distribution log
        distLogs?.forEach(d => {
          // Avoid duplicates with audit entries (within 5s window)
          const isDuplicate = historico.some(h =>
            h.consultor_id === d.vendedor_id &&
            Math.abs(new Date(h.data).getTime() - new Date(d.distribuido_em).getTime()) < 5000
          );
          if (!isDuplicate) {
            historico.push({
              tipo: "distribuicao",
              consultor_id: d.vendedor_id,
              consultor_anterior_id: d.vendedor_anterior_id,
              consultor_nome: d.vendedor_id ? nameMap[d.vendedor_id] || null : null,
              consultor_anterior_nome: d.vendedor_anterior_id ? nameMap[d.vendedor_anterior_id] || null : null,
              data: d.distribuido_em,
              motivo: d.motivo || "Distribuição automática",
            });
          }
        });

        // Sort by date
        historico.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());

        // Determine primeiro consultor
        const firstEntry = historico.find(h => h.tipo === "criacao");
        const primeiro_consultor_nome = firstEntry?.consultor_nome || null;
        const primeiro_consultor_data = firstEntry?.data || lead?.created_at || null;

        const foi_reatribuido = historico.some(h => h.tipo === "reatribuicao" || h.tipo === "distribuicao");

        setData({
          consultor_atual_id: lead?.vendedor_id || null,
          consultor_atual_nome: lead?.vendedor_id ? nameMap[lead.vendedor_id] || lead?.vendedor || null : lead?.vendedor || null,
          primeiro_consultor_nome,
          primeiro_consultor_data,
          foi_reatribuido,
          historico,
          loading: false,
        });
      } catch (err) {
        console.error("[useLeadOwnership] Error:", err);
        if (!cancelled) {
          setData(prev => ({ ...prev, loading: false }));
        }
      }
    };

    fetchOwnership();
    return () => { cancelled = true; };
  }, [leadId]);

  return data;
}
