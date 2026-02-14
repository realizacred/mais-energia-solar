import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Zap, Loader2, Check, Search, Plus, Trash2,
  MapPin, BarChart3, Package, DollarSign, CreditCard, FileText, Sun,
  Building2, SlidersHorizontal,
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

// ─── Constants ─────────────────────────────────────────────

const STEPS = [
  { label: "Localização", icon: MapPin },
  { label: "Consumo", icon: BarChart3 },
  { label: "Dimensionamento", icon: Package },
  { label: "Precificação", icon: SlidersHorizontal },
  { label: "Pagamento", icon: CreditCard },
  { label: "Documento", icon: FileText },
];

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const TIPO_TELHADO_OPTIONS = [
  "Fibrocimento", "Metálico", "Laje", "Cerâmico", "Solo", "Outro",
];

const GRUPO_OPTIONS = [
  { value: "B1", label: "B1 - Residencial" },
  { value: "B2", label: "B2 - Rural" },
  { value: "B3", label: "B3 - Comercial" },
  { value: "A", label: "Grupo A - Alta Tensão" },
];

const CATEGORIAS = [
  { value: "modulo", label: "Módulo" },
  { value: "inversor", label: "Inversor" },
  { value: "estrutura", label: "Estrutura" },
  { value: "mao_obra", label: "Mão de obra" },
  { value: "outros", label: "Outros" },
];

interface ItemRow {
  id: string;
  descricao: string;
  quantidade: number;
  preco_unitario: number;
  categoria: string;
}

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
}

interface Modulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_w: number | null;
}

interface Inversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_w: number | null;
}

interface BancoFinanciamento {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
}

const DRAFT_KEY = "proposal_wizard_draft_v2";
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

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ─── Sun Loading Spinner ──────────────────────────────────

function SunSpinner({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <Sun className="h-12 w-12 text-amarelo-sol animate-spin" style={{ animationDuration: "2s" }} />
      {message && <p className="text-sm font-medium text-muted-foreground animate-pulse">{message}</p>}
    </div>
  );
}

// ─── Step Content Wrapper ─────────────────────────────────

function StepContent({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────

export function ProposalWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 0 - Localização / Lead
  const [leadSearch, setLeadSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [estado, setEstado] = useState("");
  const [tipoTelhado, setTipoTelhado] = useState("");
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [selectedConcessionaria, setSelectedConcessionaria] = useState("");
  const [loadingConc, setLoadingConc] = useState(false);

  // Step 1 - Consumo
  const [grupo, setGrupo] = useState("B1");
  const [tipoFase, setTipoFase] = useState<"monofasico" | "bifasico" | "trifasico">("bifasico");
  const [consumoMedio, setConsumoMedio] = useState<number>(0);
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);
  const [tarifaTE, setTarifaTE] = useState<number>(0);
  const [tarifaTUSD, setTarifaTUSD] = useState<number>(0);

  // Step 2 - Dimensionamento
  const [modulos, setModulos] = useState<Modulo[]>([]);
  const [inversores, setInversores] = useState<Inversor[]>([]);
  const [loadingEquip, setLoadingEquip] = useState(false);
  const [itens, setItens] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", quantidade: 1, preco_unitario: 0, categoria: "modulo" },
  ]);

  // Step 3 - Precificação
  const [margem, setMargem] = useState(20);
  const [custoInstalacao, setCustoInstalacao] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  // Step 4 - Pagamento
  const [bancos, setBancos] = useState<BancoFinanciamento[]>([]);
  const [selectedBanco, setSelectedBanco] = useState(0);
  const [parcelas, setParcelas] = useState(36);
  const [loadingBancos, setLoadingBancos] = useState(false);

  // Step 5 - Documento
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [templateSelecionado, setTemplateSelecionado] = useState("modelo_1");

  // ─── Data fetching ─────────────────────────────────────

  // Fetch leads
  const fetchLeads = useCallback(async (q: string) => {
    setSearchingLeads(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, lead_code, estado, consumo_kwh, media_consumo, status, cidade, tipo_telhado, rede_atendimento")
        .order("created_at", { ascending: false })
        .limit(20);
      if (q.length >= 2) {
        query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,lead_code.ilike.%${q}%`);
      }
      const { data } = await query;
      setLeads(data || []);
    } catch { setLeads([]); }
    finally { setSearchingLeads(false); }
  }, []);

  useEffect(() => { fetchLeads(""); }, [fetchLeads]);
  useEffect(() => {
    const t = setTimeout(() => fetchLeads(leadSearch), 300);
    return () => clearTimeout(t);
  }, [leadSearch, fetchLeads]);

  // Fetch concessionárias by estado
  useEffect(() => {
    if (!estado) { setConcessionarias([]); return; }
    setLoadingConc(true);
    supabase
      .from("concessionarias")
      .select("id, nome, sigla, estado, tarifa_energia, tarifa_fio_b")
      .eq("ativo", true)
      .eq("estado", estado)
      .order("nome")
      .then(({ data }) => {
        setConcessionarias((data || []) as Concessionaria[]);
        setLoadingConc(false);
      });
  }, [estado]);

  // Fetch equipment
  useEffect(() => {
    setLoadingEquip(true);
    Promise.all([
      supabase.from("modulos_fotovoltaicos").select("id, fabricante, modelo, potencia_w").eq("ativo", true).order("potencia_w", { ascending: false }),
      supabase.from("inversores").select("id, fabricante, modelo, potencia_nominal_w").eq("ativo", true).order("potencia_nominal_w", { ascending: false }),
    ]).then(([modRes, invRes]) => {
      setModulos((modRes.data || []) as Modulo[]);
      setInversores((invRes.data || []) as Inversor[]);
      setLoadingEquip(false);
    });
  }, []);

  // Fetch banks
  useEffect(() => {
    setLoadingBancos(true);
    supabase.rpc("get_active_financing_banks").then(({ data }) => {
      const banks = (data || []) as BancoFinanciamento[];
      setBancos(banks);
      setLoadingBancos(false);
    });
  }, []);

  // ─── Select lead ─────────────────────────────────────

  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead);
    if (lead.estado) setEstado(lead.estado);
    if (lead.consumo_kwh || lead.media_consumo) setConsumoMedio(lead.consumo_kwh || lead.media_consumo);
    if (lead.tipo_telhado) setTipoTelhado(lead.tipo_telhado);
    setLeadSearch("");
  };

  // ─── Update tariff from concessionária ───────────────

  useEffect(() => {
    const conc = concessionarias.find(c => c.id === selectedConcessionaria);
    if (conc) {
      setTarifaTE(conc.tarifa_energia || 0);
      setTarifaTUSD(conc.tarifa_fio_b || 0);
    }
  }, [selectedConcessionaria, concessionarias]);

  // ─── Itens management ────────────────────────────────

  const addItem = () => {
    setItens(prev => [...prev, { id: crypto.randomUUID(), descricao: "", quantidade: 1, preco_unitario: 0, categoria: "modulo" }]);
  };
  const removeItem = (id: string) => setItens(prev => prev.filter(i => i.id !== id));
  const updateItem = (id: string, field: keyof ItemRow, value: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const addModuloAsItem = (mod: Modulo) => {
    const potW = mod.potencia_w || 0;
    const numPlacas = potenciaKwp > 0 ? Math.ceil((potenciaKwp * 1000) / potW) : 10;
    setItens(prev => [...prev, {
      id: crypto.randomUUID(),
      descricao: `${mod.fabricante} ${mod.modelo} ${potW}W`,
      quantidade: numPlacas,
      preco_unitario: 0,
      categoria: "modulo",
    }]);
    toast({ title: `${mod.modelo} adicionado`, description: `${numPlacas} unidades` });
  };

  const addInversorAsItem = (inv: Inversor) => {
    setItens(prev => [...prev, {
      id: crypto.randomUUID(),
      descricao: `${inv.fabricante} ${inv.modelo} ${((inv.potencia_nominal_w || 0) / 1000).toFixed(1)}kW`,
      quantidade: 1,
      preco_unitario: 0,
      categoria: "inversor",
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

  const canStep = [
    /* 0 */ !!selectedLead && !!estado && !!tipoTelhado,
    /* 1 */ consumoMedio > 0 && potenciaKwp > 0,
    /* 2 */ itens.length > 0 && itens.some(i => i.descricao),
    /* 3 */ margem >= 0,
    /* 4 */ true,
    /* 5 */ true,
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
        dados_tecnicos: {
          potencia_kwp: potenciaKwp,
          consumo_medio_kwh: consumoMedio,
          tipo_fase: tipoFase,
          estado,
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
    setStep(1);
  };

  const handleViewDetail = () => {
    if (result) navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
  };

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Stepper ── */}
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.label} className="flex items-center gap-1 flex-1">
              <button
                onClick={() => { if (isDone) setStep(i); }}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                  isDone && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15",
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
                <span className="hidden lg:block truncate">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border min-w-[12px]" />}
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="pt-6 pb-6">
          <AnimatePresence mode="wait">
            {/* ── STEP 0: Localização ── */}
            {step === 0 && (
              <StepContent key="step0">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Localização e Cliente
                  </h3>

                  {/* Lead selection */}
                  {selectedLead ? (
                    <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/15">
                      <div>
                        <p className="font-semibold">{selectedLead.nome}</p>
                        <p className="text-sm text-muted-foreground">{selectedLead.telefone} • {selectedLead.lead_code}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedLead(null)}>Trocar</Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Buscar lead..." className="pl-9" value={leadSearch} onChange={e => setLeadSearch(e.target.value)} />
                      </div>
                      {searchingLeads ? <SunSpinner message="Buscando leads..." /> : leads.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead encontrado.</p>
                      ) : (
                        <div className="border rounded-xl divide-y max-h-60 overflow-y-auto">
                          {leads.map(l => (
                            <button key={l.id} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors" onClick={() => handleSelectLead(l)}>
                              <p className="font-medium text-sm truncate">{l.nome}</p>
                              <p className="text-xs text-muted-foreground">{l.telefone} • {l.lead_code}{l.estado ? ` • ${l.estado}` : ""}</p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Telhado *</Label>
                      <Select value={tipoTelhado} onValueChange={setTipoTelhado}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {TIPO_TELHADO_OPTIONS.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Estado (UF) *</Label>
                      <Select value={estado} onValueChange={setEstado}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                          {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Distribuidora de Energia</Label>
                      {loadingConc ? (
                        <Skeleton className="h-10 w-full rounded-md" />
                      ) : (
                        <Select value={selectedConcessionaria} onValueChange={setSelectedConcessionaria}>
                          <SelectTrigger><SelectValue placeholder={concessionarias.length ? "Selecione..." : "Selecione o estado primeiro"} /></SelectTrigger>
                          <SelectContent>
                            {concessionarias.map(c => (
                              <SelectItem key={c.id} value={c.id}>{c.sigla ? `${c.sigla} - ` : ""}{c.nome}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </div>
              </StepContent>
            )}

            {/* ── STEP 1: Consumo ── */}
            {step === 1 && (
              <StepContent key="step1">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-primary" /> Consumo e Tarifas
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Grupo Tarifário</Label>
                      <Select value={grupo} onValueChange={setGrupo}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GRUPO_OPTIONS.map(g => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tipo de Fase</Label>
                      <Select value={tipoFase} onValueChange={v => setTipoFase(v as any)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monofasico">Monofásico</SelectItem>
                          <SelectItem value="bifasico">Bifásico</SelectItem>
                          <SelectItem value="trifasico">Trifásico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tariff table */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Tarifas
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">TE (R$/kWh)</Label>
                        <Input type="number" step={0.01} value={tarifaTE || ""} onChange={e => setTarifaTE(Number(e.target.value))} className="h-9" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">TUSD (R$/kWh)</Label>
                        <Input type="number" step={0.01} value={tarifaTUSD || ""} onChange={e => setTarifaTUSD(Number(e.target.value))} className="h-9" />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Consumo Médio (kWh/mês) *</Label>
                      <Input type="number" min={0} value={consumoMedio || ""} onChange={e => setConsumoMedio(Number(e.target.value))} placeholder="Ex: 500" />
                    </div>
                    <div className="space-y-2">
                      <Label>Potência do Sistema (kWp) *</Label>
                      <Input type="number" min={0} step={0.1} value={potenciaKwp || ""} onChange={e => setPotenciaKwp(Number(e.target.value))} placeholder="Ex: 6.6" />
                    </div>
                  </div>
                </div>
              </StepContent>
            )}

            {/* ── STEP 2: Dimensionamento ── */}
            {step === 2 && (
              <StepContent key="step2">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" /> Dimensionamento e Kits
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
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" onClick={() => addModuloAsItem(m)}>
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
                              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-primary hover:text-primary" onClick={() => addInversorAsItem(inv)}>
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

            {/* ── STEP 3: Precificação ── */}
            {step === 3 && (
              <StepContent key="step3">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <SlidersHorizontal className="h-4 w-4 text-primary" /> Precificação
                  </h3>

                  {/* Margin Slider */}
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
                      <Label>Custo de Instalação (R$)</Label>
                      <Input type="number" min={0} value={custoInstalacao || ""} onChange={e => setCustoInstalacao(Number(e.target.value))} placeholder="R$ 0,00" />
                    </div>
                    <div className="space-y-2">
                      <Label>Desconto (%)</Label>
                      <Input type="number" min={0} max={100} value={desconto || ""} onChange={e => setDesconto(Number(e.target.value))} />
                    </div>
                  </div>

                  {/* Cost summary table */}
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="bg-muted/30 px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Resumo de Custos
                    </div>
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

            {/* ── STEP 4: Pagamento ── */}
            {step === 4 && (
              <StepContent key="step4">
                <div className="space-y-5">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Simulação de Financiamento
                  </h3>

                  {loadingBancos ? <SunSpinner message="Carregando bancos..." /> : bancos.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhum banco de financiamento cadastrado.</p>
                  ) : (
                    <div className="space-y-4">
                      {/* Bank list */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {bancos.map((bank, idx) => (
                          <button
                            key={bank.id || idx}
                            onClick={() => setSelectedBanco(idx)}
                            className={cn(
                              "p-4 rounded-xl border-2 text-left transition-all",
                              selectedBanco === idx
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border/40 hover:border-border/70"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                              <span className="font-semibold text-sm">{bank.nome}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{bank.taxa_mensal}% a.m. • até {bank.max_parcelas}x</p>
                          </button>
                        ))}
                      </div>

                      {/* Parcelas slider */}
                      <div className="space-y-3 p-4 rounded-xl border border-border/50">
                        <div className="flex items-center justify-between">
                          <Label className="font-semibold">Parcelas</Label>
                          <Badge variant="secondary" className="text-sm font-bold">{parcelas}x</Badge>
                        </div>
                        <Slider
                          value={[parcelas]}
                          onValueChange={v => setParcelas(v[0])}
                          min={12}
                          max={bancos[selectedBanco]?.max_parcelas || 60}
                          step={6}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>12x</span><span>24x</span><span>36x</span><span>48x</span><span>60x</span>
                        </div>
                      </div>

                      {/* Result */}
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

            {/* ── STEP 5: Documento ── */}
            {step === 5 && (
              <StepContent key="step5">
                <div className="space-y-6">
                  {!result ? (
                    <div className="space-y-6">
                      <h3 className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" /> Gerar Proposta
                      </h3>

                      {/* Template selection */}
                      <div className="space-y-2">
                        <Label>Template</Label>
                        <div className="grid grid-cols-2 gap-3">
                          {["modelo_1", "modelo_2"].map(t => (
                            <button
                              key={t}
                              onClick={() => setTemplateSelecionado(t)}
                              className={cn(
                                "p-4 rounded-xl border-2 text-center transition-all",
                                templateSelecionado === t
                                  ? "border-primary bg-primary/5"
                                  : "border-border/40 hover:border-border/70"
                              )}
                            >
                              <FileText className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm font-medium">{t === "modelo_1" ? "Modelo 1" : "Modelo 2"}</p>
                              <p className="text-[10px] text-muted-foreground">Proposta Comercial</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Summary */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Cliente</p>
                          <p className="text-sm font-semibold truncate">{selectedLead?.nome}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Potência</p>
                          <p className="text-sm font-semibold">{potenciaKwp} kWp</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Grupo</p>
                          <p className="text-sm font-semibold">{grupo}</p>
                        </div>
                        <div className="p-3 rounded-lg bg-muted/50">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
                          <p className="text-sm font-semibold">{formatBRL(precoFinal)}</p>
                        </div>
                      </div>

                      {/* Generate button */}
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
                      {/* Result summary */}
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
                        <Button variant="ghost" onClick={() => setStep(1)}>Voltar e Editar</Button>
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
      {step < 5 && !result && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button onClick={() => setStep(step + 1)} disabled={!canStep[step]} className="gap-1">
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 5 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => setStep(4)} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
