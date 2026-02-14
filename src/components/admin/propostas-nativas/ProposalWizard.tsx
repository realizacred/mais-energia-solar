import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Zap, Loader2, Check, Plus, Trash2,
  User, Briefcase, BarChart3, Settings2, Package, Wrench,
  DollarSign, CreditCard, FileText, Sun, Building2, SlidersHorizontal, Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";
import { cn } from "@/lib/utils";

// ── Step Components (Fase 2)
import { StepCliente } from "./wizard/StepCliente";
import { StepComercial } from "./wizard/StepComercial";
import { StepUCsEnergia } from "./wizard/StepUCsEnergia";
import { StepPremissas } from "./wizard/StepPremissas";

// ── Types
import {
  type LeadSelection, type ClienteData, type ComercialData, type UCData,
  type PremissasData, type KitItemRow, type BancoFinanciamento,
  type CatalogoModulo, type CatalogoInversor,
  EMPTY_CLIENTE, EMPTY_COMERCIAL, DEFAULT_PREMISSAS, createEmptyUC, formatBRL,
  TIPO_TELHADO_OPTIONS,
} from "./wizard/types";

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

const CATEGORIAS = [
  { value: "modulo", label: "Módulo" },
  { value: "inversor", label: "Inversor" },
  { value: "estrutura", label: "Estrutura" },
  { value: "mao_obra", label: "Mão de obra" },
  { value: "outros", label: "Outros" },
];

const DRAFT_KEY = "proposal_wizard_draft_v3";
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

// ─── Helpers ───────────────────────────────────────────────

function SunSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Sun className="h-12 w-12 text-amarelo-sol animate-spin" style={{ animationDuration: "2s" }} />
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

  // Step 2 - UCs + Energia
  const [ucs, setUcs] = useState<UCData[]>([createEmptyUC(1)]);
  const [grupo, setGrupo] = useState("B1");
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Step 3 - Premissas
  const [premissas, setPremissas] = useState<PremissasData>(DEFAULT_PREMISSAS);

  // Step 4 - Kit / Dimensionamento
  const [modulos, setModulos] = useState<CatalogoModulo[]>([]);
  const [inversores, setInversores] = useState<CatalogoInversor[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [itens, setItens] = useState<KitItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false },
  ]);

  // Step 5 - Serviços (placeholder)
  const [custoInstalacao, setCustoInstalacao] = useState(0);

  // Step 6 - Venda
  const [margem, setMargem] = useState(20);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  // Step 7 - Pagamento
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [selectedBanco, setSelectedBanco] = useState(0);
  const [parcelas, setParcelas] = useState(36);
  const [loadingBancos, setLoadingBancos] = useState(false);

  // Step 8 - Documento
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState("modelo_1");

  // ─── Data fetching ───────────────────────────────────
  useEffect(() => {
    setLoadingEquip(true);
    Promise.all([
      supabase.from("modulos_fotovoltaicos").select("id, fabricante, modelo, potencia_w").eq("ativo", true).order("potencia_w", { ascending: false }),
      supabase.from("inversores").select("id, fabricante, modelo, potencia_nominal_w").eq("ativo", true).order("potencia_nominal_w", { ascending: false }),
    ]).then(([modRes, invRes]) => {
      setModulos((modRes.data || []) as CatalogoModulo[]);
      setInversores((invRes.data || []) as CatalogoInversor[]);
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

  // ─── Kit items management ────────────────────────────
  const addItem = () => {
    setItens(prev => [...prev, { id: crypto.randomUUID(), descricao: "", fabricante: "", modelo: "", potencia_w: 0, quantidade: 1, preco_unitario: 0, categoria: "modulo", avulso: false }]);
  };
  const removeItem = (id: string) => setItens(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof KitItemRow, value: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addModuloAsItem = (mod: CatalogoModulo) => {
    const potW = mod.potencia_w || 0;
    const numPlacas = potenciaKwp > 0 ? Math.ceil((potenciaKwp * 1000) / potW) : 10;
    setItens(prev => [...prev, {
      id: crypto.randomUUID(), descricao: `${mod.fabricante} ${mod.modelo} ${potW}W`,
      fabricante: mod.fabricante, modelo: mod.modelo, potencia_w: potW,
      quantidade: numPlacas, preco_unitario: 0, categoria: "modulo", avulso: false,
    }]);
    toast({ title: `${mod.modelo} adicionado`, description: `${numPlacas} unidades` });
  };

  const addInversorAsItem = (inv: CatalogoInversor) => {
    setItens(prev => [...prev, {
      id: crypto.randomUUID(), descricao: `${inv.fabricante} ${inv.modelo} ${((inv.potencia_nominal_w || 0) / 1000).toFixed(1)}kW`,
      fabricante: inv.fabricante, modelo: inv.modelo, potencia_w: inv.potencia_nominal_w || 0,
      quantidade: 1, preco_unitario: 0, categoria: "inversor", avulso: false,
    }]);
    toast({ title: `${inv.modelo} adicionado` });
  };

  // ─── Calculations ────────────────────────────────────
  const subtotal = useMemo(() => itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0), [itens]);
  const custoTotal = subtotal + custoInstalacao;
  const margemValor = custoTotal * (margem / 100);
  const precoFinal = custoTotal + margemValor - (custoTotal * desconto / 100);

  const financingCalc = useMemo(() => {
    if (bancos.length === 0) return null;
    const bank = bancos[selectedBanco] || bancos[0];
    if (!bank) return null;
    const taxaMensal = bank.taxa_mensal / 100;
    const fator = Math.pow(1 + taxaMensal, parcelas);
    const valorParcela = precoFinal * (taxaMensal * fator) / (fator - 1);
    return { banco: bank.nome, parcelas, valorParcela, taxaMensal: bank.taxa_mensal };
  }, [selectedBanco, parcelas, precoFinal, bancos]);

  // ─── Validations ─────────────────────────────────────
  const consumoTotal = ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  const canStep = [
    /* 0 Cliente     */ !!selectedLead && !!cliente.nome,
    /* 1 Comercial   */ true, // optional
    /* 2 UCs         */ consumoTotal > 0 && potenciaKwp > 0,
    /* 3 Premissas   */ true, // has defaults
    /* 4 Kit         */ itens.length > 0 && itens.some(i => i.descricao),
    /* 5 Serviços    */ true,
    /* 6 Venda       */ margem >= 0,
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
      const uc1 = ucs[0];
      const payload: GenerateProposalPayload = {
        lead_id: selectedLead.id,
        grupo: grupo.startsWith("B") ? "B" : "A",
        idempotency_key: idempotencyKey,
        dados_tecnicos: {
          potencia_kwp: potenciaKwp,
          consumo_medio_kwh: consumoTotal,
          tipo_fase: uc1?.fase || "bifasico",
          estado: uc1?.estado || cliente.estado,
        },
        itens: itens.filter(i => i.descricao).map(({ descricao, quantidade, preco_unitario, categoria }) => ({
          descricao, quantidade, preco_unitario, categoria,
        })),
        desconto_percentual: desconto || undefined,
        observacoes: observacoes || undefined,
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

      localStorage.removeItem(DRAFT_KEY);
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
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => { if (isDone) setStep(i); }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap",
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
                <span className="hidden xl:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-2 h-px bg-border shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <AnimatePresence mode="wait">

            {/* ── STEP 0: Cliente ── */}
            {step === 0 && (
              <StepContent key="step0">
                <StepCliente
                  selectedLead={selectedLead}
                  onSelectLead={handleSelectLead}
                  onClearLead={() => setSelectedLead(null)}
                  cliente={cliente}
                  onClienteChange={setCliente}
                />
              </StepContent>
            )}

            {/* ── STEP 1: Comercial ── */}
            {step === 1 && (
              <StepContent key="step1">
                <StepComercial comercial={comercial} onComercialChange={setComercial} />
              </StepContent>
            )}

            {/* ── STEP 2: UCs + Energia ── */}
            {step === 2 && (
              <StepContent key="step2">
                <StepUCsEnergia
                  ucs={ucs} onUcsChange={setUcs}
                  grupo={grupo} onGrupoChange={setGrupo}
                  potenciaKwp={potenciaKwp} onPotenciaChange={setPotenciaKwp}
                />
              </StepContent>
            )}

            {/* ── STEP 3: Premissas ── */}
            {step === 3 && (
              <StepContent key="step3">
                <StepPremissas premissas={premissas} onPremissasChange={setPremissas} />
              </StepContent>
            )}

            {/* ── STEP 4: Kit / Dimensionamento ── */}
            {step === 4 && (
              <StepContent key="step4">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" /> Kit e Equipamentos
                  </h3>

                  {loadingEquip ? <SunSpinner message="Carregando equipamentos..." /> : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      {/* Módulos */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Módulos ({modulos.length})</Label>
                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                          {modulos.map(m => (
                            <div key={m.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-card text-sm">
                              <div className="min-w-0">
                                <p className="font-medium text-xs truncate">{m.fabricante} {m.modelo}</p>
                                <p className="text-[11px] text-muted-foreground">{m.potencia_w}W</p>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => addModuloAsItem(m)}>
                                <Plus className="h-3 w-3 mr-0.5" /> Add
                              </Button>
                            </div>
                          ))}
                          {modulos.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum módulo cadastrado</p>}
                        </div>
                      </div>

                      {/* Inversores */}
                      <div className="space-y-2">
                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Inversores ({inversores.length})</Label>
                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                          {inversores.map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/40 hover:border-primary/30 transition-colors bg-card text-sm">
                              <div className="min-w-0">
                                <p className="font-medium text-xs truncate">{inv.fabricante} {inv.modelo}</p>
                                <p className="text-[11px] text-muted-foreground">{((inv.potencia_nominal_w || 0) / 1000).toFixed(1)}kW</p>
                              </div>
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary" onClick={() => addInversorAsItem(inv)}>
                                <Plus className="h-3 w-3 mr-0.5" /> Add
                              </Button>
                            </div>
                          ))}
                          {inversores.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">Nenhum inversor cadastrado</p>}
                        </div>
                      </div>

                      {/* Kit selecionado */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Kit Selecionado</Label>
                          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={addItem}>
                            <Plus className="h-3 w-3" /> Item manual
                          </Button>
                        </div>
                        <div className="space-y-1.5 max-h-[240px] overflow-y-auto pr-1">
                          {itens.map(item => (
                            <div key={item.id} className="p-2 rounded-lg bg-muted/30 border border-border/30 text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <Input value={item.descricao} onChange={e => updateItem(item.id, "descricao", e.target.value)} placeholder="Descrição" className="h-7 text-xs flex-1" />
                                {itens.length > 1 && (
                                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive/60" onClick={() => removeItem(item.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-1">
                                <Input type="number" min={1} value={item.quantidade || ""} onChange={e => updateItem(item.id, "quantidade", Number(e.target.value))} placeholder="Qtd" className="h-7 text-xs" />
                                <Input type="number" min={0} step={0.01} value={item.preco_unitario || ""} onChange={e => updateItem(item.id, "preco_unitario", Number(e.target.value))} placeholder="R$ unit." className="h-7 text-xs" />
                                <Select value={item.categoria} onValueChange={v => updateItem(item.id, "categoria", v)}>
                                  <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </StepContent>
            )}

            {/* ── STEP 5: Serviços ── */}
            {step === 5 && (
              <StepContent key="step5">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Wrench className="h-4 w-4 text-primary" /> Serviços Adicionais
                  </h3>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Custo de Instalação (R$)</Label>
                      <Input type="number" min={0} value={custoInstalacao || ""} onChange={e => setCustoInstalacao(Number(e.target.value))} placeholder="R$ 0,00" className="h-9" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Serviços detalhados (múltiplos itens, comissão, etc.) serão expandidos nas próximas fases.
                    </p>
                  </div>
                </div>
              </StepContent>
            )}

            {/* ── STEP 6: Venda ── */}
            {step === 6 && (
              <StepContent key="step6">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" /> Precificação
                  </h3>

                  <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-muted/10">
                    <div className="flex items-center justify-between">
                      <Label className="font-semibold">Margem de Lucro</Label>
                      <Badge variant="secondary" className="text-sm font-bold">{margem}%</Badge>
                    </div>
                    <Slider value={[margem]} onValueChange={v => setMargem(v[0])} min={0} max={80} step={1} />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>0%</span><span>20%</span><span>40%</span><span>60%</span><span>80%</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Desconto (%)</Label>
                      <Input type="number" min={0} max={100} value={desconto || ""} onChange={e => setDesconto(Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Cost summary */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo de Custos</div>
                    <div className="divide-y divide-border/30">
                      <div className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">Custo Equipamentos</span>
                        <span className="font-medium">{formatBRL(subtotal)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">Custo Instalação</span>
                        <span className="font-medium">{formatBRL(custoInstalacao)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">Margem ({margem}%)</span>
                        <span className="font-medium text-success">{formatBRL(margemValor)}</span>
                      </div>
                      {desconto > 0 && (
                        <div className="flex justify-between px-4 py-2.5 text-sm">
                          <span className="text-muted-foreground">Desconto ({desconto}%)</span>
                          <span className="font-medium text-destructive">-{formatBRL(custoTotal * desconto / 100)}</span>
                        </div>
                      )}
                      <div className="flex justify-between px-4 py-3 text-base font-bold bg-primary/5">
                        <span>Preço Final</span>
                        <span className="text-primary">{formatBRL(precoFinal)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observações (opcional)</Label>
                    <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas..." rows={3} />
                  </div>
                </div>
              </StepContent>
            )}

            {/* ── STEP 7: Pagamento ── */}
            {step === 7 && (
              <StepContent key="step7">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Simulação de Financiamento
                  </h3>

                  {loadingBancos ? <SunSpinner message="Carregando bancos..." /> : bancos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum banco de financiamento cadastrado.</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bancos.map((bank, idx) => (
                          <button key={bank.id || idx} onClick={() => setSelectedBanco(idx)} className={cn(
                            "p-4 rounded-xl border-2 text-left transition-all",
                            selectedBanco === idx ? "border-primary bg-primary/5 shadow-sm" : "border-border/40 hover:border-border/70"
                          )}>
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-sm">{bank.nome}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{bank.taxa_mensal}% a.m. • até {bank.max_parcelas}x</p>
                          </button>
                        ))}
                      </div>

                      <div className="space-y-3 p-4 rounded-xl border border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Parcelas</Label>
                          <Badge variant="secondary" className="text-sm font-bold">{parcelas}x</Badge>
                        </div>
                        <Slider value={[parcelas]} onValueChange={v => setParcelas(v[0])} min={12} max={bancos[selectedBanco]?.max_parcelas || 60} step={6} />
                      </div>

                      {financingCalc && (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 text-center">
                            <p className="text-xs text-muted-foreground">Valor Total</p>
                            <p className="text-xl font-bold text-primary">{formatBRL(precoFinal)}</p>
                          </div>
                          <div className="p-4 rounded-xl bg-success/5 border border-success/15 text-center">
                            <p className="text-xs text-muted-foreground">Parcela ({financingCalc.parcelas}x)</p>
                            <p className="text-xl font-bold text-success">{formatBRL(financingCalc.valorParcela)}</p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{financingCalc.banco} • {financingCalc.taxaMensal}% a.m.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </StepContent>
            )}

            {/* ── STEP 8: Documento ── */}
            {step === 8 && (
              <StepContent key="step8">
                <div className="space-y-6">
                  {!result ? (
                    <div className="space-y-6">
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Gerar Proposta
                      </h3>

                      <div className="space-y-2">
                        <Label>Template</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {["modelo_1", "modelo_2"].map(t => (
                            <button key={t} onClick={() => setTemplateSelecionado(t)} className={cn(
                              "p-4 rounded-xl border-2 text-center transition-all",
                              templateSelecionado === t ? "border-primary bg-primary/5" : "border-border/40 hover:border-border/70"
                            )}>
                              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">{t === "modelo_1" ? "Modelo 1" : "Modelo 2"}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p>
                          <p className="text-sm font-semibold truncate">{cliente.nome || selectedLead?.nome}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Potência</p>
                          <p className="text-sm font-semibold">{potenciaKwp} kWp</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">UCs</p>
                          <p className="text-sm font-semibold">{ucs.length}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
                          <p className="text-sm font-semibold">{formatBRL(precoFinal)}</p>
                        </div>
                      </div>

                      <div className="text-center">
                        <Button size="lg" className="gap-2 min-w-[200px]" onClick={handleGenerate} disabled={generating}>
                          {generating ? <Sun className="h-5 w-5 animate-spin" style={{ animationDuration: "2s" }} /> : <Zap className="h-5 w-5" />}
                          {generating ? "Gerando..." : "Gerar PDF"}
                        </Button>
                      </div>

                      {generating && <SunSpinner message="Gerando proposta comercial..." />}
                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 text-center">
                          <p className="text-xs text-muted-foreground">Investimento</p>
                          <p className="text-lg font-bold text-primary">{formatBRL(result.valor_total)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-success/5 border border-success/15 text-center">
                          <p className="text-xs text-muted-foreground">Economia/mês</p>
                          <p className="text-lg font-bold text-success">{formatBRL(result.economia_mensal)}</p>
                        </div>
                        <div className="p-4 rounded-xl bg-info/5 border border-info/15 text-center">
                          <p className="text-xs text-muted-foreground">Payback</p>
                          <p className="text-lg font-bold text-info">{result.payback_meses} meses</p>
                        </div>
                      </div>

                      {rendering ? <SunSpinner message="Renderizando proposta..." /> : htmlPreview ? (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
                          <div className="border rounded-xl overflow-hidden bg-white shadow-sm" style={{ maxHeight: 600, overflow: "auto" }}>
                            <iframe srcDoc={htmlPreview} title="Proposta Preview" className="w-full border-0" style={{ height: 800, pointerEvents: "none" }} />
                          </div>
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-3 justify-center pt-4">
                        <Button onClick={handleViewDetail} className="gap-2">Ver Detalhes</Button>
                        <Button variant="outline" onClick={handleNewVersion} className="gap-2"><Plus className="h-4 w-4" /> Nova Versão</Button>
                        <Button variant="ghost" onClick={() => setStep(2)}>Voltar e Editar</Button>
                      </div>
                    </div>
                  )}
                </div>
              </StepContent>
            )}

          </AnimatePresence>
        </CardContent>
      </Card>

      {/* ── Navigation Footer ── */}
      {step < 8 && !result && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{step + 1} / {STEPS.length}</span>
            <Button onClick={() => setStep(step + 1)} disabled={!canStep[step]} className="gap-1">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
      {step === 8 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => setStep(7)} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
