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
  disjuntor_id: string | null;
  transformador_id: string | null;
  localizacao: string | null;
  assinatura_url: string | null;
  identidade_url: string | null;
  identidade_urls: string[] | null;
  comprovante_endereco_url: string | null;
  comprovante_endereco_urls: string[] | null;
  comprovante_beneficiaria_urls: string[] | null;
  disjuntores?: {
    amperagem: number | null;
    descricao: string | null;
  } | null;
  transformadores?: {
    potencia_kva: number | null;
    descricao: string | null;
  } | null;
  leads?: {
    consultor: string | null;
    consultor_id: string | null;
    lead_code: string | null;
    media_consumo: number | null;
    arquivos_urls: string[] | null;
    consultores?: { id: string; nome: string } | null;
    orcamentos?: {
      arquivos_urls: string[] | null;
      media_consumo: number | null;
    }[] | null;
  } | null;
  simulacoes?: {
    investimento_estimado: number | null;
    potencia_recomendada_kwp: number | null;
    consumo_kwh: number | null;
    geracao_mensal_estimada: number | null;
    economia_mensal: number | null;
    payback_meses: number | null;
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
        .maybeSingle();

      if (!statusData) {
        setPendingItems([]);
        setPendingCount(0);
        return;
      }

      // Get leads with this status (exclude soft-deleted)
      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .eq("status_id", statusData.id)
        .is("deleted_at", null);

      if (!leads || leads.length === 0) {
        setPendingItems([]);
        setPendingCount(0);
        return;
      }

      const leadIds = leads.map((l) => l.id);

      // 1) Fetch clients that have a matching lead
      const { data: clienteData, error } = await supabase
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
          disjuntor_id,
          transformador_id,
          localizacao,
          assinatura_url,
          identidade_url,
          identidade_urls,
          comprovante_endereco_url,
          comprovante_endereco_urls,
          comprovante_beneficiaria_urls,
          disjuntores:disjuntor_id(amperagem, descricao),
          transformadores:transformador_id(potencia_kva, descricao),
          leads!clientes_lead_id_fkey(consultor, consultor_id, lead_code, media_consumo, arquivos_urls, consultores:consultor_id(id, nome), orcamentos(arquivos_urls, media_consumo)),
          simulacoes:simulacao_aceita_id(investimento_estimado, potencia_recomendada_kwp, consumo_kwh, geracao_mensal_estimada, economia_mensal, payback_meses)
        `)
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const clienteItems = (clienteData as unknown as PendingValidation[]) || [];

      // 2) Find leads WITHOUT a client record — show them directly
      const coveredLeadIds = new Set(clienteItems.map((c) => c.lead_id).filter(Boolean));
      const orphanLeadIds = leadIds.filter((id) => !coveredLeadIds.has(id));

      let orphanItems: PendingValidation[] = [];
      if (orphanLeadIds.length > 0) {
        const { data: orphanLeads } = await supabase
          .from("leads")
          .select(`
            id, nome, telefone, cidade, estado, created_at,
            lead_code, consultor, consultor_id, media_consumo, arquivos_urls,
            consultores:consultor_id(id, nome)
          `)
          .in("id", orphanLeadIds)
          .order("created_at", { ascending: false });

        if (orphanLeads) {
          orphanItems = orphanLeads.map((lead: any) => ({
            id: `lead-${lead.id}`,
            nome: lead.nome,
            telefone: lead.telefone || "",
            cidade: lead.cidade || null,
            estado: lead.estado || null,
            created_at: lead.created_at,
            lead_id: lead.id,
            simulacao_aceita_id: null,
            potencia_kwp: null,
            valor_projeto: null,
            disjuntor_id: null,
            transformador_id: null,
            localizacao: null,
            assinatura_url: null,
            identidade_url: null,
            identidade_urls: null,
            comprovante_endereco_url: null,
            comprovante_endereco_urls: null,
            comprovante_beneficiaria_urls: null,
            disjuntores: null,
            transformadores: null,
            leads: {
              consultor: lead.consultor,
              consultor_id: lead.consultor_id,
              lead_code: lead.lead_code,
              media_consumo: lead.media_consumo,
              arquivos_urls: lead.arquivos_urls,
              consultores: lead.consultores || null,
              orcamentos: null,
            },
            simulacoes: null,
          }));
        }
      }

      const items = [...clienteItems, ...orphanItems];
      setPendingItems(items);
      setPendingCount(items.length);
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
        .maybeSingle();

      if (!convertidoStatus) {
        setHistoryItems([]);
        return;
      }

      const { data: leads } = await supabase
        .from("leads")
        .select("id")
        .eq("status_id", convertidoStatus.id)
        .is("deleted_at", null);

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

  // ⚠️ HARDENING: Realtime — auto-refresh when leads or clientes change
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => fetchPending(), 600);
    };

    const channel = supabase
      .channel('pending-validations-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clientes' }, refresh)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
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
