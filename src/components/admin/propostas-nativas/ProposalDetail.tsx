/**
 * ProposalDetail.tsx
 * 
 * Refactored: Composition-only component.
 * - ZERO supabase calls (all in services/hooks)
 * - ZERO business logic (all in useProposalActions)
 * - Uses ProposalViewModel as SSOT via useProposalDetail
 * - Delegates UI sections to sub-components
 */

import { useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Info, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { formatBRL } from "@/lib/formatters";
import { formatKwp, formatKwhValue } from "@/lib/formatters/index";
import { formatDateTime, formatDate } from "@/lib/dateUtils";

// Domain
import type { ProposalViewModel } from "@/domain/proposal/ProposalViewModel";

// Hooks (§16 — queries ONLY in hooks)
import { useProposalDetail } from "@/hooks/useProposalDetail";
import { useProposalActions } from "@/hooks/useProposalActions";

// Sub-components (pure UI)
import { ProposalHeader } from "./detail/ProposalHeader";
import { ProposalKpis } from "./detail/ProposalKpis";
import { ProposalStatusActions } from "./detail/ProposalStatusActions";
import { ProposalViewsCard } from "./ProposalViewsCard";
import { GenerateFileDialog } from "./GenerateFileDialog";
import { ProposalAnalysis } from "./ProposalAnalysis";
import { ProposalActionCards } from "./ProposalActionCards";

export function ProposalDetail() {
  const { propostaId, versaoId } = useParams();
  const navigate = useNavigate();

  // ─── Data via hook (SSOT) ───────────────────────────────
  const {
    vm, propostaRaw, html, publicUrl, existingOs,
    isLoading, refetch,
  } = useProposalDetail(versaoId);

  // ─── Actions via hook (mutations) ───────────────────────
  const actions = useProposalActions({ versaoId, propostaRaw, vm });

  // ─── Local UI state only ────────────────────────────────
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [validadeDialogOpen, setValidadeDialogOpen] = useState(false);
  const [validadeDate, setValidadeDate] = useState("");

  // ─── Navigation ─────────────────────────────────────────
  const navigateToEdit = useCallback(() => {
    const params = new URLSearchParams();
    if (propostaRaw?.deal_id) params.set("deal_id", propostaRaw.deal_id);
    if (propostaRaw?.cliente_id) params.set("customer_id", propostaRaw.cliente_id);
    if (propostaRaw?.id) params.set("proposta_id", propostaRaw.id);
    if (versaoId) params.set("versao_id", versaoId);
    navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
  }, [versaoId, propostaRaw, navigate]);

  const formattedDate = (d: string | null) => {
    if (!d) return null;
    try { return formatDateTime(d); } catch { return null; }
  };

  // ─── Loading state ──────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
        </div>
      </div>
    );
  }

  if (!vm) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Versão não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>Voltar</Button>
      </div>
    );
  }

  // ─── Template vars for action cards ─────────────────────
  const templateVars = (() => {
    const s = vm.snapshot;
    const numMods = s.itens
      .filter(i => i.categoria === "modulo" || i.categoria === "modulos")
      .reduce((sum, m) => sum + m.quantidade, 0);
    const invs = s.itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");
    const modeloInv = invs.length > 0 ? `${invs[0].fabricante} ${invs[0].modelo}`.trim() : "";
    return {
      cliente_nome: vm.clienteNome,
      tipo_instalacao: s.locTipoTelhado,
      potencia_kwp: String(vm.potenciaKwp),
      numero_modulos: String(numMods),
      modelo_inversor: modeloInv,
      consumo_mensal: String(s.consumoTotal),
      geracao_mensal: String(vm.geracaoMensal),
      valor_total: formatBRL(vm.valorTotal),
      economia_mensal: formatBRL(vm.economiaMensal),
      payback_meses: String(vm.paybackMeses),
      proposta_link: publicUrl || "(link será gerado no envio)",
      empresa_nome: "",
    };
  })();

  return (
    <div className="space-y-6">
      {/* ══════════ HEADER ══════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <ProposalHeader vm={vm} clienteNome={propostaRaw?.cliente_id ? vm.clienteNome : null} />
        <ProposalStatusActions
          vm={vm}
          existingOs={existingOs}
          updatingStatus={actions.updateStatus.isPending}
          generatingOs={actions.generateOs.isPending}
          onUpdateStatus={(newStatus, extra) => actions.updateStatus.mutate({ newStatus, extra })}
          onGenerateOs={() => actions.generateOs.mutate()}
        />
      </div>

      {/* ══════════ SNAPSHOT CHANGED ALERT ══════════ */}
      {vm.snapshot._raw._snapshotChanged && (
        <div className="flex items-center gap-3 bg-warning/10 border border-warning/30 rounded-lg px-4 py-3">
          <Info className="h-5 w-5 text-warning shrink-0" />
          <div>
            <p className="text-sm font-semibold text-warning">Atenção</p>
            <p className="text-xs text-warning/80">O dimensionamento foi atualizado após a geração do arquivo. Gere um novo arquivo se necessário.</p>
          </div>
        </div>
      )}

      {/* ══════════ KPI STRIP ══════════ */}
      <ProposalKpis vm={vm} />

      {/* ══════════ 3-COL ACTION CARDS ══════════ */}
      <ProposalActionCards
        navigateToEdit={navigateToEdit}
        isFinalized={vm.isFinalized}
        cloning={false}
        lastEditDate={vm.atualizadoEm}
        html={html || (vm.linkPdf ? "__imported__" : null)}
        rendering={actions.render.isPending}
        onGenerateFile={() => setGenerateDialogOpen(true)}
        onCopyLink={(withTracking) => actions.copyLink.mutate(withTracking)}
        onDownloadPdf={() => { if (html) actions.downloadPdf.mutate(html); else if (vm.linkPdf) window.open(vm.linkPdf, "_blank"); }}
        linkPdf={vm.linkPdf}
        onRender={() => actions.render.mutate()}
        publicUrl={publicUrl}
        downloadingPdf={actions.downloadPdf.isPending}
        validoAte={vm.validoAte}
        onEditValidade={() => {
          setValidadeDate(vm.validoAte ? new Date(vm.validoAte).toISOString().split("T")[0] : "");
          setValidadeDialogOpen(true);
        }}
        lastGeneratedAt={vm.geradoEm}
        currentStatus={vm.businessStatus}
        sending={actions.send.isPending || actions.sendEmail.isPending}
        onSendWhatsapp={(opts) => actions.send.mutate({ canal: "whatsapp", ...opts })}
        onSendEmail={() => actions.sendEmail.mutate()}
        templateVars={templateVars}
        onScrollToTracking={() => {
          const el = document.getElementById("proposal-tracking");
          el?.scrollIntoView({ behavior: "smooth" });
        }}
        formattedDate={formattedDate}
      />

      {/* ══════════ ANÁLISE DA PROPOSTA ══════════ */}
      <ProposalAnalysis
        potenciaKwp={vm.potenciaKwp}
        geracaoMensal={vm.geracaoMensal}
        totalFinal={vm.valorTotal}
        wpPrice={vm.wpPrice > 0 ? vm.wpPrice.toFixed(2) : null}
        custoKit={vm.snapshot.custoKit}
        custoInstalacao={vm.snapshot.venda.custo_instalacao}
        custoComissao={vm.snapshot.venda.custo_comissao}
        custoTotal={vm.custoTotal}
        lucroTotal={vm.lucroTotal}
        margemPct={vm.margemPct}
        kitItems={vm.snapshot.itens}
        snapshot={vm.snapshot}
        paybackText={vm.paybackText}
        economiaMensal={vm.economiaMensal}
      />

      {/* ══════════ TRACKING PANEL ══════════ */}
      <div id="proposal-tracking">
        {vm.propostaId && (
          <ProposalViewsCard
            propostaId={vm.propostaId}
            versaoId={versaoId}
            statusVisualizacao={propostaRaw?.status_visualizacao}
            primeiroAcessoEm={propostaRaw?.primeiro_acesso_em}
            ultimoAcessoEm={propostaRaw?.ultimo_acesso_em}
            totalAberturas={propostaRaw?.total_aberturas}
          />
        )}
      </div>

      {/* ══════════ GENERATE FILE DIALOG ══════════ */}
      {versaoId && vm.propostaId && (
        <GenerateFileDialog
          open={generateDialogOpen}
          onOpenChange={setGenerateDialogOpen}
          versaoId={versaoId}
          propostaId={vm.propostaId}
          onGenerated={() => refetch()}
          initialTemplateId={vm.snapshot.templateSelecionado || undefined}
        />
      )}

      {/* ══════════ VALIDADE DIALOG ══════════ */}
      <Dialog open={validadeDialogOpen} onOpenChange={setValidadeDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Alterar validade da proposta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <DateInput
              value={validadeDate}
              onChange={setValidadeDate}
              className="text-sm"
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button variant="ghost" onClick={() => setValidadeDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  actions.updateValidade.mutate(validadeDate, {
                    onSuccess: () => setValidadeDialogOpen(false),
                  });
                }}
                disabled={!validadeDate || actions.updateValidade.isPending}
              >
                {actions.updateValidade.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Alterar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
