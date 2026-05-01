/**
 * usePropostaRapidaLead — Fluxo rápido Lead → Cliente → Projeto → Wizard
 * RB-50: Atalho sem burocracia para gerar proposta direto do lead.
 * §16: Query em hook. §23: staleTime obrigatório (N/A — mutation only).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { resolveDefaultCommercialPipeline } from "@/services/pipelines/resolveDefaultCommercialPipeline";
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
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const navigate = useNavigate();

  async function markLeadAsViewed(leadId: string, tenantId: string) {
    const [leadResult, orcamentosResult] = await Promise.allSettled([
      supabase
        .from("leads")
        .update({ visto: true, visto_admin: true } as any)
        .eq("id", leadId)
        .eq("tenant_id", tenantId),
      supabase
        .from("orcamentos")
        .update({ visto: true, visto_admin: true } as any)
        .eq("lead_id", leadId)
        .eq("tenant_id", tenantId),
    ]);

    const leadError = leadResult.status === "fulfilled" ? leadResult.value.error : leadResult.reason;
    const orcamentosError = orcamentosResult.status === "fulfilled" ? orcamentosResult.value.error : orcamentosResult.reason;

    if (leadError || orcamentosError) {
      console.warn("[usePropostaRapidaLead] Falha ao marcar lead como visto", {
        leadId,
        leadError,
        orcamentosError,
      });
    }
  }

  async function quickConvertToProposal(lead: QuickLeadData) {
    if (loading) return;
    setLoading(true);
    setLoadingLeadId(lead.id);

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

      // 3. Buscar projeto existente via cliente_id (mais recente primeiro - estabiliza ordem)
      const { data: existingProjetos } = await supabase
        .from("projetos")
        .select("id, deal_id")
        .eq("cliente_id", clienteId!)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1);

      const existingProjeto = existingProjetos?.[0];

      if (existingProjeto) {
        // 3a. Verificar se já tem proposta nativa ativa (não rascunho/expirada)
        const { data: existingPropostas } = await supabase
          .from("propostas_nativas")
          .select("id, status")
          .eq("projeto_id", existingProjeto.id)
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(1);

        const propostaAtiva = existingPropostas?.[0];

        await markLeadAsViewed(lead.id, tenantId);

        if (propostaAtiva) {
          // Proposta já existe → abrir a proposta existente em vez de criar nova
          toast.info("Lead já possui proposta. Abrindo proposta existente...");
          navigate(`/admin/propostas-nativas/${propostaAtiva.id}`);
          return;
        }

        // Projeto existe mas sem proposta → ir para wizard de nova versão
        toast.info("Lead já possui projeto. Abrindo wizard...");
        navigate(
          `/admin/propostas-nativas/nova?deal_id=${existingProjeto.deal_id || existingProjeto.id}&customer_id=${clienteId}&lead_id=${lead.id}`
        );
        return;
      }

      // 4. Resolver pipeline COMERCIAL canônico (deals + projeto_funis em espelho).
      // SSOT: nunca pegar "primeiro por created_at" — ver resolveDefaultCommercialPipeline.
      const resolution = await resolveDefaultCommercialPipeline(tenantId);
      const funilId: string | null = resolution.funilId;
      const etapaId: string | null = resolution.etapaId;
      const pipelineComercial = resolution.pipelineId
        ? { id: resolution.pipelineId }
        : null;
      const dealStageId: string | null = resolution.stageId;

      // 5. Criar projeto PRIMEIRO (deals.projeto_id é NOT NULL)
      const { data: newProjeto, error: projetoError } = await supabase
        .from("projetos")
        .insert({
          cliente_id: clienteId!,
          consultor_id: lead.consultor_id || null,
          funil_id: funilId,
          etapa_id: etapaId,
          status: "criado",
          tenant_id: tenantId,
        } as any)
        .select("id")
        .single();

      if (projetoError) throw projetoError;

      // 6. Criar deal vinculado ao projeto (apenas se pipeline comercial existir)
      let newDealId: string | null = null;
      if (pipelineComercial && dealStageId) {
        const { data: newDeal, error: dealError } = await supabase
          .from("deals")
          .insert({
            pipeline_id: pipelineComercial.id,
            stage_id: dealStageId,
            owner_id: lead.consultor_id || null,
            customer_id: clienteId!,
            projeto_id: newProjeto.id,
            value: lead.valor_estimado || 0,
            title: lead.nome,
            tenant_id: tenantId,
          } as any)
          .select("id")
          .single();

        if (dealError) throw dealError;
        newDealId = newDeal.id;

        // 7. Vincular deal_id de volta ao projeto
        await supabase
          .from("projetos")
          .update({ deal_id: newDealId } as any)
          .eq("id", newProjeto.id);
      }

      await markLeadAsViewed(lead.id, tenantId);

      // Atualizar status do lead para "Convertido" se existir
      const { data: convertidoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Convertido")
        .maybeSingle();

      if (convertidoStatus) {
        await supabase
          .from("leads")
          .update({ status_id: convertidoStatus.id } as any)
          .eq("id", lead.id)
          .eq("tenant_id", tenantId);
      }

      // 8. Perguntar ao usuário: wizard ou kanban?
      toast.success("Projeto criado com sucesso!", {
        description: "Deseja abrir o wizard de proposta ou ver no Kanban?",
        duration: 8000,
        action: {
          label: "Ver no Kanban",
          onClick: () => navigate("/admin/projetos"),
        },
      });

      // Redirecionar ao wizard por padrão
      const wizardDealParam = newDealId || newProjeto.id;
      navigate(
        `/admin/propostas-nativas/nova?deal_id=${wizardDealParam}&customer_id=${clienteId}&lead_id=${lead.id}`
      );
    } catch (err: any) {
      console.error("[usePropostaRapidaLead] Erro:", err);
      toast.error(err.message || "Erro ao criar proposta rápida.");
    } finally {
      setLoading(false);
      setLoadingLeadId(null);
    }
  }

  return { quickConvertToProposal, loading, loadingLeadId };
}
