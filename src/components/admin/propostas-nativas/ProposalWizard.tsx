// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MapPin, User, BarChart3, Settings2, Package,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu, Link2, ClipboardList,
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
import { StepLocalizacao } from "./wizard/StepLocalizacao";
import { StepCliente } from "./wizard/StepCliente";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepCamposCustomizados } from "./wizard/StepCamposCustomizados";
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
  { label: "Localização", icon: MapPin },
  { label: "Cliente", icon: User },
  { label: "Consumo", icon: BarChart3 },
  { label: "Campos", icon: ClipboardList },
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
  const [searchParams] = useSearchParams();
  const dealIdFromUrl = searchParams.get("deal_id");
  const customerIdFromUrl = searchParams.get("customer_id");
  const [step, setStep] = useState(0);
  const [projectContext, setProjectContext] = useState<{ dealId: string; customerId: string } | null>(null);

  // Step 0 - Localização
  const [locEstado, setLocEstado] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locTipoTelhado, setLocTipoTelhado] = useState("");
  const [locDistribuidoraId, setLocDistribuidoraId] = useState("");
  const [locDistribuidoraNome, setLocDistribuidoraNome] = useState("");
  const [locIrradiacao, setLocIrradiacao] = useState<number>(0);

  // Step 1 - Cliente
  const [selectedLead, setSelectedLead] = useState<LeadSelection | null>(null);
  const [cliente, setCliente] = useState<ClienteData>(EMPTY_CLIENTE);

  // Step 1 & 2 - UCs & Technical
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Step 3 - Campos Customizados
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Step 4 - Premissas (loaded from tenant defaults)
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

  // ─── Auto-load from project context ──────────────────
  useEffect(() => {
    if (!customerIdFromUrl) return;
    let cancelled = false;
    (async () => {
      try {
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email, cpf_cnpj, empresa, cep, rua, numero, complemento, bairro, cidade, estado, lead_id")
          .eq("id", customerIdFromUrl)
          .single();
        if (cancelled || !cli) return;

        setCliente({
          nome: cli.nome || "",
          empresa: cli.empresa || "",
          cnpj_cpf: cli.cpf_cnpj || "",
          email: cli.email || "",
          celular: cli.telefone || "",
          cep: cli.cep || "",
          endereco: cli.rua || "",
          numero: cli.numero || "",
          complemento: cli.complemento || "",
          bairro: cli.bairro || "",
          cidade: cli.cidade || "",
          estado: cli.estado || "",
        });

        if (dealIdFromUrl) {
          setProjectContext({ dealId: dealIdFromUrl, customerId: customerIdFromUrl });
        }

        // If client has a lead, auto-select it
        if (cli.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado")
            .eq("id", cli.lead_id)
            .single();
          if (!cancelled && lead) {
            setSelectedLead({
              id: lead.id,
              nome: lead.nome,
              telefone: lead.telefone,
              lead_code: lead.lead_code || "",
              estado: lead.estado,
              cidade: lead.cidade,
              media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
            });
            // Also set UC data from lead
            if (lead.estado || lead.media_consumo) {
              setUcs(prev => {
                const updated = [...prev];
                updated[0] = {
                  ...updated[0],
                  estado: lead.estado || updated[0].estado,
                  cidade: lead.cidade || updated[0].cidade,
                  tipo_telhado: lead.tipo_telhado || updated[0].tipo_telhado,
                  consumo_mensal: lead.media_consumo || updated[0].consumo_mensal,
                };
                return updated;
              });
            }
          }
        }

        toast({ title: "Dados carregados do projeto", description: `Cliente: ${cli.nome}` });
      } catch (err) {
        console.error("[ProposalWizard] Error loading project context:", err);
      }
    })();
    return () => { cancelled = true; };
  }, [customerIdFromUrl, dealIdFromUrl]);

  const handleSelectLead = (lead: LeadSelection) => {
    setSelectedLead(lead);
    // Sync lead data to location step
    if (lead.estado) { setLocEstado(lead.estado); }
    if (lead.cidade) { setLocCidade(lead.cidade); }
    if (lead.tipo_telhado) { setLocTipoTelhado(lead.tipo_telhado); }
    // Sync to UC
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
    /* 0 Localização */ !!locEstado && !!locCidade && !!locTipoTelhado && !!locDistribuidoraId,
    /* 1 Cliente     */ !!cliente.nome && !!cliente.celular,
    /* 2 Consumo     */ consumoTotal > 0,
    /* 3 Campos      */ true,
    /* 4 Técnico     */ potenciaKwp > 0,
    /* 5 Análise     */ true, // auto-advances
    /* 6 Kit         */ itens.length > 0 && itens.some(i => i.descricao),
    /* 7 Serviços    */ true,
    /* 8 Financeiro  */ venda.margem_percentual >= 0,
    /* 9 Pagamento   */ true,
    /* 10 Documento  */ true,
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
        projeto_id: projectContext?.dealId || dealIdFromUrl || undefined,
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
    setStep(2);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const handleAnalysisComplete = useCallback(() => {
    setAnalysisComplete(true);
    setStep(6);
  }, []);

  // If step 3 was already completed, skip analysis on re-visit
  const goToStep = (target: number) => {
    if (target === 5 && analysisComplete) {
      setStep(6); // skip analysis
      return;
    }
    setStep(target);
  };

  const goNext = () => {
    if (step === 5) return; // analysis auto-advances
    goToStep(step + 1);
  };

  const goPrev = () => {
    if (step === 6 && analysisComplete) {
      setStep(4); // skip analysis going back
      return;
    }
    setStep(Math.max(0, step - 1));
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* ── Project Context Banner ── */}
      {projectContext && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-primary">
            Proposta vinculada ao projeto — dados do cliente carregados automaticamente
          </p>
        </div>
      )}
      {/* ── Stepper ── */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1 scrollbar-thin px-1 -mx-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step || (i === 5 && analysisComplete && step > 5);
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
                <StepLocalizacao
                  estado={locEstado} cidade={locCidade} tipoTelhado={locTipoTelhado}
                  distribuidoraId={locDistribuidoraId}
                  onEstadoChange={(v) => { setLocEstado(v); setCliente(c => ({ ...c, estado: v })); }}
                  onCidadeChange={(v) => { setLocCidade(v); setCliente(c => ({ ...c, cidade: v })); }}
                  onTipoTelhadoChange={setLocTipoTelhado}
                  onDistribuidoraChange={(id, nome) => { setLocDistribuidoraId(id); setLocDistribuidoraNome(nome); }}
                  onIrradiacaoChange={setLocIrradiacao}
                />
              </StepContent>
            )}

            {step === 1 && (
              <StepContent key="step1">
                <StepCliente selectedLead={selectedLead} onSelectLead={handleSelectLead} onClearLead={() => setSelectedLead(null)} cliente={cliente} onClienteChange={setCliente} fromProject={!!projectContext} />
              </StepContent>
            )}

            {step === 2 && (
              <StepContent key="step2">
                <StepConsumptionIntelligence ucs={ucs} onUcsChange={setUcs} potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp} />
              </StepContent>
            )}

            {step === 3 && (
              <StepContent key="step3">
                <StepCamposCustomizados values={customFieldValues} onValuesChange={setCustomFieldValues} />
              </StepContent>
            )}

            {step === 4 && (
              <StepContent key="step4">
                <StepTechnicalConfig ucs={ucs} onUcsChange={setUcs} grupo={grupo} onGrupoChange={setGrupo} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 5 && (
              <StepContent key="step5">
                <StepEngineeringAnalysis onComplete={handleAnalysisComplete} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 6 && (
              <StepContent key="step6">
                <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 7 && (
              <StepContent key="step7">
                <StepServicos servicos={servicos} onServicosChange={setServicos} />
              </StepContent>
            )}

            {step === 8 && (
              <StepContent key="step8">
                <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 9 && (
              <StepContent key="step9">
                <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} />
              </StepContent>
            )}

            {step === 10 && (
              <StepContent key="step10">
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
      {step !== 5 && step < 10 && !result && (
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
      {step === 9 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" size="sm" onClick={goPrev} className="gap-1 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
