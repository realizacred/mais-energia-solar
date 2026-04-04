import { useState, useMemo, useEffect, useCallback } from "react";
import { Plus, Trash2, Edit2, Save, X, Variable, TestTube, Info, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "@/hooks/use-toast";
import { validateExpression, evaluate, extractVariables, SUPPORTED_FUNCTIONS } from "@/lib/expressionEngine";
import { useVariaveisCustom, useSalvarVariavelCustom, useDeletarVariavelCustom } from "@/hooks/useVariaveisCustom";


interface VariavelCustom {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
}

const CATEGORIAS = [
  { value: "geral", label: "Geral" },
  { value: "financeiro", label: "Financeiro" },
  { value: "tecnico", label: "Técnico" },
  { value: "comercial", label: "Comercial" },
];

const TIPOS = [
  { value: "number", label: "Número" },
  { value: "currency", label: "Moeda (R$)" },
  { value: "percent", label: "Percentual (%)" },
  { value: "text", label: "Texto" },
];

const VARIAVEIS_DISPONIVEIS = [
  { nome: "valor_total", desc: "Investimento total (R$)" },
  { nome: "economia_mensal", desc: "Economia mensal (R$)" },
  { nome: "economia_anual", desc: "Economia anual (R$)" },
  { nome: "payback_meses", desc: "Payback em meses" },
  { nome: "payback_anos", desc: "Payback em anos" },
  { nome: "potencia_kwp", desc: "Potência do sistema (kWp)" },
  { nome: "consumo_total", desc: "Consumo total mensal (kWh)" },
  { nome: "geracao_estimada", desc: "Geração estimada mensal (kWh)" },
  { nome: "custo_kit", desc: "Custo do kit (R$)" },
  { nome: "margem_percentual", desc: "Margem (%)" },
  { nome: "desconto_percentual", desc: "Desconto (%)" },
  { nome: "vpl", desc: "VPL (R$)" },
  { nome: "tir", desc: "TIR (%)" },
  { nome: "roi_25_anos", desc: "ROI em 25 anos (R$)" },
  { nome: "num_modulos", desc: "Quantidade de módulos" },
  { nome: "num_ucs", desc: "Quantidade de UCs" },
  { nome: "preco", desc: "Preço (alias de valor_total)" },
];

export function VariaveisCustomManager() {
  const { data: variaveis = [], isLoading: loading } = useVariaveisCustom();
  const salvarMutation = useSalvarVariavelCustom();
  const deletarMutation = useDeletarVariavelCustom();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<VariavelCustom>>({});
  const [editBaseline, setEditBaseline] = useState<string>("");
  const [testResult, setTestResult] = useState<string | null>(null);
  const [livePreview, setLivePreview] = useState<string | null>(null);
  const [copiedVar, setCopiedVar] = useState<string | null>(null);
  const [showFunctions, setShowFunctions] = useState(false);

  const isEditDirty = useMemo(() => {
    if (!editingId) return false;
    if (editingId === "new") {
      return !!(form.nome && form.nome !== "vc_" && form.label && form.expressao);
    }
    return JSON.stringify(form) !== editBaseline;
  }, [form, editBaseline, editingId]);

  // Live preview as user types
  useEffect(() => {
    if (!form.expressao || form.expressao.trim() === "") {
      setLivePreview(null);
      return;
    }
    const timer = setTimeout(() => {
      try {
        const validation = validateExpression(form.expressao!);
        if (!validation.valid) {
          setLivePreview(`⚠️ ${validation.error}`);
          return;
        }
        const ctx: Record<string, number> = {};
        VARIAVEIS_DISPONIVEIS.forEach(v => { ctx[v.nome] = 1000; });
        // Also include other custom vars as test values
        variaveis.forEach(v => { if (!ctx[v.nome]) ctx[v.nome] = 500; });
        const result = evaluate(form.expressao!, ctx);
        if (result !== null) {
          setLivePreview(`📊 Preview (vars=1000): ${result}`);
        } else {
          setLivePreview("⚠️ Resultado nulo — verifique a expressão");
        }
      } catch {
        setLivePreview(null);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [form.expressao, variaveis]);

  const startNew = () => {
    setEditingId("new");
    setForm({
      nome: "vc_", label: "", expressao: "", tipo_resultado: "number",
      categoria: "geral", ordem: variaveis.length, ativo: true, descricao: "",
    });
    setTestResult(null);
    setLivePreview(null);
  };

  const startEdit = (v: VariavelCustom) => {
    setEditingId(v.id);
    const formData = { ...v };
    setForm(formData);
    setEditBaseline(JSON.stringify(formData));
    setTestResult(null);
  };

  const cancelEdit = () => { setEditingId(null); setForm({}); setTestResult(null); setLivePreview(null); };

  const handleTest = () => {
    if (!form.expressao) return;
    const validation = validateExpression(form.expressao);
    if (!validation.valid) {
      setTestResult(`❌ ${validation.error}`);
      return;
    }
    const ctx: Record<string, number> = {};
    VARIAVEIS_DISPONIVEIS.forEach(v => { ctx[v.nome] = 1000; });
    variaveis.forEach(v => { if (!ctx[v.nome]) ctx[v.nome] = 500; });
    const result = evaluate(form.expressao, ctx);
    setTestResult(result !== null ? `✅ Resultado (com valores de teste = 1000): ${result}` : "⚠️ Resultado nulo");
  };

  const handleSave = async () => {
    if (!form.nome || !form.label || !form.expressao) {
      toast({ title: "Preencha nome, label e expressão", variant: "destructive" });
      return;
    }
    if (!form.nome.startsWith("vc_")) {
      toast({ title: "Nome deve começar com vc_", variant: "destructive" });
      return;
    }
    const validation = validateExpression(form.expressao);
    if (!validation.valid) {
      toast({ title: "Expressão inválida", description: validation.error, variant: "destructive" });
      return;
    }

    // Check for circular dependencies
    const deps = extractVariables(form.expressao);
    if (deps.includes(form.nome)) {
      toast({ title: "Referência circular", description: "A variável não pode referenciar a si mesma", variant: "destructive" });
      return;
    }

    try {
      const payload: Record<string, unknown> = {
        nome: form.nome, label: form.label, expressao: form.expressao,
        tipo_resultado: form.tipo_resultado || "number",
        categoria: form.categoria || "geral",
        ordem: form.ordem || 0, ativo: form.ativo ?? true,
        descricao: form.descricao || null,
      };
      if (editingId === "new") {
        await salvarMutation.mutateAsync(payload);
        toast({ title: "Variável criada!" });
      } else {
        await salvarMutation.mutateAsync({ ...payload, id: editingId });
        toast({ title: "Variável atualizada!" });
      }
      cancelEdit();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta variável?")) return;
    try {
      await deletarMutation.mutateAsync(id);
      toast({ title: "Variável excluída" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const handleCopyVar = useCallback((nome: string) => {
    navigator.clipboard.writeText(`[${nome}]`);
    setCopiedVar(nome);
    setTimeout(() => setCopiedVar(null), 1500);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Variable className="h-5 w-5 text-primary" /> Variáveis Customizadas
          </h2>
          <p className="text-sm text-muted-foreground">
            Crie expressões calculadas para usar em templates de proposta
          </p>
        </div>
        <Button onClick={startNew} className="gap-1.5" disabled={editingId !== null}>
          <Plus className="h-4 w-4" /> Nova Variável
        </Button>
      </div>

      {/* Available Variables Reference */}
      <Card className="border-border/40">
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Variáveis disponíveis para expressões</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <TooltipProvider delayDuration={200}>
              {VARIAVEIS_DISPONIVEIS.map(v => (
                <Tooltip key={v.nome}>
                  <TooltipTrigger asChild>
                    <Badge
                      variant="outline"
                      className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                      onClick={() => handleCopyVar(v.nome)}
                    >
                      {copiedVar === v.nome ? (
                        <><Check className="h-2.5 w-2.5 mr-0.5 text-success" /> Copiado!</>
                      ) : (
                        <>[{v.nome}]</>
                      )}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    <p>{v.desc}</p>
                    <p className="text-muted-foreground">Clique para copiar</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </TooltipProvider>
          </div>

          {/* Supported Functions */}
          <Collapsible open={showFunctions} onOpenChange={setShowFunctions}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7 px-2">
                <Info className="h-3 w-3" />
                {showFunctions ? "Ocultar funções" : "Ver funções disponíveis"}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUPPORTED_FUNCTIONS.map(fn => (
                  <div key={fn.name} className="rounded-md border border-border/40 p-2 text-xs">
                    <p className="font-semibold text-primary">{fn.name}</p>
                    <p className="text-muted-foreground font-mono text-[10px] mt-0.5">{fn.syntax}</p>
                    <p className="text-muted-foreground text-[10px] mt-0.5">
                      Ex: <code className="bg-muted px-1 rounded">{fn.example}</code>
                    </p>
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                💡 Use <code className="bg-muted px-1 rounded">;</code> ou <code className="bg-muted px-1 rounded">,</code> para separar argumentos.
                Operador <code className="bg-muted px-1 rounded">^</code> suportado para potenciação.
              </p>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>

      {/* Edit Form */}
      {editingId && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nome (vc_*)</Label>
                <Input value={form.nome || ""} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))}
                  placeholder="vc_roi_percentual" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Label (exibição)</Label>
                <Input value={form.label || ""} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                  placeholder="ROI (%)" className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Expressão</Label>
              <Textarea value={form.expressao || ""} onChange={e => setForm(f => ({ ...f, expressao: e.target.value }))}
                placeholder='Ex: IF([economia_anual] > 5000; [economia_anual] / [valor_total] * 100; 0)' className="min-h-[60px] text-xs font-mono" />
              <div className="flex flex-col gap-1 mt-1">
                {form.expressao && (
                  <p className="text-[10px] text-muted-foreground">
                    Variáveis usadas: {extractVariables(form.expressao || "").map(v => `[${v}]`).join(", ") || "nenhuma"}
                  </p>
                )}
                {livePreview && (
                  <p className={`text-[10px] font-mono ${livePreview.startsWith("📊") ? "text-primary" : "text-warning"}`}>
                    {livePreview}
                  </p>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Tipo resultado</Label>
                <Select value={form.tipo_resultado || "number"} onValueChange={v => setForm(f => ({ ...f, tipo_resultado: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Categoria</Label>
                <Select value={form.categoria || "geral"} onValueChange={v => setForm(f => ({ ...f, categoria: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Ordem</Label>
                <Input type="number" value={form.ordem ?? 0} onChange={e => setForm(f => ({ ...f, ordem: Number(e.target.value) }))}
                  className="h-8 text-xs" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Descrição (opcional)</Label>
              <Input value={form.descricao || ""} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))}
                placeholder="Descrição da variável" className="h-8 text-xs" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.ativo ?? true} onCheckedChange={v => setForm(f => ({ ...f, ativo: v }))} />
              <Label className="text-xs">Ativa</Label>
            </div>

            {/* Test */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTest} className="gap-1 text-xs">
                <TestTube className="h-3 w-3" /> Testar
              </Button>
              {testResult && (
                <p className={`text-xs ${testResult.startsWith("✅") ? "text-success" : testResult.startsWith("❌") ? "text-destructive" : "text-warning"}`}>
                  {testResult}
                </p>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={cancelEdit}><X className="h-3 w-3 mr-1" /> Cancelar</Button>
              <Button size="sm" onClick={handleSave} disabled={!isEditDirty}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : variaveis.length === 0 && !editingId ? (
        <div className="text-center py-12 text-muted-foreground">
          <Variable className="h-10 w-10 mx-auto opacity-20 mb-3" />
          <p className="text-sm">Nenhuma variável customizada criada.</p>
          <Button variant="default" onClick={startNew} className="mt-2">Criar primeira variável</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {variaveis.map(v => (
            <Card key={v.id} className={`border-border/40 ${!v.ativo ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold">{v.label}</p>
                        <Badge variant="outline" className="text-[9px] font-mono">{v.nome}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{v.categoria}</Badge>
                        {!v.ativo && <Badge variant="destructive" className="text-[9px]">Inativa</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{v.expressao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(v)} disabled={editingId !== null} aria-label="Editar">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => handleDelete(v.id)} disabled={editingId !== null} aria-label="Excluir">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
