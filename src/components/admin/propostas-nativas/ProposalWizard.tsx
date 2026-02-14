import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Zap, Loader2, Check, Search, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateProposal, renderProposal, type GenerateProposalPayload } from "@/services/proposalApi";

const STEPS = ["Lead / Cliente", "Dados Técnicos", "Equipamentos", "Gerar Proposta"];

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
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

const DRAFT_KEY = "proposal_wizard_draft";
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

export function ProposalWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  // Step 1 - Lead
  const [leadSearch, setLeadSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [searchingLeads, setSearchingLeads] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // Step 2 - Dados técnicos
  const [grupo, setGrupo] = useState<"A" | "B">("B");
  const [estado, setEstado] = useState("");
  const [tipoFase, setTipoFase] = useState<"monofasico" | "bifasico" | "trifasico">("bifasico");
  const [consumoMedio, setConsumoMedio] = useState<number>(0);
  const [potenciaKwp, setPotenciaKwp] = useState<number>(0);

  // Step 3 - Itens
  const [itens, setItens] = useState<ItemRow[]>([
    { id: crypto.randomUUID(), descricao: "", quantidade: 1, preco_unitario: 0, categoria: "modulo" },
  ]);
  const [desconto, setDesconto] = useState(0);
  const [observacoes, setObservacoes] = useState("");

  // Step 4 - Resultado
  const [generating, setGenerating] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);

  // Auto-save draft
  useEffect(() => {
    const draft = {
      selectedLead,
      grupo,
      estado,
      tipoFase,
      consumoMedio,
      potenciaKwp,
      itens,
      desconto,
      observacoes,
      step,
    };
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch { /* ignore */ }
  }, [selectedLead, grupo, estado, tipoFase, consumoMedio, potenciaKwp, itens, desconto, observacoes, step]);

  // Restore draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved);
        if (d.selectedLead) setSelectedLead(d.selectedLead);
        if (d.grupo) setGrupo(d.grupo);
        if (d.estado) setEstado(d.estado);
        if (d.tipoFase) setTipoFase(d.tipoFase);
        if (d.consumoMedio) setConsumoMedio(d.consumoMedio);
        if (d.potenciaKwp) setPotenciaKwp(d.potenciaKwp);
        if (d.itens?.length) setItens(d.itens);
        if (d.desconto) setDesconto(d.desconto);
        if (d.observacoes) setObservacoes(d.observacoes);
        if (d.step != null) setStep(d.step);
      }
    } catch { /* ignore */ }
  }, []);

  // Search leads
  const searchLeads = useCallback(async (q: string) => {
    if (q.length < 2) { setLeads([]); return; }
    setSearchingLeads(true);
    try {
      const { data } = await supabase
        .from("leads")
        .select("id, nome, telefone, lead_code, estado, consumo_kwh")
        .or(`nome.ilike.%${q}%,telefone.ilike.%${q}%,lead_code.ilike.%${q}%`)
        .order("created_at", { ascending: false })
        .limit(10);
      setLeads(data || []);
    } catch {
      setLeads([]);
    } finally {
      setSearchingLeads(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => searchLeads(leadSearch), 300);
    return () => clearTimeout(t);
  }, [leadSearch, searchLeads]);

  // Select lead and pre-fill
  const handleSelectLead = (lead: any) => {
    setSelectedLead(lead);
    if (lead.estado) setEstado(lead.estado);
    if (lead.consumo_kwh) setConsumoMedio(lead.consumo_kwh);
    setLeadSearch("");
    setLeads([]);
  };

  // Itens management
  const addItem = () => {
    setItens(prev => [...prev, { id: crypto.randomUUID(), descricao: "", quantidade: 1, preco_unitario: 0, categoria: "modulo" }]);
  };
  const removeItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id));
  };
  const updateItem = (id: string, field: keyof ItemRow, value: any) => {
    setItens(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };

  const subtotal = useMemo(() =>
    itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0),
    [itens]
  );

  // Validations
  const canGoStep2 = !!selectedLead;
  const canGoStep3 = estado && consumoMedio > 0 && potenciaKwp > 0;
  const canGoStep4 = itens.length > 0 && itens.every(i => i.descricao && i.quantidade > 0 && i.preco_unitario > 0);

  // Generate
  const handleGenerate = async () => {
    if (!selectedLead) return;
    setGenerating(true);
    setHtmlPreview(null);
    setResult(null);

    try {
      const idempotencyKey = getOrCreateIdempotencyKey(selectedLead.id);

      const payload: GenerateProposalPayload = {
        lead_id: selectedLead.id,
        grupo,
        idempotency_key: idempotencyKey,
        dados_tecnicos: {
          potencia_kwp: potenciaKwp,
          consumo_medio_kwh: consumoMedio,
          tipo_fase: tipoFase,
          estado,
        },
        itens: itens.map(({ descricao, quantidade, preco_unitario, categoria }) => ({
          descricao, quantidade, preco_unitario, categoria,
        })),
        desconto_percentual: desconto || undefined,
        observacoes: observacoes || undefined,
      };

      const genResult = await generateProposal(payload);
      setResult(genResult);

      // Now render
      setRendering(true);
      try {
        const renderResult = await renderProposal(genResult.versao_id);
        setHtmlPreview(renderResult.html);
      } catch (e: any) {
        toast({ title: "Erro ao renderizar", description: e.message, variant: "destructive" });
      } finally {
        setRendering(false);
      }

      // Clear draft on success
      localStorage.removeItem(DRAFT_KEY);

      toast({ title: "Proposta gerada!", description: `Versão ${genResult.versao_numero} criada.` });
    } catch (e: any) {
      toast({ title: "Erro ao gerar proposta", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleNewVersion = () => {
    if (selectedLead) clearIdempotencyKey(selectedLead.id);
    setResult(null);
    setHtmlPreview(null);
    setStep(1); // back to tech data
  };

  const handleViewDetail = () => {
    if (result) {
      navigate(`/admin/propostas-nativas/${result.proposta_id}/versoes/${result.versao_id}`);
    }
  };

  const formatBRL = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 flex-1">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0
                transition-all duration-200
                ${i < step ? "bg-primary text-primary-foreground" : ""}
                ${i === step ? "bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background" : ""}
                ${i > step ? "bg-muted text-muted-foreground" : ""}
              `}
            >
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block truncate ${i === step ? "text-foreground" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="flex-1 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <Card className="border-border/60">
        <CardContent className="pt-6">
          {/* STEP 1: Lead */}
          {step === 0 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Selecionar Lead</h3>

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
                    <Input
                      placeholder="Buscar por nome, telefone ou código..."
                      className="pl-9"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                    />
                  </div>
                  {searchingLeads && <p className="text-sm text-muted-foreground">Buscando...</p>}
                  {leads.length > 0 && (
                    <div className="border rounded-xl divide-y max-h-64 overflow-y-auto">
                      {leads.map((l) => (
                        <button
                          key={l.id}
                          className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors"
                          onClick={() => handleSelectLead(l)}
                        >
                          <p className="font-medium text-sm">{l.nome}</p>
                          <p className="text-xs text-muted-foreground">{l.telefone} • {l.lead_code} • {l.estado}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* STEP 2: Dados Técnicos */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-base font-semibold">Dados Técnicos</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grupo Tarifário</Label>
                  <Select value={grupo} onValueChange={(v) => setGrupo(v as "A" | "B")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="B">Grupo B (Residencial / Comercial pequeno)</SelectItem>
                      <SelectItem value="A">Grupo A (Alta tensão)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Estado (UF)</Label>
                  <Select value={estado} onValueChange={setEstado}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Fase</Label>
                  <Select value={tipoFase} onValueChange={(v) => setTipoFase(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monofasico">Monofásico</SelectItem>
                      <SelectItem value="bifasico">Bifásico</SelectItem>
                      <SelectItem value="trifasico">Trifásico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Consumo Médio (kWh/mês)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={consumoMedio || ""}
                    onChange={(e) => setConsumoMedio(Number(e.target.value))}
                    placeholder="Ex: 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Potência do Sistema (kWp)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={potenciaKwp || ""}
                    onChange={(e) => setPotenciaKwp(Number(e.target.value))}
                    placeholder="Ex: 6.6"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Itens */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold">Equipamentos</h3>
                <Button variant="outline" size="sm" onClick={addItem} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Adicionar item
                </Button>
              </div>

              <div className="space-y-3">
                {itens.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/30 border border-border/40">
                    <div className="col-span-12 sm:col-span-4 space-y-1">
                      <Label className="text-xs">Descrição</Label>
                      <Input
                        value={item.descricao}
                        onChange={(e) => updateItem(item.id, "descricao", e.target.value)}
                        placeholder="Ex: Módulo 555W"
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Categoria</Label>
                      <Select value={item.categoria} onValueChange={(v) => updateItem(item.id, "categoria", v)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3 sm:col-span-2 space-y-1">
                      <Label className="text-xs">Qtd</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade || ""}
                        onChange={(e) => updateItem(item.id, "quantidade", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-4 sm:col-span-3 space-y-1">
                      <Label className="text-xs">Preço Unit. (R$)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.preco_unitario || ""}
                        onChange={(e) => updateItem(item.id, "preco_unitario", Number(e.target.value))}
                        className="h-9"
                      />
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {itens.length > 1 && (
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/70 hover:text-destructive" onClick={() => removeItem(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t">
                <div className="space-y-2 w-48">
                  <Label className="text-xs">Desconto (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={desconto || ""}
                    onChange={(e) => setDesconto(Number(e.target.value))}
                    className="h-9"
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Subtotal equipamentos</p>
                  <p className="text-xl font-bold">{formatBRL(subtotal)}</p>
                  {desconto > 0 && (
                    <p className="text-sm text-success">- {formatBRL(subtotal * desconto / 100)} ({desconto}%)</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  placeholder="Notas adicionais para a proposta..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {/* STEP 4: Gerar */}
          {step === 3 && (
            <div className="space-y-6">
              {!result ? (
                <div className="text-center py-8 space-y-4">
                  <h3 className="text-base font-semibold">Pronto para gerar!</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Revise os dados e clique para gerar a proposta. O cálculo completo com Lei 14.300 será aplicado automaticamente.
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
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
                      <p className="text-sm font-semibold">Grupo {grupo}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Investimento</p>
                      <p className="text-sm font-semibold">{formatBRL(subtotal * (1 - desconto / 100))}</p>
                    </div>
                  </div>
                  <Button
                    size="lg"
                    className="gap-2 mt-4"
                    onClick={handleGenerate}
                    disabled={generating}
                  >
                    {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {generating ? "Gerando..." : "Gerar Proposta"}
                  </Button>
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

                  {/* HTML Preview */}
                  {rendering ? (
                    <div className="space-y-3">
                      <Skeleton className="h-6 w-48" />
                      <Skeleton className="h-[400px] w-full rounded-xl" />
                    </div>
                  ) : htmlPreview ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-muted-foreground">Pré-visualização</p>
                      <div
                        className="border rounded-xl overflow-hidden bg-white shadow-sm"
                        style={{ maxHeight: 600, overflow: "auto" }}
                      >
                        <iframe
                          srcDoc={htmlPreview}
                          title="Proposta Preview"
                          className="w-full border-0"
                          style={{ height: 800, pointerEvents: "none" }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Actions */}
                  <div className="flex flex-wrap gap-3 justify-center pt-4">
                    <Button onClick={handleViewDetail} className="gap-2">
                      Ver Detalhes
                    </Button>
                    <Button variant="outline" onClick={handleNewVersion} className="gap-2">
                      <Plus className="h-4 w-4" /> Nova Versão
                    </Button>
                    <Button variant="ghost" onClick={() => setStep(1)}>
                      Voltar e Editar
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Footer */}
      {step < 3 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
          <Button
            onClick={() => setStep(step + 1)}
            disabled={
              (step === 0 && !canGoStep2) ||
              (step === 1 && !canGoStep3) ||
              (step === 2 && !canGoStep4)
            }
            className="gap-1"
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
      {step === 3 && !result && (
        <div className="flex justify-start">
          <Button variant="ghost" onClick={() => setStep(2)} className="gap-1">
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>
        </div>
      )}
    </div>
  );
}
