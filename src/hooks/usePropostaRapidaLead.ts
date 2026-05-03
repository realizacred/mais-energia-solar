/**
 * usePropostaRapidaLead — Fluxo rápido Lead → Cliente → Projeto → Wizard
 * RB-50: Atalho sem burocracia para gerar proposta direto do lead.
 * §16: Query em hook. §23: staleTime obrigatório (N/A — mutation only).
 *
 * Anti-duplicação (2026-05): antes de criar projeto/deal, detecta deal `open`
 * existente para o mesmo cliente_id ou telefone_normalized. Se encontrar,
 * abre modal exigindo decisão explícita (abrir existente OU justificar override).
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { resolveDefaultCommercialPipeline } from "@/services/pipelines/resolveDefaultCommercialPipeline";
import {
  findOpenDealForLeadOrCliente,
  type OpenDealMatch,
} from "@/services/leads/findOpenDealForLeadOrCliente";
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

export interface DuplicateGuardState {
  open: boolean;
  matches: OpenDealMatch[];
  pendingLead: QuickLeadData | null;
}

export function usePropostaRapidaLead() {
  const [loading, setLoading] = useState(false);
  const [loadingLeadId, setLoadingLeadId] = useState<string | null>(null);
  const [duplicateGuard, setDuplicateGuard] = useState<DuplicateGuardState>({
    open: false,
    matches: [],
    pendingLead: null,
  });
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

  /**
   * Executa a criação efetiva de projeto + deal + atualização de status do lead.
   * NÃO checa duplicatas — chame `quickConvertToProposal` para ter o gate.
   */
  async function executeCreateProjetoDeal(
    lead: QuickLeadData,
    tenantId: string,
    clienteId: string,
    overrideContext?: { existing: OpenDealMatch; reason: string }
  ) {
    // Resolver pipeline COMERCIAL canônico (deals + projeto_funis em espelho).
    const resolution = await resolveDefaultCommercialPipeline(tenantId);
    const funilId: string | null = resolution.funilId;
    const etapaId: string | null = resolution.etapaId;
    const pipelineComercial = resolution.pipelineId ? { id: resolution.pipelineId } : null;
    const dealStageId: string | null = resolution.stageId;

    // Criar projeto PRIMEIRO (deals.projeto_id é NOT NULL)
    const { data: newProjeto, error: projetoError } = await supabase
      .from("projetos")
      .insert({
        cliente_id: clienteId,
        consultor_id: lead.consultor_id || null,
        funil_id: funilId,
        etapa_id: etapaId,
        status: "criado",
        tenant_id: tenantId,
      } as any)
      .select("id")
      .single();

    if (projetoError) throw projetoError;

    // Criar deal vinculado
    let newDealId: string | null = null;
    if (pipelineComercial && dealStageId) {
      const { data: newDeal, error: dealError } = await supabase
        .from("deals")
        .insert({
          pipeline_id: pipelineComercial.id,
          stage_id: dealStageId,
          owner_id: lead.consultor_id || null,
          customer_id: clienteId,
          projeto_id: newProjeto.id,
          value: lead.valor_estimado || 0,
          title: lead.nome,
          tenant_id: tenantId,
        } as any)
        .select("id")
        .single();

      if (dealError) throw dealError;
      newDealId = newDeal.id;

      await supabase
        .from("projetos")
        .update({ deal_id: newDealId } as any)
        .eq("id", newProjeto.id);
    }

    await markLeadAsViewed(lead.id, tenantId);

    // Atualizar status do lead para "Convertido"
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

    // Audit log do override (se aplicável) — não bloqueia em caso de erro
    if (overrideContext) {
      try {
        const { data: userResp } = await supabase.auth.getUser();
        const userId = userResp?.user?.id ?? null;
        const userEmail = userResp?.user?.email ?? null;
        await supabase.from("audit_logs").insert({
          tenant_id: tenantId,
          user_id: userId,
          user_email: userEmail,
          acao: "lead_generate_project_duplicate_override",
          tabela: "deals",
          registro_id: newDealId,
          dados_novos: {
            lead_id: lead.id,
            cliente_id: clienteId,
            new_deal_id: newDealId,
            new_projeto_id: newProjeto.id,
            existing_deal_id: overrideContext.existing.deal_id,
            existing_projeto_id: overrideContext.existing.projeto_id,
            existing_owner_id: overrideContext.existing.owner_id,
            existing_pipeline_id: overrideContext.existing.pipeline_id,
            reason: overrideContext.reason,
          },
        } as any);
      } catch (auditErr) {
        console.warn("[usePropostaRapidaLead] Falha ao gravar audit log do override", auditErr);
      }
    }

    toast.success("Projeto criado com sucesso!", {
      description: "Deseja abrir o wizard de proposta ou ver no Kanban?",
      duration: 8000,
      action: {
        label: "Ver no Kanban",
        onClick: () => navigate("/admin/projetos"),
      },
    });

    const wizardDealParam = newDealId || newProjeto.id;
    navigate(
      `/admin/propostas-nativas/nova?deal_id=${wizardDealParam}&customer_id=${clienteId}&lead_id=${lead.id}`
    );
  }

  /**
   * Resolve o cliente do lead (cria se necessário) e retorna { tenantId, clienteId }.
   * Também trata o atalho de "projeto/proposta já existem para este cliente",
   * que é independente do gate de duplicidade aberta (ali damos a melhor UX:
   * abrir a proposta/projeto já existente do mesmo lead).
   */
  async function resolveOrCreateCliente(lead: QuickLeadData) {
    const { tenantId } = await getCurrentTenantId();

    const { data: existingCliente } = await supabase
      .from("clientes")
      .select("id")
      .eq("lead_id", lead.id)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    let clienteId = existingCliente?.id as string | undefined;

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
          cliente_code: `CLI-${Date.now()}`,
        } as any)
        .select("id")
        .single();

      if (clienteError) throw clienteError;
      clienteId = newCliente.id;
    }

    return { tenantId, clienteId: clienteId! };
  }

  async function quickConvertToProposal(lead: QuickLeadData) {
    if (loading) return;
    setLoading(true);
    setLoadingLeadId(lead.id);

    try {
      const { tenantId, clienteId } = await resolveOrCreateCliente(lead);

      // Atalho legado: se este lead já tem projeto vinculado ao mesmo cliente,
      // direciona para o existente (proposta/wizard) em vez de duplicar.
      const { data: existingProjetos } = await supabase
        .from("projetos")
        .select("id, deal_id")
        .eq("cliente_id", clienteId)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(1);

      const existingProjeto = existingProjetos?.[0];
      if (existingProjeto) {
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
          toast.info("Lead já possui proposta. Abrindo proposta existente...");
          navigate(`/admin/propostas-nativas/${propostaAtiva.id}`);
          return;
        }

        toast.info("Lead já possui projeto. Abrindo wizard...");
        navigate(
          `/admin/propostas-nativas/nova?deal_id=${existingProjeto.deal_id || existingProjeto.id}&customer_id=${clienteId}&lead_id=${lead.id}`
        );
        return;
      }

      // GATE anti-duplicação: deal `open` para o mesmo cliente OU mesmo telefone normalizado.
      const matches = await findOpenDealForLeadOrCliente({
        tenantId,
        clienteId,
        telefone: lead.telefone,
      });

      if (matches.length > 0) {
        // Não cria. Abre o modal pedindo decisão.
        setDuplicateGuard({ open: true, matches, pendingLead: lead });
        return;
      }

      await executeCreateProjetoDeal(lead, tenantId, clienteId);
    } catch (err: any) {
      console.error("[usePropostaRapidaLead] Erro:", err);
      toast.error(err.message || "Erro ao criar proposta rápida.");
    } finally {
      setLoading(false);
      setLoadingLeadId(null);
    }
  }

  /** Override: usuário confirmou criar mesmo assim, com justificativa. */
  async function confirmCreateAnyway(reason: string) {
    const lead = duplicateGuard.pendingLead;
    const existing = duplicateGuard.matches[0];
    if (!lead || !existing) {
      setDuplicateGuard({ open: false, matches: [], pendingLead: null });
      return;
    }
    setLoading(true);
    setLoadingLeadId(lead.id);
    try {
      const { tenantId, clienteId } = await resolveOrCreateCliente(lead);
      await executeCreateProjetoDeal(lead, tenantId, clienteId, { existing, reason });
    } catch (err: any) {
      console.error("[usePropostaRapidaLead] Erro override:", err);
      toast.error(err.message || "Erro ao criar projeto.");
    } finally {
      setLoading(false);
      setLoadingLeadId(null);
      setDuplicateGuard({ open: false, matches: [], pendingLead: null });
    }
  }

  function openExistingDeal(match: OpenDealMatch) {
    setDuplicateGuard({ open: false, matches: [], pendingLead: null });
    if (match.projeto_id) {
      navigate(`/admin/projetos/${match.projeto_id}`);
    } else if (match.deal_id) {
      navigate(`/admin/projetos?deal_id=${match.deal_id}`);
    }
  }

  function cancelDuplicateGuard() {
    setDuplicateGuard({ open: false, matches: [], pendingLead: null });
  }

  return {
    quickConvertToProposal,
    loading,
    loadingLeadId,
    duplicateGuard,
    confirmCreateAnyway,
    openExistingDeal,
    cancelDuplicateGuard,
  };
}
