import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface Proposta {
  id: string;
  nome: string;
  status: string;
  cliente_nome: string | null;
  cliente_celular: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_email: string | null;
  cliente_endereco: string | null;
  cliente_cep: string | null;
  potencia_kwp: number | null;
  numero_modulos: number | null;
  modelo_modulo: string | null;
  modelo_inversor: string | null;
  preco_total: number | null;
  economia_mensal: number | null;
  geracao_mensal_kwh: number | null;
  payback_anos: number | null;
  area_necessaria: number | null;
  distribuidora: string | null;
  link_pdf: string | null;
  expiration_date: string | null;
  generated_at: string | null;
  created_at: string;
  raw_payload: Record<string, any> | null;
  vendedor_id: string | null;
  vendedor?: { nome: string } | null;
}

export interface PropostaFormData {
  nome: string;
  cliente_nome: string;
  cliente_celular: string;
  cliente_cidade: string;
  cliente_estado: string;
  cliente_email: string;
  potencia_kwp: number;
  numero_modulos: number;
  modelo_modulo: string;
  modelo_inversor: string;
  preco_total: number;
  economia_mensal: number;
  geracao_mensal_kwh: number;
  payback_anos: number;
  distribuidora: string;
  vendedor_id: string;
}

export function usePropostas() {
  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchPropostas = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("propostas_sm_legado" as any)
        .select("*, consultor_ref:consultores(nome)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      setPropostas((data as unknown as Proposta[]) || []);
    } catch (err: any) {
      console.error("Error fetching propostas:", err);
      toast({
        title: "Erro ao carregar propostas",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPropostas();
  }, [fetchPropostas]);

  // ⚠️ HARDENING: Realtime subscription for cross-user sync on propostas
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('propostas-legado-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'propostas_sm_legado' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchPropostas(), 600);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchPropostas]);

  const createProposta = useCallback(
    async (data: PropostaFormData) => {
      setCreating(true);
      try {
        const { error } = await supabase.from("propostas_sm_legado" as any).insert({
          nome: data.nome,
          cliente_nome: data.cliente_nome,
          cliente_celular: data.cliente_celular,
          cliente_cidade: data.cliente_cidade,
          cliente_estado: data.cliente_estado,
          cliente_email: data.cliente_email,
          potencia_kwp: data.potencia_kwp || null,
          numero_modulos: data.numero_modulos || null,
          modelo_modulo: data.modelo_modulo || null,
          modelo_inversor: data.modelo_inversor || null,
          preco_total: data.preco_total || null,
          economia_mensal: data.economia_mensal || null,
          geracao_mensal_kwh: data.geracao_mensal_kwh || null,
          payback_anos: data.payback_anos || null,
          distribuidora: data.distribuidora || null,
          consultor_id: data.vendedor_id || null,
          status: "rascunho",
        });

        if (error) throw error;

        toast({ title: "Proposta criada com sucesso!" });
        fetchPropostas();
        return true;
      } catch (err: any) {
        toast({
          title: "Erro ao criar proposta",
          description: err.message,
          variant: "destructive",
        });
        return false;
      } finally {
        setCreating(false);
      }
    },
    [fetchPropostas]
  );

  const deleteProposta = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase
          .from("propostas_sm_legado" as any)
          .delete()
          .eq("id", id);
        if (error) throw error;
        toast({ title: "Proposta excluída" });
        fetchPropostas();
      } catch (err: any) {
        toast({
          title: "Erro ao excluir",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [fetchPropostas]
  );

  const updateStatus = useCallback(
    async (id: string, status: string) => {
      try {
        const { error } = await supabase
          .from("propostas_sm_legado" as any)
          .update({ status })
          .eq("id", id);
        if (error) throw error;
        toast({ title: `Status atualizado para "${status}"` });
        fetchPropostas();
      } catch (err: any) {
        toast({
          title: "Erro ao atualizar status",
          description: err.message,
          variant: "destructive",
        });
      }
    },
    [fetchPropostas]
  );

  return {
    propostas,
    loading,
    creating,
    fetchPropostas,
    createProposta,
    deleteProposta,
    updateStatus,
  };
}
