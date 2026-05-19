import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import {
  type LeadSelection, type ClienteData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type LayoutArranjo, type PreDimensionamentoData, type ComercialData,
  EMPTY_CLIENTE, EMPTY_COMERCIAL, DEFAULT_PREMISSAS, DEFAULT_PRE_DIMENSIONAMENTO, createEmptyUC,
  redeAtendimentoToFaseTensao, mapLeadTipoTelhadoToProposal,
} from "./types";
import { type AdicionalItem } from "./StepAdicionais";
import { useTenantTarifas, applyTenantTarifasToUC } from "./useWizardDataLoaders";


type GenerationStatus = "idle" | "calculating" | "publishing" | "published" | "ready_web" | "rendering_pdf" | "ready" | "docx_only" | "error" | "generating_docx" | "converting_pdf" | "saving";

interface WizardContextType {
  // Shared state
  selectedLead: LeadSelection | null;
  setSelectedLead: (lead: LeadSelection | null) => void;
  cliente: ClienteData;
  setCliente: React.Dispatch<React.SetStateAction<ClienteData>>;
  clienteMunicipioIbgeCodigo: string | null;
  setClienteMunicipioIbgeCodigo: (code: string | null) => void;

  // Location & Project
  locEstado: string;
  setLocEstado: (uf: string) => void;
  locCidade: string;
  setLocCidade: (cidade: string) => void;
  locTipoTelhado: string;
  setLocTipoTelhado: (tipo: string) => void;
  locDistribuidoraId: string;
  setLocDistribuidoraId: (id: string) => void;
  locDistribuidoraNome: string;
  setLocDistribuidoraNome: (nome: string) => void;
  locIrradiacao: number;
  setLocIrradiacao: (val: number) => void;
  locGhiSeries: Record<string, number> | null;
  setLocGhiSeries: React.Dispatch<React.SetStateAction<Record<string, number> | null>>;
  locSkipPoa: boolean;
  setLocSkipPoa: React.Dispatch<React.SetStateAction<boolean>>;
  locLatitude: number | null;
  setLocLatitude: React.Dispatch<React.SetStateAction<number | null>>;
  mapSnapshots: string[];
  setMapSnapshots: React.Dispatch<React.SetStateAction<string[]>>;
  distanciaKm: number;
  setDistanciaKm: React.Dispatch<React.SetStateAction<number>>;
  projectAddress: any;
  setProjectAddress: React.Dispatch<React.SetStateAction<any>>;

  // UCs & Dimensionamento
  ucs: UCData[];
  setUcs: React.Dispatch<React.SetStateAction<UCData[]>>;
  ucsRestoreEpoch: number;
  bumpUcsRestoreEpoch: () => void;
  grupo: string;
  setGrupo: (g: string) => void;
  subgrupo: string;
  setSubgrupo: (s: string) => void;
  potenciaKwp: number;
  setPotenciaKwp: (p: number) => void;

  // Kit & Adicionais
  itens: KitItemRow[];
  setItens: React.Dispatch<React.SetStateAction<KitItemRow[]>>;
  manualKits: any[];
  setManualKits: React.Dispatch<React.SetStateAction<any[]>>;
  selectedManualIdx: number | null;
  setSelectedManualIdx: (idx: number | null) => void;
  layouts: LayoutArranjo[];
  setLayouts: React.Dispatch<React.SetStateAction<LayoutArranjo[]>>;
  adicionais: AdicionalItem[];
  setAdicionais: React.Dispatch<React.SetStateAction<AdicionalItem[]>>;
  preDimensionamento: PreDimensionamentoData;
  setPreDimensionamento: React.Dispatch<React.SetStateAction<PreDimensionamentoData>>;

  // Premissas & Services
  premissas: PremissasData;
  setPremissas: React.Dispatch<React.SetStateAction<PremissasData>>;
  servicos: ServicoItem[];
  setServicos: React.Dispatch<React.SetStateAction<ServicoItem[]>>;

  // Venda & Financial
  venda: VendaData;
  setVenda: React.Dispatch<React.SetStateAction<VendaData>>;
  pagamentoOpcoes: PagamentoOpcao[];
  setPagamentoOpcoes: React.Dispatch<React.SetStateAction<PagamentoOpcao[]>>;

  // Custom fields (pre_dimensionamento)
  customFieldValues: Record<string, any>;
  setCustomFieldValues: React.Dispatch<React.SetStateAction<Record<string, any>>>;

  // Document & Status
  templateSelecionado: string;
  setTemplateSelecionado: (id: string) => void;
  generationStatus: GenerationStatus;
  setGenerationStatus: React.Dispatch<React.SetStateAction<GenerationStatus>>;

  // Edit Accepted Proposal
  editAceitaDialogOpen: boolean;
  setEditAceitaDialogOpen: (open: boolean) => void;
  editAceitaMotivo: string;
  setEditAceitaMotivo: (motivo: string) => void;

  // Handlers (combined cross-state side effects)
  handleItensChange: (nextItens: KitItemRow[], nextOverride?: number | null) => void;
  handleUCsChange: (nextUcs: UCData[] | ((prev: UCData[]) => UCData[])) => void;
  handleVendaChange: (nextVenda: VendaData) => void;
  handleSelectLead: (lead: LeadSelection) => void;
  handleLocTipoTelhadoChange: (v: string) => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

export function WizardProvider({ children, initialData = {} }: { children: React.ReactNode; initialData?: any }) {
  // We mirror the state from ProposalWizard.tsx here
  const [selectedLead, setSelectedLead] = useState<LeadSelection | null>(null);
  const [cliente, setCliente] = useState<ClienteData>(EMPTY_CLIENTE);
  const [clienteMunicipioIbgeCodigo, setClienteMunicipioIbgeCodigo] = useState<string | null>(null);

  const [locEstado, setLocEstado] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locTipoTelhado, setLocTipoTelhado] = useState("");
  const [locDistribuidoraId, setLocDistribuidoraId] = useState("");
  const [locDistribuidoraNome, setLocDistribuidoraNome] = useState("");
  const [locIrradiacao, setLocIrradiacao] = useState<number>(0);
  const [locGhiSeries, setLocGhiSeries] = useState<Record<string, number> | null>(null);
  const [locSkipPoa, setLocSkipPoa] = useState(true);
  const [locLatitude, setLocLatitude] = useState<number | null>(null);
  const [mapSnapshots, setMapSnapshots] = useState<string[]>([]);
  const [distanciaKm, setDistanciaKm] = useState<number>(0);
  const [projectAddress, setProjectAddress] = useState({
    cep: "", rua: "", numero: "", complemento: "",
    bairro: "", cidade: "", uf: "", lat: null, lon: null,
  });

  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [ucsRestoreEpoch, setUcsRestoreEpoch] = useState(0);
  const bumpUcsRestoreEpoch = useCallback(() => setUcsRestoreEpoch(e => e + 1), []);
  const [grupo, setGrupo] = useState("B");
  const [subgrupo, setSubgrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);
  const [manualKits, setManualKits] = useState<any[]>([]);
  const [selectedManualIdx, setSelectedManualIdx] = useState<number | null>(null);
  const [layouts, setLayouts] = useState<LayoutArranjo[]>([]);
  const [adicionais, setAdicionais] = useState<AdicionalItem[]>([]);
  const [preDimensionamento, setPreDimensionamento] = useState<PreDimensionamentoData>(DEFAULT_PRE_DIMENSIONAMENTO);

  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);
  const [servicos, setServicos] = useState<ServicoItem[]>([]);

  const [venda, setVenda] = useState<VendaData>({
    custo_kit: 0, custo_instalacao: 0, custo_comissao: 0, custo_outros: 0,
    margem_percentual: 20, desconto_percentual: 0, observacoes: "",
  });

  const [pagamentoOpcoes, setPagamentoOpcoes] = useState<PagamentoOpcao[]>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");

  const [editAceitaDialogOpen, setEditAceitaDialogOpen] = useState(false);
  const [editAceitaMotivo, setEditAceitaMotivo] = useState("");

  // Tenant tariff defaults (used by handleUCsChange and to seed location defaults)
  const tenantTarifas = useTenantTarifas();

  const calcKitCostFromItems = useCallback((rows: KitItemRow[]) => {
    return Math.round(rows.reduce((s, i) => s + ((Number(i.quantidade) || 0) * (Number(i.preco_unitario) || 0)), 0) * 100) / 100;
  }, []);

  const handleItensChange = useCallback((
    nextItens: KitItemRow[],
    nextOverride?: number | null,
  ) => {
    const nextCustoKit = calcKitCostFromItems(nextItens);
    setItens(nextItens);
    setVenda(prev => {
      const overrideValue = nextOverride != null && nextOverride > 0 ? nextOverride : null;
      return {
        ...prev,
        custo_kit: nextCustoKit,
        custo_kit_override: overrideValue,
        isImportedFinancialOverride: false,
      };
    });
  }, [calcKitCostFromItems]);

  // UC change handler — auto-applies tenant tariff defaults to new/changed UCs
  const handleUCsChange = useCallback((next: UCData[] | ((prev: UCData[]) => UCData[])) => {
    setUcs(prev => {
      const resolved = typeof next === "function" ? (next as (p: UCData[]) => UCData[])(prev) : next;
      if (!tenantTarifas) return resolved;
      return resolved.map(u => applyTenantTarifasToUC(u, tenantTarifas));
    });
  }, [tenantTarifas]);

  const handleVendaChange = useCallback((nextVenda: VendaData) => {
    setVenda(nextVenda);
  }, []);

  // Re-apply tenant tariffs when restored from snapshot or when tariffs load
  useEffect(() => {
    if (!tenantTarifas) return;
    setUcs(prev => prev.map(u => applyTenantTarifasToUC(u, tenantTarifas)));
  }, [tenantTarifas, ucsRestoreEpoch]);

  // Seed location defaults from tenant tariffs (only when empty)
  useEffect(() => {
    if (!tenantTarifas) return;
    if (!locTipoTelhado && tenantTarifas.tipo_telhado_padrao) {
      setLocTipoTelhado(tenantTarifas.tipo_telhado_padrao);
    }
    if (!locDistribuidoraId && tenantTarifas.concessionaria_id) {
      setLocDistribuidoraId(tenantTarifas.concessionaria_id);
    }
    // Espelha o nome quando o id está setado mas o nome ainda não (seed do tenant
    // ou hidratação a partir de project sem nome). Sem isso a validação final
    // bloqueia a geração com "Distribuidora de energia não selecionada".
    if (!locDistribuidoraNome && tenantTarifas.concessionaria_nome) {
      setLocDistribuidoraNome(tenantTarifas.concessionaria_nome);
    }
  }, [tenantTarifas, locTipoTelhado, locDistribuidoraId, locDistribuidoraNome]);

  // Combined: setting roof type also propagates to the generating UC (ucs[0])
  const handleLocTipoTelhadoChange = useCallback((v: string) => {
    setLocTipoTelhado(v);
    setUcs(prev => {
      if (prev.length === 0) return prev;
      if (prev[0].tipo_telhado === v) return prev;
      return [{ ...prev[0], tipo_telhado: v }, ...prev.slice(1)];
    });
  }, []);

  // Lead selection — propagates lead data into location + UC[0]
  const handleSelectLead = useCallback((lead: LeadSelection) => {
    setSelectedLead(lead);
    if (lead.municipio_ibge_codigo) setClienteMunicipioIbgeCodigo(lead.municipio_ibge_codigo);
    if (lead.estado) setLocEstado(lead.estado);
    if (lead.cidade) setLocCidade(lead.cidade);
    const mappedTelhado = mapLeadTipoTelhadoToProposal(lead.tipo_telhado);
    if (mappedTelhado) setLocTipoTelhado(mappedTelhado);

    const faseData = redeAtendimentoToFaseTensao(lead.rede_atendimento);
    const consumo = lead.media_consumo || 0;

    setUcs(prev => {
      const updated = [...prev];
      if (updated.length === 0) return prev;
      updated[0] = {
        ...updated[0],
        estado: lead.estado || updated[0].estado,
        cidade: lead.cidade || updated[0].cidade,
        tipo_telhado: mappedTelhado || updated[0].tipo_telhado,
        ...(consumo ? { consumo_mensal: consumo } : {}),
        ...(faseData ? {
          fase: faseData.fase,
          fase_tensao: faseData.fase_tensao,
          tensao_rede: faseData.tensao_rede,
        } : {}),
      };
      return updated;
    });
  }, []);

  const value = useMemo(() => ({
    selectedLead, setSelectedLead,
    cliente, setCliente,
    clienteMunicipioIbgeCodigo, setClienteMunicipioIbgeCodigo,
    locEstado, setLocEstado,
    locCidade, setLocCidade,
    locTipoTelhado, setLocTipoTelhado,
    locDistribuidoraId, setLocDistribuidoraId,
    locDistribuidoraNome, setLocDistribuidoraNome,
    locIrradiacao, setLocIrradiacao,
    locGhiSeries, setLocGhiSeries,
    locSkipPoa, setLocSkipPoa,
    locLatitude, setLocLatitude,
    mapSnapshots, setMapSnapshots,
    distanciaKm, setDistanciaKm,
    projectAddress, setProjectAddress,
    ucs, setUcs,
    ucsRestoreEpoch, bumpUcsRestoreEpoch,
    grupo, setGrupo,
    subgrupo, setSubgrupo,
    potenciaKwp, setPotenciaKwp,
    itens, setItens,
    manualKits, setManualKits,
    selectedManualIdx, setSelectedManualIdx,
    layouts, setLayouts,
    adicionais, setAdicionais,
    preDimensionamento, setPreDimensionamento,
    premissas, setPremissas,
    servicos, setServicos,
    venda, setVenda,
    pagamentoOpcoes, setPagamentoOpcoes,
    customFieldValues, setCustomFieldValues,
    templateSelecionado, setTemplateSelecionado,
    generationStatus, setGenerationStatus,
    editAceitaDialogOpen, setEditAceitaDialogOpen,
    editAceitaMotivo, setEditAceitaMotivo,
    handleItensChange,
    handleUCsChange,
    handleVendaChange,
    handleSelectLead,
    handleLocTipoTelhadoChange,
  }), [
    selectedLead, cliente, clienteMunicipioIbgeCodigo, locEstado, locCidade,
    locTipoTelhado, locDistribuidoraId, locDistribuidoraNome, locIrradiacao,
    locGhiSeries, locSkipPoa, locLatitude, mapSnapshots, distanciaKm,
    projectAddress, ucs, ucsRestoreEpoch, bumpUcsRestoreEpoch,
    grupo, subgrupo, potenciaKwp, itens, manualKits,
    selectedManualIdx, layouts, adicionais, preDimensionamento,
    premissas, servicos, venda, pagamentoOpcoes, customFieldValues,
    templateSelecionado, generationStatus, editAceitaDialogOpen, editAceitaMotivo,
    handleItensChange, handleUCsChange, handleVendaChange,
    handleSelectLead, handleLocTipoTelhadoChange,
  ]);

  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}

export function useWizardContext() {
  const context = useContext(WizardContext);
  if (context === undefined) {
    throw new Error("useWizardContext must be used within a WizardProvider");
  }
  return context;
}
