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
        const { data: lead } = await (supabase as any)
          .from("leads")
          .select("consultor_id, consultor, created_at")
          .eq("id", leadId)
          .single();

        // 2) Get distribution log entries
        const { data: distLogs } = await (supabase as any)
          .from("lead_distribution_log")
          .select("consultor_id, consultor_anterior_id, motivo, distribuido_em")
          .eq("lead_id", leadId)
          .order("distribuido_em", { ascending: true });

        // 3) Get audit log entries for consultor_id changes
        const { data: auditLogs } = await supabase
          .from("audit_logs")
          .select("acao, dados_anteriores, dados_novos, created_at")
          .eq("tabela", "leads")
          .eq("registro_id", leadId)
          .in("acao", ["INSERT", "UPDATE"])
          .order("created_at", { ascending: true })
          .limit(50);

        if (cancelled) return;

        // Collect all consultor_ids to resolve names in one query
        const consultorIds = new Set<string>();
        if (lead?.consultor_id) consultorIds.add(lead.consultor_id);

        distLogs?.forEach(d => {
          if (d.consultor_id) consultorIds.add(d.consultor_id);
          if (d.consultor_anterior_id) consultorIds.add(d.consultor_anterior_id);
        });

        // Extract consultor_id from audit logs
        const auditEntries: { consultor_id_new: string | null; consultor_id_old: string | null; data: string; tipo: "criacao" | "reatribuicao" }[] = [];
        
        auditLogs?.forEach(log => {
          const novos = log.dados_novos as Record<string, any> | null;
          const anteriores = log.dados_anteriores as Record<string, any> | null;

          if (log.acao === "INSERT" && novos?.consultor_id) {
            consultorIds.add(novos.consultor_id);
            auditEntries.push({
              consultor_id_new: novos.consultor_id,
              consultor_id_old: null,
              data: log.created_at,
              tipo: "criacao",
            });
          } else if (log.acao === "UPDATE" && novos?.consultor_id && anteriores?.consultor_id && novos.consultor_id !== anteriores.consultor_id) {
            consultorIds.add(novos.consultor_id);
            consultorIds.add(anteriores.consultor_id);
            auditEntries.push({
              consultor_id_new: novos.consultor_id,
              consultor_id_old: anteriores.consultor_id,
              data: log.created_at,
              tipo: "reatribuicao",
            });
          }
        });

        // Resolve names
        const consultorIdsArr = Array.from(consultorIds).filter(Boolean);
        let nameMap: Record<string, string> = {};
        if (consultorIdsArr.length > 0) {
          const { data: consultores } = await (supabase as any)
            .from("consultores")
            .select("id, nome")
            .in("id", consultorIdsArr);
          consultores?.forEach((v: any) => { nameMap[v.id] = v.nome; });
        }

        if (cancelled) return;

        // Build history
        const historico: OwnershipEntry[] = [];

        // From audit logs (INSERT = criação)
        auditEntries.forEach(ae => {
          historico.push({
            tipo: ae.tipo,
            consultor_id: ae.consultor_id_new,
            consultor_anterior_id: ae.consultor_id_old,
            consultor_nome: ae.consultor_id_new ? nameMap[ae.consultor_id_new] || null : null,
            consultor_anterior_nome: ae.consultor_id_old ? nameMap[ae.consultor_id_old] || null : null,
            data: ae.data,
            motivo: ae.tipo === "criacao" ? "Cadastro inicial" : "Reatribuição (admin)",
          });
        });

        // From distribution log
        distLogs?.forEach(d => {
          // Avoid duplicates with audit entries (within 5s window)
          const isDuplicate = historico.some(h =>
            h.consultor_id === d.consultor_id &&
            Math.abs(new Date(h.data).getTime() - new Date(d.distribuido_em).getTime()) < 5000
          );
          if (!isDuplicate) {
            historico.push({
              tipo: "distribuicao",
              consultor_id: d.consultor_id,
              consultor_anterior_id: d.consultor_anterior_id,
              consultor_nome: d.consultor_id ? nameMap[d.consultor_id] || null : null,
              consultor_anterior_nome: d.consultor_anterior_id ? nameMap[d.consultor_anterior_id] || null : null,
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
          consultor_atual_id: lead?.consultor_id || null,
          consultor_atual_nome: lead?.consultor_id ? nameMap[lead.consultor_id] || lead?.consultor || null : lead?.consultor || null,
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
