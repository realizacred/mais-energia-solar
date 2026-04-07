/**
 * usePropostaRapidaLead — Fluxo rápido Lead → Cliente → Projeto → Wizard
 * RB-50: Atalho sem burocracia para gerar proposta direto do lead.
 * §16: Query em hook. §23: staleTime obrigatório (N/A — mutation only).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { toast } from "sonner";
import type { Lead } from "@/types/lead";

/** Dados mínimos necessários para conversão rápida */
export interface QuickLeadData {
  id: string;
  nome: string;
  telefone: string;
  cidade?: string | null;
  estado?: string | null;
  bairro?: string | null;
  rua?: string | null;
  cep?: string | null;
  consultor_id?: string | null;
  valor_estimado?: number | null;
}

export function usePropostaRapidaLead() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function quickConvertToProposal(lead: QuickLeadData) {
    if (loading) return;
    setLoading(true);

    try {
      const { tenantId } = await getCurrentTenantId();

      // 1. Buscar cliente existente pelo lead_id
      const { data: existingCliente } = await supabase
        .from("clientes")
        .select("id")
        .eq("lead_id", lead.id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      let clienteId = existingCliente?.id;

      // 2. Se não existe → criar cliente mínimo
      if (!clienteId) {
        const { data: newCliente, error: clienteError } = await supabase
          .from("clientes")
          .insert({
            nome: lead.nome,
            telefone: lead.telefone,
            cidade: lead.cidade || null,
            estado: lead.estado || null,
            bairro: lead.bairro || null,
            rua: lead.rua || null,
            cep: lead.cep || null,
            lead_id: lead.id,
            tenant_id: tenantId,
            cliente_code: `CLI-${Date.now()}`, // trigger override
          } as any)
          .select("id")
          .single();

        if (clienteError) throw clienteError;
        clienteId = newCliente.id;
      }

      // 3. Buscar projeto existente via cliente.lead_id
      const { data: existingProjeto } = await supabase
        .from("projetos")
        .select("id, deal_id")
        .eq("cliente_id", clienteId!)
        .eq("tenant_id", tenantId)
        .limit(1)
        .maybeSingle();

      if (existingProjeto) {
        // Lead já tem projeto → redirecionar direto
        toast.info("Lead já possui projeto. Abrindo wizard...");
        navigate(
          `/admin/propostas-nativas/nova?deal_id=${existingProjeto.deal_id || existingProjeto.id}&customer_id=${clienteId}&lead_id=${lead.id}`
        );
        return;
      }

      // 4. Buscar pipeline e stage default
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("tenant_id", tenantId)
        .limit(1)
        .single();

      if (!pipeline) throw new Error("Nenhum pipeline encontrado. Configure o funil comercial primeiro.");

      const { data: stage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipeline.id)
        .order("position", { ascending: true })
        .limit(1)
        .single();

      if (!stage) throw new Error("Nenhuma etapa encontrada no pipeline.");

      // 5. Criar deal
      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert({
          pipeline_id: pipeline.id,
          stage_id: stage.id,
          owner_id: lead.consultor_id || null,
          customer_id: clienteId!,
          value: lead.valor_estimado || 0,
          title: lead.nome,
          tenant_id: tenantId,
        } as any)
        .select("id")
        .single();

      if (dealError) throw dealError;

      // 6. Criar projeto
      const { data: newProjeto, error: projetoError } = await supabase
        .from("projetos")
        .insert({
          cliente_id: clienteId!,
          consultor_id: lead.consultor_id || null,
          deal_id: newDeal.id,
          status: "criado",
          tenant_id: tenantId,
        } as any)
        .select("id")
        .single();

      if (projetoError) throw projetoError;

      // 7. Vincular projeto ao deal
      await supabase
        .from("deals")
        .update({ projeto_id: newProjeto.id } as any)
        .eq("id", newDeal.id);

      toast.success("Projeto criado! Abrindo wizard de proposta...");

      // 8. Redirecionar ao wizard
      navigate(
        `/admin/propostas-nativas/nova?deal_id=${newDeal.id}&customer_id=${clienteId}&lead_id=${lead.id}`
      );
    } catch (err: any) {
      console.error("[usePropostaRapidaLead] Erro:", err);
      toast.error(err.message || "Erro ao criar proposta rápida.");
    } finally {
      setLoading(false);
    }
  }

  return { quickConvertToProposal, loading };
}
