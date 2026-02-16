// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, User, BarChart3, Settings2, Package,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";
import { cn } from "@/lib/utils";
import { useSolarPremises } from "@/hooks/useSolarPremises";

// ── Step Components
import { StepCliente } from "./wizard/StepCliente";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepTechnicalConfig } from "./wizard/StepTechnicalConfig";
import { StepEngineeringAnalysis } from "./wizard/StepEngineeringAnalysis";
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepServicos } from "./wizard/StepServicos";
import { StepFinancialCenter, calcPrecoFinal } from "./wizard/StepFinancialCenter";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepDocumento } from "./wizard/StepDocumento";

// ── Types
import {
  type LeadSelection, type ClienteData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type BancoFinanciamento,
  EMPTY_CLIENTE, DEFAULT_PREMISSAS, createEmptyUC, formatBRL,
} from "./wizard/types";

// ─── Steps Config ──────────────────────────────────────────

const STEPS = [
  { label: "Cliente", icon: User },
  { label: "Consumo", icon: BarChart3 },
  { label: "Técnico", icon: Settings2 },
  { label: "Análise", icon: Cpu },
  { label: "Kit", icon: Package },
  { label: "Serviços", icon: Wrench },
  { label: "Financeiro", icon: DollarSign },
  { label: "Pagamento", icon: CreditCard },
  { label: "Documento", icon: FileText },
];

const IDEM_KEY_PREFIX = "proposal_idem_";

function getOrCreateIdempotencyKey(leadId: string): string {
  const k = `${IDEM_KEY_PREFIX}${leadId}`;
  const existing = localStorage.getItem(k);
  if (existing) return existing;
  const created = crypto.randomUUID();
  localStorage.setItem(k, created);
  return created;
}

function clearIdempotencyKey(leadId: string) {
  localStorage.removeItem(`${IDEM_KEY_PREFIX}${leadId}`);
}

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────

export function ProposalWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0 - Cliente
  const [selectedLead, setSelectedLead] = useState<LeadSelection | null>(null);
  const [cliente, setCliente] = useState<ClienteData>(EMPTY_CLIENTE);

  // Step 1 & 2 - UCs & Technical
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Step 3 - Premissas (loaded from tenant defaults)
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Step 4 - Kit
  const [modulos, setModulos] = useState<any[]>([]);
  const [inversores, setInversores] = useState<any[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);

  // Step 5 - Serviços
  const [servicos, setServicos] = useState<ServicoItem[]>([]);

  // Step 6 - Venda
  const [venda, setVenda] = useState<VendaData>({
    custo_kit: 0, custo_instalacao: 0, custo_comissao: 0, custo_outros: 0,
    margem_percentual: 20, desconto_percentual: 0, observacoes: "",
  });

  // Step 7 - Pagamento
  const [pagamentoOpcoes, setPagamentoOpcoes] = useState<PagamentoOpcao[]>([]);
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);

  // Step 8 - Documento
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState("");

  // Engineering analysis state
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // ─── Derived
  const precoFinal = useMemo(() => calcPrecoFinal(itens, servicos, venda), [itens, servicos, venda]);
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // ─── Data fetching ─────────────────
  useEffect(() => {
    setLoadingEquip(true);
    Promise.all([
      supabase.from("modulos_solares").select("id, fabricante, modelo, potencia_wp, tipo_celula, eficiencia_percent").eq("ativo", true).order("potencia_wp", { ascending: false }),
      supabase.from("inversores_catalogo").select("id, fabricante, modelo, potencia_nominal_kw, tipo, mppt_count, fases").eq("ativo", true).order("potencia_nominal_kw", { ascending: false }),
    ]).then(([modRes, invRes]) => {
      setModulos(modRes.data || []);
      setInversores(invRes.data || []);
      setLoadingEquip(false);
    });
  }, []);

  useEffect(() => {
    setLoadingBancos(true);
    supabase.rpc("get_active_financing_banks").then(({ data }) => {
      setBancos((data || []) as BancoFinanciamento[]);
      setLoadingBancos(false);
    });
  }, []);

  // Load premissas from Solar Brain (tenant_premises — single source of truth)
  const { data: solarBrain } = useSolarPremises();

  useEffect(() => {
    if (!solarBrain) return;
    setPremissas(prev => ({
      ...prev,
      imposto: solarBrain.imposto_energia ?? prev.imposto,
      inflacao_energetica: solarBrain.inflacao_energetica ?? prev.inflacao_energetica,
      perda_eficiencia_anual: solarBrain.perda_eficiencia ?? prev.perda_eficiencia_anual,
      sobredimensionamento: solarBrain.sobredimensionamento ?? prev.sobredimensionamento,
    }));
  }, [solarBrain]);

  // ─── Lead selection handler ──────────────────────────
  const handleSelectLead = (lead: LeadSelection) => {
    setSelectedLead(lead);
    if (lead.estado && ucs[0]) {
      const updated = [...ucs];
      updated[0] = { ...updated[0], estado: lead.estado, cidade: lead.cidade || "" };
      if (lead.tipo_telhado) updated[0].tipo_telhado = lead.tipo_telhado;
      setUcs(updated);
    }
    if (lead.consumo_kwh || lead.media_consumo) {
      const consumo = lead.consumo_kwh || lead.media_consumo || 0;
      const updated = [...ucs];
      updated[0] = { ...updated[0], consumo_mensal: consumo };
      setUcs(updated);
    }
  };

  // ─── Validations ─────────────────────────────────────
  const canStep = [
    /* 0 Cliente     */ !!cliente.nome && !!cliente.celular,
    /* 1 Consumo     */ consumoTotal > 0,
    /* 2 Técnico     */ potenciaKwp > 0,
    /* 3 Análise     */ true, // auto-advances
    /* 4 Kit         */ itens.length > 0 && itens.some(i => i.descricao),
    /* 5 Serviços    */ true,
    /* 6 Financeiro  */ venda.margem_percentual >= 0,
    /* 7 Pagamento   */ true,
    /* 8 Documento   */ true,
  ];

  // ─── Generate ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setHtmlPreview(null);
    setResult(null);

    try {
      const idempotencyKey = getOrCreateIdempotencyKey(selectedLead.id);
      const payload: GenerateProposalPayload = {
        lead_id: selectedLead.id,
        grupo: grupo.startsWith("B") ? "B" : "A",
        idempotency_key: idempotencyKey,
        template_id: templateSelecionado || undefined,
        potencia_kwp: potenciaKwp,
        ucs: ucs.map(({ id, uc_index, ...rest }) => rest),
        premissas,
        itens: itens.filter(i => i.descricao).map(({ id, ...rest }) => rest),
        servicos: servicos.map(({ id, ...rest }) => rest),
        venda: {
          custo_comissao: venda.custo_comissao,
          custo_outros: venda.custo_outros,
          margem_percentual: venda.margem_percentual,
          desconto_percentual: venda.desconto_percentual,
          observacoes: venda.observacoes,
        },
        pagamento_opcoes: pagamentoOpcoes.map(({ id, ...rest }) => rest),
        observacoes: venda.observacoes || undefined,
      };

      const genResult = await generateProposal(payload);
      setResult(genResult);

      setRendering(true);
      try {
        const renderResult = await renderProposal(genResult.versao_id);
        setHtmlPreview(renderResult.html);
      } catch (e: any) {
        toast({ title: "Erro ao renderizar", description: e.message, variant: "destructive" });
      } finally { setRendering(false); }

      toast({ title: "Proposta gerada!", description: `Versão ${genResult.versao_numero} criada.` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar proposta", description: e.message, variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const handleNewVersion = () => {
    if (selectedLead) clearIdempotencyKey(selectedLead.id);
    setResult(null);
    setHtmlPreview(null);
    setStep(1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const handleAnalysisComplete = useCallback(() => {
    setAnalysisComplete(true);
    setStep(4);
  }, []);

  // If step 3 was already completed, skip analysis on re-visit
  const goToStep = (target: number) => {
    if (target === 3 && analysisComplete) {
      setStep(4); // skip analysis
      return;
    }
    setStep(target);
  };

  const goNext = () => {
    if (step === 3) return; // analysis auto-advances
    goToStep(step + 1);
  };

  const goPrev = () => {
    if (step === 4 && analysisComplete) {
      setStep(2); // skip analysis going back
      return;
    }
    setStep(Math.max(0, step - 1));
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* ── Stepper ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-thin px-1 -mx-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step || (i === 3 && analysisComplete && step > 3);
          return (
            <div key={s.label} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => { if (isDone) goToStep(i); }}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                  isDone && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15",
                  !isActive && !isDone && "bg-muted/50 text-muted-foreground cursor-default",
                )}
              >
                <span className={cn(
                  "flex items-center justify-center h-5 w-5 rounded-full text-[9px] shrink-0",
                  isActive && "bg-primary-foreground/20",
                  isDone && "bg-primary/20",
                  !isActive && !isDone && "bg-muted",
                )}>
                  {isDone ? <Check className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
                </span>
                <span className="hidden md:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-2 h-px bg-border shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="pt-5 pb-5 px-4 sm:px-6">
          <AnimatePresence mode="wait">

            {step === 0 && (
              <StepContent key="step0">
                <StepCliente selectedLead={selectedLead} onSelectLead={handleSelectLead} onClearLead={() => setSelectedLead(null)} cliente={cliente} onClienteChange={setCliente} />
              </StepContent>
            )}

            {step === 1 && (
              <StepContent key="step1">
                <StepConsumptionIntelligence ucs={ucs} onUcsChange={setUcs} potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp} />
              </StepContent>
            )}

            {step === 2 && (
              <StepContent key="step2">
                <StepTechnicalConfig ucs={ucs} onUcsChange={setUcs} grupo={grupo} onGrupoChange={setGrupo} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 3 && (
              <StepContent key="step3">
                <StepEngineeringAnalysis onComplete={handleAnalysisComplete} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 4 && (
              <StepContent key="step4">
                <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 5 && (
              <StepContent key="step5">
                <StepServicos servicos={servicos} onServicosChange={setServicos} />
              </StepContent>
            )}

            {step === 6 && (
              <StepContent key="step6">
                <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 7 && (
              <StepContent key="step7">
                <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} />
              </StepContent>
            )}

            {step === 8 && (
              <StepContent key="step8">
                <StepDocumento
                  clienteNome={cliente.nome || selectedLead?.nome || ""}
                  potenciaKwp={potenciaKwp}
                  numUcs={ucs.length}
                  precoFinal={precoFinal}
                  templateSelecionado={templateSelecionado}
                  onTemplateSelecionado={setTemplateSelecionado}
                  generating={generating}
                  rendering={rendering}
                  result={result}
                  htmlPreview={htmlPreview}
                  onGenerate={handleGenerate}
                  onNewVersion={handleNewVersion}
                  onViewDetail={handleViewDetail}
                />
              </StepContent>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ── Navigation Footer ── */}
      {step !== 3 && step < 8 && !result && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">{step + 1}/{STEPS.length}</span>
            <Button size="sm" onClick={goNext} disabled={!canStep[step]} className="gap-1 h-8 text-xs">
              Próximo <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {step === 8 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
