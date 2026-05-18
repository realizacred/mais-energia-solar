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
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";
import { toast } from "sonner";

/** Dados mínimos necessários para conversão rápida */
export interface QuickLeadData {
  id: string;
  nome: string;
  telefone: string;
  telefone_normalized?: string | null;
  email?: string | null;
  cpf_cnpj?: string | null;
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
   * Executa a criação atômica de Cliente + Projeto + Deal via RPC.
   * RB-76: Unificação com convert_lead_to_venda_v2.
   */
  async function executeUnifiedConversion(
    lead: QuickLeadData,
    overrideContext?: { existing: OpenDealMatch; reason: string }
  ) {
    const rapidPayload = {
      _lead_id: lead.id,
      _payload: {
        nome: lead.nome,
        telefone: lead.telefone,
        email: lead.email,
        cpf_cnpj: lead.cpf_cnpj ?? null,
        cep: lead.cep ?? null,
        rua: lead.rua ?? null,
        bairro: lead.bairro ?? null,
        cidade: lead.cidade ?? null,
        estado: lead.estado ?? null,
        consultor_id: lead.consultor_id ?? null,
        valor_projeto: lead.valor_estimado ?? 0,
      },
      _payment_composition: [], // sem pagamento na proposta rápida
      _idempotency_key: lead.id + "_rapida",
    };

    const { data, error } = await supabase.rpc(
      "convert_lead_to_venda_v2",
      rapidPayload
    );

    if (error) throw error;

    const response = data as any;
    const clienteId = response.cliente_id || response.id;
    const projetoId = response.projeto_id;
    const dealId = response.deal_id;

    if (!projetoId) {
      throw new Error("Falha ao gerar projeto na conversão unificada.");
    }

    // Audit log do override removido - Triggers automáticos do banco tratam a auditoria
    if (overrideContext) {
      console.log("[usePropostaRapidaLead] Override context detected. Audit will be handled by DB triggers.");
    }

    toast.success("Projeto preparado com sucesso!", {
      description: "Abrindo wizard de proposta...",
      duration: 3000,
    });

    const wizardDealParam = dealId || projetoId;
    navigate(
      `/admin/propostas-nativas/nova?projeto_id=${projetoId}&deal_id=${wizardDealParam}&customer_id=${clienteId}&lead_id=${lead.id}`
    );
  }

  /**
   * Resolve o cliente do lead (usado agora apenas para checagem de duplicidade antes do RPC)
   * RB-76/RB-62: Vínculo lead->cliente SEMPRE por telefone normalizado. NUNCA por nome.
   */
  async function pickExistingClienteId(lead: QuickLeadData, tenantId: string) {
    const telefoneLimpo = lead.telefone_normalized || toCanonicalPhoneDigits(lead.telefone);

    // 1. Check by explicit lead_id mapping
    const byLead = await supabase
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("lead_id", lead.id)
      .maybeSingle();
    if (byLead.data?.id) return byLead.data.id;

    // 2. Check by normalized phone (Source of Truth)
    if (telefoneLimpo) {
      const byPhone = await supabase
        .from("clientes")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("telefone_normalized", telefoneLimpo)
        .maybeSingle();
      if (byPhone.data?.id) return byPhone.data.id;
    }

    return null;
  }

  async function quickConvertToProposal(lead: QuickLeadData) {
    if (loading) return;
    setLoading(true);
    setLoadingLeadId(lead.id);

    try {
      const { tenantId } = await getCurrentTenantId();
      const clienteId = await pickExistingClienteId(lead, tenantId);

      // Atalho: se este lead já tem projeto vinculado ao mesmo cliente,
      // direciona para o existente (proposta/wizard) em vez de duplicar.
      if (clienteId) {
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
            `/admin/propostas-nativas/nova?projeto_id=${existingProjeto.id}&deal_id=${existingProjeto.deal_id || existingProjeto.id}&customer_id=${clienteId}&lead_id=${lead.id}`
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
          setDuplicateGuard({ open: true, matches, pendingLead: lead });
          return;
        }
      }

      await executeUnifiedConversion(lead);
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
      await executeUnifiedConversion(lead, { existing, reason });
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
