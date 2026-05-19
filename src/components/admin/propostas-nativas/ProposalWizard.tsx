import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  ChevronLeft, ChevronRight, Check, AlertCircle, AlertTriangle, 
  RefreshCw, Link2, SunMedium, Zap, DollarSign, MapPin, 
  ClipboardList, Info, SwitchCamera, LayoutGrid, FileText,
  User, CreditCard, Settings2, History, Send, Download, Clipboard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useBrandSettings } from "@/components/BrandSettingsProvider";
import { useAuth } from "@/hooks/useAuth";
import { useDevToolsContext } from "@/contexts/DevToolsContext";
import { formatBRLInteger as formatBRL, formatNumberBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

import { useProposalEnforcement } from "./wizard/useProposalEnforcement";
import { useSolarBrainSync } from "./wizard/useSolarBrainSync";
import { useWizardDataLoaders } from "./wizard/useWizardDataLoaders";
import { validateGrupoConsistency } from "./wizard/validateGrupoConsistency";
import { ProposalAuditPanel } from "./wizard/ProposalAuditPanel";
import { PreGenerationGateModal } from "./wizard/PreGenerationGateModal";
import { MissingVariablesModal } from "./wizard/MissingVariablesModal";
import { DialogPosDimensionamento } from "./wizard/DialogPosDimensionamento";
import { PropostaBadge } from "./PropostaBadge";

import type { ProposalResolverContext, TariffVersionContext, GenerateProposalPayload } from "./wizard/types";

const STEP_KEYS = {
  LOCALIZACAO: "localizacao",
  UCS: "ucs",
  CAMPOS_PRE: "campos_pre",
  KIT: "kit",
  ADICIONAIS: "adicionais",
  SERVICOS: "servicos",
  VENDA: "venda",
  PAGAMENTO: "pagamento",
  RESUMO: "resumo",
  PROPOSTA: "proposta",
};

export function ProposalWizard() {
  const { proposalId: propostaIdFromUrl, versionId: versaoIdFromUrl } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get("dealId");
  const customerIdFromUrl = searchParams.get("customerId");
  const leadIdFromUrl = searchParams.get("leadId");
  const orcIdFromUrl = searchParams.get("orcId");
  
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdminOrGerente = user?.role === "admin" || user?.role === "gerente";

  const {
    cliente, setCliente, projectAddress, setProjectAddress,
    ucs, setUcs, handleUCsChange, premissas, setPremissas,
    preDimensionamento, setPreDimensionamento, layouts, manualKits,
    adicionais, customFieldValues, setCustomFieldValues,
    nomeProposta, setNomeProposta, descricaoProposta, setDescricaoProposta,
    templateSelecionado, setTemplateSelecionado, locSkipPoa, locLatitude,
    locGhiSeries, locDistribuidoraId, setLocDistribuidoraId,
    locDistribuidoraNome, setLocDistribuidoraNome,
    geracaoMensalEstimada, pagamentoOpcoes,
    step, setStep, activeSteps, canCurrentStep: canCurrentStepFromHook, isLastStep: isLastStepFromHook,
    goToStep, goNext, goPrev,
    saving, isRestoring, savedPropostaId, setSavedPropostaId,
    savedVersaoId, setSavedVersaoId, savedProjetoId, setSavedProjetoId,
    savedDealId, setSavedDealId, savedClienteId, setSavedClienteId,
    officialTotal, setOfficialTotal, officialTemplateId, setOfficialTemplateId,
    hasEditsAfterRestore, setHasEditsAfterRestore,
    proposalStatus, setProposalStatus, editingsentProposal,
    showNewVersionConfirm, setShowNewVersionConfirm,
    pendingUpdateAction, setPendingUpdateAction,
    showPosDialog, setShowPosDialog, showGateModal, setShowGateModal,
    gateValidation, 
    blockReason, setBlockReason, blockMissing, setBlockMissing,
    showBlockModal, setShowBlockModal,
    generationStatus, setGenerationStatus, generationError, setGenerationError,
    rendering, setRendering, generating, setGenerating,
    pdfBlobUrl, setPdfBlobUrl, htmlPreview, setHtmlPreview,
    result, setResult, debugMode, setDebugMode,
    locCidade, setLocCidade, locEstado, setLocEstado,
    locTipoTelhado, setLocTipoTelhado,
    precoFinal, potenciaKwp, setPotenciaKwp,
    itens, servicos, venda,
    clienteMunicipioIbgeCodigo, setClienteMunicipioIbgeCodigo,
    projectContext, setProjectContext,
    selectedLead, setSelectedLead,
    persistAtomic, buildPersistParams, invalidateProposalCaches,
    generateProposal, renderProposal, savePricingHistory,
    normalizeTopologyValue, mapLeadTipoTelhadoToProposal,
    collectSnapshot, currentStepKey,
    handleUpdate, handlePosDialogConfirm, handleGateConfirmed,
    consumoTotal, grupo, proposalTemplates, pdfBlob, setPdfBlobUrl: setPdfBlobUrlReal,
    setOutputPdfPath, setOutputDocxPath, setExternalPdfUrl, setDocxBlob,
    clearLocal, syncTemplateIdUsed, syncCustomFieldValues,
    saveCustomFieldsMutation,
  } = useWizardDataLoaders({ 
    propostaId: propostaIdFromUrl, 
    versaoId: versaoIdFromUrl,
    dealId: dealIdFromUrl,
    customerId: customerIdFromUrl,
    leadId: leadIdFromUrl,
    orcId: orcIdFromUrl
  });

  const ClientContextPanel = useMemo(() => {
    if (!selectedLead) return null;
    const geracao = selectedLead.geracao_estimada_kwh;
    const consumo = selectedLead.media_consumo;
    const telhado = selectedLead.tipo_telhado;
    const fase = selectedLead.rede_atendimento;
    const cidade = selectedLead.cidade;
    const uf = selectedLead.estado;
    const obsLead = selectedLead.observacoes;
    const obsOrc = selectedLead.orc_observacoes;
    const source = selectedLead.source_type || "lead";

    return (
      <div className="bg-card border-b border-border shadow-sm sticky top-0 z-20 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold py-0 h-5">
                {source === "orcamento" ? "Orçamento" : "Lead"}
