import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import {
  type LeadSelection, type ClienteData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type LayoutArranjo, type PreDimensionamentoData,
  EMPTY_CLIENTE, DEFAULT_PREMISSAS, DEFAULT_PRE_DIMENSIONAMENTO, createEmptyUC
} from "./types";
import { type AdicionalItem } from "./StepAdicionais";

type GenerationStatus = "idle" | "calculating" | "generating_docx" | "converting_pdf" | "saving" | "ready" | "docx_only" | "error";

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
  projectAddress: any;
  setProjectAddress: React.Dispatch<React.SetStateAction<any>>;

  // UCs & Dimensionamento
  ucs: UCData[];
  setUcs: React.Dispatch<React.SetStateAction<UCData[]>>;
  grupo: string;
  setGrupo: (g: string) => void;
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

  // Handlers
  handleItensChange: (nextItens: KitItemRow[], nextOverride?: number | null) => void;
  handleUCsChange: (nextUcs: UCData[]) => void;
  handleVendaChange: (nextVenda: VendaData) => void;
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
  const [projectAddress, setProjectAddress] = useState({
    cep: "", rua: "", numero: "", complemento: "",
    bairro: "", cidade: "", uf: "", lat: null, lon: null,
  });

  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
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
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [generationStatus, setGenerationStatus] = useState<GenerationStatus>("idle");

  const [editAceitaDialogOpen, setEditAceitaDialogOpen] = useState(false);
  const [editAceitaMotivo, setEditAceitaMotivo] = useState("");

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

  const handleUCsChange = useCallback((nextUcs: UCData[]) => {
    setUcs(nextUcs);
  }, []);

  const handleVendaChange = useCallback((nextVenda: VendaData) => {
    setVenda(nextVenda);
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
    projectAddress, setProjectAddress,
    ucs, setUcs,
    grupo, setGrupo,
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
    templateSelecionado, setTemplateSelecionado,
    generationStatus, setGenerationStatus,
    editAceitaDialogOpen, setEditAceitaDialogOpen,
    editAceitaMotivo, setEditAceitaMotivo,
    handleItensChange,
    handleUCsChange,
    handleVendaChange
  }), [
    selectedLead, cliente, clienteMunicipioIbgeCodigo, locEstado, locCidade, 
    locTipoTelhado, locDistribuidoraId, locDistribuidoraNome, locIrradiacao, 
    projectAddress, ucs, grupo, potenciaKwp, itens, manualKits, 
    selectedManualIdx, layouts, adicionais, preDimensionamento, 
    premissas, servicos, venda, pagamentoOpcoes, templateSelecionado, 
    generationStatus, editAceitaDialogOpen, editAceitaMotivo, 
    handleItensChange, handleUCsChange, handleVendaChange
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
