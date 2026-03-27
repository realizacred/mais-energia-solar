/**
 * useProposalActions.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §17: Lógica de negócio em services, hooks orquestram
 * 
 * Hook com mutations para todas as ações da proposta.
 * Status transitions are now backend-driven via edge function.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters";
import { renderProposal, sendProposal } from "@/services/proposalApi";
import { getPublicUrl } from "@/lib/getPublicUrl";
import {
  transitionProposalStatus,
  generateOs as svcGenerateOs,
  getOrCreateProposalToken,
  updateValidade as svcUpdateValidade,
} from "@/services/proposal/proposalDetail.service";
import type { ProposalViewModel } from "@/domain/proposal/ProposalViewModel";

interface UseProposalActionsParams {
  versaoId: string | undefined;
  propostaRaw: Record<string, any> | null;
  vm: ProposalViewModel | null;
}

export function useProposalActions({ versaoId, propostaRaw, vm }: UseProposalActionsParams) {
  const qc = useQueryClient();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["proposal-detail", versaoId] });
  };

  // ─── Transition Status (backend-driven) ─────────────────

  const statusMutation = useMutation({
    mutationFn: async ({ newStatus, extra }: { newStatus: string; extra?: { motivo?: string; data?: string } }) => {
      if (!propostaRaw?.id) throw new Error("Proposta não carregada");
      return transitionProposalStatus(propostaRaw.id, newStatus, extra);
    },
    onSuccess: (result) => {
      const labels: Record<string, string> = {
        aceita: "Aceita", recusada: "Recusada", enviada: "Enviada", cancelada: "Cancelada",
        vista: "Vista", gerada: "Gerada",
      };
      toast({ title: `Proposta marcada como "${labels[result.new_status] || result.new_status}"` });

      if (result.commission_pct && result.new_status === "aceita" && vm) {
        toast({
          title: "Comissão gerada automaticamente!",
          description: `${result.commission_pct}% sobre ${formatBRL(vm.valorTotal)}`,
        });
      }

      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    },
  });

  // ─── Send Proposal ─────────────────────────────────────

  const sendMutation = useMutation({
    mutationFn: async (params: { canal: "link" | "whatsapp"; template_id?: string; mensagem_custom?: string }) => {
      if (!propostaRaw?.id || !versaoId) throw new Error("Proposta não carregada");
      return sendProposal({
        proposta_id: propostaRaw.id,
        versao_id: versaoId,
        canal: params.canal,
        lead_id: propostaRaw.lead_id,
        template_id: params.template_id,
        mensagem_custom: params.mensagem_custom,
      });
    },
    onSuccess: (result, params) => {
      toast({
        title: params.canal === "whatsapp" && result.whatsapp_sent
          ? "Proposta enviada via WhatsApp! ✅"
          : "Link gerado com sucesso!",
      });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    },
  });

  // ─── Send Email ─────────────────────────────────────────

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!propostaRaw?.id || !versaoId) throw new Error("Proposta não carregada");
      return sendProposal({
        proposta_id: propostaRaw.id,
        versao_id: versaoId,
        canal: "email" as any,
        lead_id: propostaRaw.lead_id,
      });
    },
    onSuccess: () => {
      toast({ title: "Proposta enviada por email!" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao enviar email", description: err.message, variant: "destructive" });
    },
  });

  // ─── Render (HTML) ──────────────────────────────────────

  const renderMutation = useMutation({
    mutationFn: async () => {
      if (!versaoId) throw new Error("Versão não carregada");
      return renderProposal(versaoId);
    },
    onSuccess: () => {
      toast({ title: "Proposta renderizada!" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  // ─── Generate OS ────────────────────────────────────────

  const osMutation = useMutation({
    mutationFn: async () => {
      if (!propostaRaw?.id || !versaoId || !vm) throw new Error("Dados incompletos");
      return svcGenerateOs({
        propostaId: propostaRaw.id,
        versaoId,
        projetoId: propostaRaw.projeto_id || null,
        clienteId: propostaRaw.cliente_id || null,
        potenciaKwp: vm.potenciaKwp,
        valorTotal: vm.valorTotal,
        cidade: vm.snapshot.locCidade || null,
        estado: vm.snapshot.locEstado || null,
      });
    },
    onSuccess: (os: any) => {
      toast({ title: "✅ OS de Instalação gerada", description: `Número: ${os?.numero_os}` });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar OS", description: err.message, variant: "destructive" });
    },
  });

  // ─── Copy Link ──────────────────────────────────────────

  const copyLinkMutation = useMutation({
    mutationFn: async (withTracking: boolean) => {
      if (!propostaRaw?.id || !versaoId) throw new Error("Proposta não carregada");
      const tipo = withTracking ? "tracked" : "public";
      const token = await getOrCreateProposalToken(propostaRaw.id, versaoId, tipo);
      const url = `${getPublicUrl()}/proposta/${token}`;
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        window.prompt("Copie o link abaixo:", url);
      }
      return { withTracking, url };
    },
    onSuccess: ({ withTracking }) => {
      toast({
        title: withTracking ? "Link rastreável copiado! 🔗" : "Link sem rastreio copiado! 🔗",
      });
    },
    onError: (err: Error) => {
      toast({ title: `Erro ao gerar link: ${err.message}`, variant: "destructive" });
    },
  });

  // ─── Update Validade ────────────────────────────────────

  const validadeMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!versaoId) throw new Error("Versão não carregada");
      await svcUpdateValidade(versaoId, date);
    },
    onSuccess: () => {
      toast({ title: "Validade atualizada!" });
      invalidate();
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao atualizar", description: err.message, variant: "destructive" });
    },
  });

  // ─── Download PDF (client-side via jsPDF) ───────────────

  const downloadPdfMutation = useMutation({
    mutationFn: async (html: string) => {
      const { default: jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const container = document.createElement("div");
      container.innerHTML = html;
      container.style.width = "800px";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);
      await doc.html(container, {
        callback: (pdf) => {
          pdf.save(`${vm?.codigo || "proposta"}_v${vm?.versaoNumero || 1}.pdf`);
          document.body.removeChild(container);
        },
        x: 10, y: 10, width: 190, windowWidth: 800,
      });
    },
    onSuccess: () => {
      toast({ title: "PDF gerado com sucesso!" });
    },
    onError: (err: Error) => {
      toast({ title: "Erro ao gerar PDF", description: err.message, variant: "destructive" });
    },
  });

  return {
    updateStatus: statusMutation,
    send: sendMutation,
    sendEmail: sendEmailMutation,
    render: renderMutation,
    generateOs: osMutation,
    copyLink: copyLinkMutation,
    updateValidade: validadeMutation,
    downloadPdf: downloadPdfMutation,
  };
}
