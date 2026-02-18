// @deprecated: Tabela 'premissas_tecnicas' não é mais usada. Fonte atual: 'tenant_premises' via useSolarPremises.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, MapPin, User, BarChart3, Settings2, Package,
  Wrench, DollarSign, CreditCard, FileText, Check, Cpu, Link2, ClipboardList, Box,
  Zap,
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
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepAdicionais, type AdicionalItem } from "./wizard/StepAdicionais";
import { StepServicos } from "./wizard/StepServicos";
import { StepFinancialCenter, calcPrecoFinal } from "./wizard/StepFinancialCenter";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepDocumento } from "./wizard/StepDocumento";
import { WizardSidebar, type WizardStep } from "./wizard/WizardSidebar";

// ── Types
import {
  type LeadSelection, type ClienteData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type BancoFinanciamento, type PreDimensionamentoData,
  EMPTY_CLIENTE, DEFAULT_PREMISSAS, DEFAULT_PRE_DIMENSIONAMENTO, createEmptyUC, formatBRL,
} from "./wizard/types";

// ─── Step Keys ─────────────────────────────────────────────

const STEP_KEYS = {
  LOCALIZACAO: "localizacao",
  UCS: "ucs",
  CAMPOS_PRE: "campos_pre",
  KIT: "kit",
  ADICIONAIS: "adicionais",
  SERVICOS: "servicos",
  VENDA: "venda",
  PAGAMENTO: "pagamento",
  PROPOSTA: "proposta",
} as const;

const BASE_STEPS: WizardStep[] = [
  { key: STEP_KEYS.LOCALIZACAO, label: "Localização", icon: MapPin },
  { key: STEP_KEYS.UCS, label: "Unidades Consumidoras", icon: Zap },
  { key: STEP_KEYS.CAMPOS_PRE, label: "Campos Customizados", icon: ClipboardList, conditional: true },
  { key: STEP_KEYS.KIT, label: "Kit Gerador", icon: Package },
  { key: STEP_KEYS.ADICIONAIS, label: "Adicionais", icon: Box },
  { key: STEP_KEYS.SERVICOS, label: "Serviços", icon: Wrench },
  { key: STEP_KEYS.VENDA, label: "Venda", icon: DollarSign },
  { key: STEP_KEYS.PAGAMENTO, label: "Formas de pagamento", icon: CreditCard },
  { key: STEP_KEYS.PROPOSTA, label: "Proposta", icon: FileText },
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

  // ─── Custom fields availability (conditional steps)
  const [hasCustomFieldsPre, setHasCustomFieldsPre] = useState(false);
  const [loadingCustomFields, setLoadingCustomFields] = useState(true);

  useEffect(() => {
    supabase
      .from("deal_custom_fields")
      .select("id, field_context")
      .eq("is_active", true)
      .then(({ data }) => {
        const fields = data || [];
        setHasCustomFieldsPre(fields.some(f => f.field_context === "pre_dimensionamento") || fields.length > 0);
        setLoadingCustomFields(false);
      });
  }, []);

  // ─── Dynamic steps based on custom fields
  const activeSteps = useMemo(() => {
    return BASE_STEPS.filter(s => {
      if (s.key === STEP_KEYS.CAMPOS_PRE) return hasCustomFieldsPre;
      return true;
    });
  }, [hasCustomFieldsPre]);

  const currentStepKey = activeSteps[step]?.key || STEP_KEYS.LOCALIZACAO;

  // Step 0 - Localização
  const [locEstado, setLocEstado] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locTipoTelhado, setLocTipoTelhado] = useState("");
  const [locDistribuidoraId, setLocDistribuidoraId] = useState("");
  const [locDistribuidoraNome, setLocDistribuidoraNome] = useState("");
  const [locIrradiacao, setLocIrradiacao] = useState<number>(0);

  // Cliente (embedded in Localização flow)
  const [selectedLead, setSelectedLead] = useState<LeadSelection | null>(null);
  const [cliente, setCliente] = useState<ClienteData>(EMPTY_CLIENTE);

  // UCs
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Custom Fields
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  // Premissas
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Kit
  const [modulos, setModulos] = useState<any[]>([]);
  const [inversores, setInversores] = useState<any[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);

  // Adicionais
  const [adicionais, setAdicionais] = useState<AdicionalItem[]>([]);

  // Serviços
  const [servicos, setServicos] = useState<ServicoItem[]>([]);

  // Venda
  const [venda, setVenda] = useState<VendaData>({
    custo_kit: 0, custo_instalacao: 0, custo_comissao: 0, custo_outros: 0,
    margem_percentual: 20, desconto_percentual: 0, observacoes: "",
  });

  // Pagamento
  const [pagamentoOpcoes, setPagamentoOpcoes] = useState<PagamentoOpcao[]>([]);
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [loadingBancos, setLoadingBancos] = useState(false);

  // Proposta (Documento)
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState("");
  const [preDimensionamento, setPreDimensionamento] = useState<PreDimensionamentoData>(DEFAULT_PRE_DIMENSIONAMENTO);

  // ─── Derived
  const precoFinal = useMemo(() => calcPrecoFinal(itens, servicos, venda), [itens, servicos, venda]);
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // Estimated generation (kWh/month) = potência * irradiação * 30 * PR(0.80)
  const geracaoMensalEstimada = useMemo(() => {
    if (potenciaKwp > 0 && locIrradiacao > 0) {
      return Math.round(potenciaKwp * locIrradiacao * 30 * 0.80);
    }
    return 0;
  }, [potenciaKwp, locIrradiacao]);

  // Estimated area (m²) from module items — ~2m² per module panel
  const areaUtilEstimada = useMemo(() => {
    const modulosNoKit = itens.filter(i => i.categoria === "modulo");
    const totalPaineis = modulosNoKit.reduce((sum, m) => sum + (m.quantidade || 0), 0);
    return totalPaineis > 0 ? Math.round(totalPaineis * 2) : 0;
  }, [itens]);

  // ─── Data fetching
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

  // Load premissas from Solar Brain
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

  // ─── Auto-load from project context
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
          nome: cli.nome || "", empresa: cli.empresa || "", cnpj_cpf: cli.cpf_cnpj || "",
          email: cli.email || "", celular: cli.telefone || "",
          cep: cli.cep || "", endereco: cli.rua || "", numero: cli.numero || "",
          complemento: cli.complemento || "", bairro: cli.bairro || "",
          cidade: cli.cidade || "", estado: cli.estado || "",
        });

        if (cli.estado) setLocEstado(cli.estado);
        if (cli.cidade) setLocCidade(cli.cidade);

        if (dealIdFromUrl) {
          setProjectContext({ dealId: dealIdFromUrl, customerId: customerIdFromUrl });
        }

        if (cli.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("id, nome, telefone, lead_code, estado, cidade, media_consumo, tipo_telhado")
            .eq("id", cli.lead_id)
            .single();
          if (!cancelled && lead) {
            setSelectedLead({
              id: lead.id, nome: lead.nome, telefone: lead.telefone,
              lead_code: lead.lead_code || "", estado: lead.estado,
              cidade: lead.cidade, media_consumo: lead.media_consumo,
              tipo_telhado: lead.tipo_telhado,
            });
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
    if (lead.estado) setLocEstado(lead.estado);
    if (lead.cidade) setLocCidade(lead.cidade);
    if (lead.tipo_telhado) setLocTipoTelhado(lead.tipo_telhado);
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

  // ─── Validations per step key
  const canAdvance: Record<string, boolean> = {
    [STEP_KEYS.LOCALIZACAO]: !!locEstado && !!locCidade && !!locTipoTelhado && !!locDistribuidoraId,
    [STEP_KEYS.UCS]: consumoTotal > 0,
    [STEP_KEYS.CAMPOS_PRE]: true,
    [STEP_KEYS.KIT]: itens.length > 0 && itens.some(i => i.descricao),
    [STEP_KEYS.ADICIONAIS]: true,
    [STEP_KEYS.SERVICOS]: true,
    [STEP_KEYS.VENDA]: venda.margem_percentual >= 0,
    [STEP_KEYS.PAGAMENTO]: true,
    [STEP_KEYS.PROPOSTA]: true,
  };

  const canCurrentStep = canAdvance[currentStepKey] ?? true;

  // ─── Generate
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
    // Go back to UCs step
    const ucsIndex = activeSteps.findIndex(s => s.key === STEP_KEYS.UCS);
    setStep(ucsIndex >= 0 ? ucsIndex : 1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  const goToStep = (target: number) => {
    setStep(target);
  };

  const goNext = () => {
    if (step < activeSteps.length - 1) setStep(step + 1);
  };

  const goPrev = () => {
    setStep(Math.max(0, step - 1));
  };

  const isLastStep = currentStepKey === STEP_KEYS.PROPOSTA;

  // ─── Render step content by key
  const renderStepContent = () => {
    switch (currentStepKey) {
      case STEP_KEYS.LOCALIZACAO:
        return (
          <StepContent key="localizacao">
            <div className="space-y-6">
              <StepLocalizacao
                estado={locEstado} cidade={locCidade} tipoTelhado={locTipoTelhado}
                distribuidoraId={locDistribuidoraId}
                onEstadoChange={(v) => { setLocEstado(v); setCliente(c => ({ ...c, estado: v })); }}
                onCidadeChange={(v) => { setLocCidade(v); setCliente(c => ({ ...c, cidade: v })); }}
                onTipoTelhadoChange={setLocTipoTelhado}
                onDistribuidoraChange={(id, nome) => { setLocDistribuidoraId(id); setLocDistribuidoraNome(nome); }}
                onIrradiacaoChange={setLocIrradiacao}
              />
              {/* Cliente inline */}
              <div className="border-t border-border/50 pt-4">
                <StepCliente
                  selectedLead={selectedLead}
                  onSelectLead={handleSelectLead}
                  onClearLead={() => setSelectedLead(null)}
                  cliente={cliente}
                  onClienteChange={setCliente}
                  fromProject={!!projectContext}
                />
              </div>
            </div>
          </StepContent>
        );

      case STEP_KEYS.UCS:
        return (
          <StepContent key="ucs">
            <StepConsumptionIntelligence
              ucs={ucs} onUcsChange={setUcs}
              potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp}
              preDimensionamento={preDimensionamento}
              onPreDimensionamentoChange={setPreDimensionamento}
            />
          </StepContent>
        );

      case STEP_KEYS.CAMPOS_PRE:
        return (
          <StepContent key="campos_pre">
            <StepCamposCustomizados values={customFieldValues} onValuesChange={setCustomFieldValues} />
          </StepContent>
        );

      case STEP_KEYS.KIT:
        return (
          <StepContent key="kit">
            <StepKitSelection itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} />
          </StepContent>
        );

      case STEP_KEYS.ADICIONAIS:
        return (
          <StepContent key="adicionais">
            <StepAdicionais adicionais={adicionais} onAdicionaisChange={setAdicionais} />
          </StepContent>
        );

      case STEP_KEYS.SERVICOS:
        return (
          <StepContent key="servicos">
            <StepServicos servicos={servicos} onServicosChange={setServicos} kitItens={itens} potenciaKwp={potenciaKwp} />
          </StepContent>
        );

      case STEP_KEYS.VENDA:
        return (
          <StepContent key="venda">
            <StepFinancialCenter venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} potenciaKwp={potenciaKwp} />
          </StepContent>
        );

      case STEP_KEYS.PAGAMENTO:
        return (
          <StepContent key="pagamento">
            <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} ucs={ucs} premissas={premissas} potenciaKwp={potenciaKwp} irradiacao={locIrradiacao} />
          </StepContent>
        );

      case STEP_KEYS.PROPOSTA:
        return (
          <StepContent key="proposta">
            <StepDocumento
              clienteNome={cliente.nome || selectedLead?.nome || ""}
              empresaNome={cliente.empresa || cliente.nome || selectedLead?.nome || ""}
              clienteTelefone={cliente.celular || selectedLead?.telefone || ""}
              clienteEmail={cliente.email || ""}
              potenciaKwp={potenciaKwp}
              areaUtilM2={areaUtilEstimada}
              geracaoMensalKwh={geracaoMensalEstimada}
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
              customFieldValues={customFieldValues}
              onCustomFieldValuesChange={setCustomFieldValues}
            />
          </StepContent>
        );

      default:
        return null;
    }
  };

  // ─── Render
  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Nova Proposta</h1>
        <div className="flex items-center gap-4">
          {potenciaKwp > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span>Potência Ideal</span>
              <span className="font-bold text-foreground">{potenciaKwp.toFixed(2)} kWp</span>
            </div>
          )}
          <span className="text-[10px] font-mono text-primary font-bold">
            Etapa {step + 1}/{activeSteps.length}
          </span>
        </div>
      </div>

      {/* Project Context Banner */}
      {projectContext && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/20 bg-primary/5">
          <Link2 className="h-4 w-4 text-primary shrink-0" />
          <p className="text-xs font-medium text-primary">
            Proposta vinculada ao projeto — dados do cliente carregados automaticamente
          </p>
        </div>
      )}

      {/* Layout: Sidebar + Content */}
      <div className="flex gap-6">
        {/* Sidebar Stepper */}
        <div className="w-52 shrink-0 hidden lg:block">
          <div className="sticky top-4">
            <WizardSidebar
              steps={activeSteps}
              currentStep={step}
              onStepClick={goToStep}
              totalLabel={`Etapa ${step + 1}/${activeSteps.length}`}
            />
          </div>
        </div>

        {/* Mobile stepper (horizontal, compact) */}
        <div className="lg:hidden flex items-center gap-1 overflow-x-auto pb-2 scrollbar-thin w-full">
          {activeSteps.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.key} className="flex items-center gap-0.5 flex-shrink-0">
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
                  <span className="hidden sm:block">{s.label}</span>
                </button>
                {i < activeSteps.length - 1 && <div className="w-2 h-px bg-border shrink-0" />}
              </div>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <Card className="border-border/60 overflow-hidden">
            <CardContent className="pt-5 pb-5 px-4 sm:px-6">
              <AnimatePresence mode="wait">
                {renderStepContent()}
              </AnimatePresence>
            </CardContent>
          </Card>

          {/* Navigation Footer */}
          {!result && (
            <div className="flex items-center justify-between mt-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1 h-8 text-xs">
                Cancelar
              </Button>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1 h-8 text-xs">
                  Voltar
                </Button>
                {!isLastStep && (
                  <Button size="sm" onClick={goNext} disabled={!canCurrentStep} className="gap-1 h-8 text-xs">
                    Prosseguir
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
