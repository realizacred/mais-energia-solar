import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Zap, Plus, Sun,
  User, Briefcase, BarChart3, Settings2, Package, Wrench,
  SlidersHorizontal, CreditCard, FileText, Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";
import { cn } from "@/lib/utils";

// ── Step Components
import { StepCliente } from "./wizard/StepCliente";
import { StepComercial } from "./wizard/StepComercial";
import { StepUCsEnergia } from "./wizard/StepUCsEnergia";
import { StepPremissas } from "./wizard/StepPremissas";
import { StepKit } from "./wizard/StepKit";
import { StepServicos } from "./wizard/StepServicos";
import { StepVenda, calcPrecoFinal } from "./wizard/StepVenda";
import { StepPagamento } from "./wizard/StepPagamento";

// ── Types
import {
  type LeadSelection, type ClienteData, type ComercialData, type UCData,
  type PremissasData, type KitItemRow, type ServicoItem, type VendaData,
  type PagamentoOpcao, type BancoFinanciamento,
  EMPTY_CLIENTE, EMPTY_COMERCIAL, DEFAULT_PREMISSAS, createEmptyUC, formatBRL,
} from "./wizard/types";
import { StepDocumento } from "./wizard/StepDocumento";

// ─── Steps Config ──────────────────────────────────────────

const STEPS = [
  { label: "Cliente", icon: User },
  { label: "Comercial", icon: Briefcase },
  { label: "UCs / Energia", icon: BarChart3 },
  { label: "Premissas", icon: Settings2 },
  { label: "Kit / Layout", icon: Package },
  { label: "Serviços", icon: Wrench },
  { label: "Venda", icon: SlidersHorizontal },
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

function SunSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Sun className="h-12 w-12 text-primary animate-spin" style={{ animationDuration: "2s" }} />
      {message && <p className="text-sm font-medium text-muted-foreground animate-pulse">{message}</p>}
    </div>
  );
}

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }}>
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

  // Step 1 - Comercial
  const [comercial, setComercial] = useState<ComercialData>(EMPTY_COMERCIAL);

  // Step 2 - UCs
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Step 3 - Premissas
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Step 4 - Kit (unified catalog)
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

  // ─── Derived
  const precoFinal = useMemo(() => calcPrecoFinal(itens, servicos, venda), [itens, servicos, venda]);
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // ─── Data fetching (unified catalog) ─────────────────
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
    /* 0 */ !!selectedLead && !!cliente.nome,
    /* 1 */ true,
    /* 2 */ consumoTotal > 0 && potenciaKwp > 0,
    /* 3 */ true,
    /* 4 */ itens.length > 0 && itens.some(i => i.descricao),
    /* 5 */ true,
    /* 6 */ venda.margem_percentual >= 0,
    /* 7 */ true,
    /* 8 */ true,
  ];

  // ─── Generate ────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setHtmlPreview(null);
    setResult(null);

    try {
      const idempotencyKey = getOrCreateIdempotencyKey(selectedLead.id);
      const uc1 = ucs[0];
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
    setStep(2);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  // ─── Render ──────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Stepper ── */}
      <div className="relative">
        <div className="flex items-center gap-0.5 overflow-x-auto pb-2 scrollbar-thin snap-x snap-mandatory px-1 -mx-1">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const isActive = i === step;
            const isDone = i < step;
            return (
              <div key={s.label} className="flex items-center gap-0.5 flex-shrink-0 snap-start">
                <button
                  onClick={() => { if (isDone) setStep(i); }}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap min-h-[44px]",
                    isActive && "bg-primary text-primary-foreground shadow-sm",
                    isDone && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15 active:bg-primary/20",
                    !isActive && !isDone && "bg-muted/50 text-muted-foreground cursor-default",
                  )}
                >
                  <span className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full text-[10px] shrink-0",
                    isActive && "bg-primary-foreground/20",
                    isDone && "bg-primary/20",
                    !isActive && !isDone && "bg-muted",
                  )}>
                    {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                  </span>
                  <span className="hidden sm:block">{s.label}</span>
                </button>
                {i < STEPS.length - 1 && <div className="w-3 h-px bg-border shrink-0" />}
              </div>
            );
          })}
        </div>
        {/* Step counter for mobile */}
        <div className="sm:hidden text-center mt-1">
          <span className="text-[10px] font-medium text-muted-foreground">
            {step + 1}/{STEPS.length} — {STEPS[step].label}
          </span>
        </div>
      </div>

      {/* ── Step Content ── */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <AnimatePresence mode="wait">

            {step === 0 && (
              <StepContent key="step0">
                <StepCliente selectedLead={selectedLead} onSelectLead={handleSelectLead} onClearLead={() => setSelectedLead(null)} cliente={cliente} onClienteChange={setCliente} />
              </StepContent>
            )}

            {step === 1 && (
              <StepContent key="step1">
                <StepComercial comercial={comercial} onComercialChange={setComercial} />
              </StepContent>
            )}

            {step === 2 && (
              <StepContent key="step2">
                <StepUCsEnergia ucs={ucs} onUcsChange={setUcs} grupo={grupo} onGrupoChange={setGrupo} potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp} />
              </StepContent>
            )}

            {step === 3 && (
              <StepContent key="step3">
                <StepPremissas premissas={premissas} onPremissasChange={setPremissas} />
              </StepContent>
            )}

            {step === 4 && (
              <StepContent key="step4">
                <StepKit itens={itens} onItensChange={setItens} modulos={modulos} inversores={inversores} loadingEquip={loadingEquip} potenciaKwp={potenciaKwp} />
              </StepContent>
            )}

            {step === 5 && (
              <StepContent key="step5">
                <StepServicos servicos={servicos} onServicosChange={setServicos} />
              </StepContent>
            )}

            {step === 6 && (
              <StepContent key="step6">
                <StepVenda venda={venda} onVendaChange={setVenda} itens={itens} servicos={servicos} />
              </StepContent>
            )}

            {step === 7 && (
              <StepContent key="step7">
                <StepPagamento opcoes={pagamentoOpcoes} onOpcoesChange={setPagamentoOpcoes} bancos={bancos} loadingBancos={loadingBancos} precoFinal={precoFinal} />
              </StepContent>
            )}

            {/* ── STEP 8: Documento ── */}
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
      {step < 8 && !result && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="gap-1 min-h-[44px]">
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground hidden sm:inline">{step + 1} / {STEPS.length}</span>
            <Button onClick={() => setStep(step + 1)} disabled={!canStep[step]} className="gap-1 min-h-[44px]">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {step === 8 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => setStep(7)} className="gap-1 min-h-[44px]">
            <ChevronLeft className="h-4 w-4" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
        </div>
      )}
    </div>
  );
}
