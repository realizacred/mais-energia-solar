import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface PendingValidation {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  created_at: string;
  lead_id: string | null;
  simulacao_aceita_id: string | null;
  potencia_kwp: number | null;
  valor_projeto: number | null;
  leads?: {
    consultor: string | null;
    consultor_id: string | null;
    lead_code: string | null;
    consultores?: { id: string; nome: string } | null;
  } | null;
  simulacoes?: {
    investimento_estimado: number | null;
    potencia_recomendada_kwp: number | null;
  } | null;
}

export interface ValidationHistory {
  id: string;
  nome: string;
  telefone: string;
  cidade: string | null;
  estado: string | null;
  created_at: string;
  valor_projeto: number | null;
  potencia_kwp: number | null;
  lead_id: string | null;
  leads?: {
    consultor: string | null;
    consultor_id: string | null;
    lead_code: string | null;
    status_id: string | null;
    consultores?: { id: string; nome: string } | null;
  } | null;
}

export function usePendingValidations() {
  const [pendingCount, setPendingCount] = useState(0);
  const [pendingItems, setPendingItems] = useState<PendingValidation[]>([]);
  const [historyItems, setHistoryItems] = useState<ValidationHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchPending = useCallback(async () => {
    try {
      // Get "Aguardando Validação" status
      const { data: statusData } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Validação")
        .single();

      if (!statusData) {
        setPendingItems([]);
        setPendingCount(0);
        return;
      }

      // Get leads with this status
      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .eq("status_id", statusData.id);

      if (!leads || leads.length === 0) {
        setPendingItems([]);
        setPendingCount(0);
        return;
      }

      const leadIds = leads.map((l) => l.id);

      const { data, error } = await supabase
        .from("clientes")
        .select(`
          id,
          nome,
          telefone,
          cidade,
          estado,
          created_at,
          lead_id,
          simulacao_aceita_id,
          potencia_kwp,
          valor_projeto,
          leads(consultor, consultor_id, lead_code, consultores:consultor_id(id, nome)),
          simulacoes:simulacao_aceita_id(investimento_estimado, potencia_recomendada_kwp)
        `)
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPendingItems((data as unknown as PendingValidation[]) || []);
      setPendingCount(data?.length || 0);
    } catch (error) {
      console.error("Error fetching pending validations:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      // Get "Convertido" status
      const { data: convertidoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Convertido")
        .single();

      if (!convertidoStatus) {
        setHistoryItems([]);
        return;
      }

      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .eq("status_id", convertidoStatus.id);

      if (!leads || leads.length === 0) {
        setHistoryItems([]);
        return;
      }

      const leadIds = leads.map((l) => l.id);

      const { data, error } = await supabase
        .from("clientes")
        .select(`
          id,
          nome,
          telefone,
          cidade,
          estado,
          created_at,
          valor_projeto,
          potencia_kwp,
          lead_id,
          leads(consultor, consultor_id, lead_code, status_id, consultores:consultor_id(id, nome))
        `)
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistoryItems((data as unknown as ValidationHistory[]) || []);
    } catch (error) {
      console.error("Error fetching validation history:", error);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return {
    pendingCount,
    pendingItems,
    historyItems,
    loading,
    historyLoading,
    refetchPending: fetchPending,
    fetchHistory,
  };
}
