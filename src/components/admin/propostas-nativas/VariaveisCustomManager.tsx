import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Save, X, Variable, TestTube, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { validateExpression, evaluate, extractVariables } from "@/lib/expressionEngine";

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
];

export function VariaveisCustomManager() {
  const [variaveis, setVariaveis] = useState<VariavelCustom[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<VariavelCustom>>({});
  const [testResult, setTestResult] = useState<string | null>(null);

  const loadVariaveis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("proposta_variaveis_custom")
      .select("id, nome, label, expressao, tipo_resultado, categoria, ordem, ativo, descricao")
      .order("ordem", { ascending: true });
    setVariaveis((data as VariavelCustom[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadVariaveis(); }, []);

  const startNew = () => {
    setEditingId("new");
    setForm({
      nome: "vc_", label: "", expressao: "", tipo_resultado: "number",
      categoria: "geral", ordem: variaveis.length, ativo: true, descricao: "",
    });
    setTestResult(null);
  };

  const startEdit = (v: VariavelCustom) => {
    setEditingId(v.id);
    setForm({ ...v });
    setTestResult(null);
  };

  const cancelEdit = () => { setEditingId(null); setForm({}); setTestResult(null); };

  const handleTest = () => {
    if (!form.expressao) return;
    const validation = validateExpression(form.expressao);
    if (!validation.valid) {
      setTestResult(`❌ ${validation.error}`);
      return;
    }
    // Test with sample values
    const ctx: Record<string, number> = {};
    VARIAVEIS_DISPONIVEIS.forEach(v => { ctx[v.nome] = 1000; });
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

    try {
      if (editingId === "new") {
        const { error } = await supabase.from("proposta_variaveis_custom").insert({
          nome: form.nome, label: form.label, expressao: form.expressao,
          tipo_resultado: form.tipo_resultado || "number",
          categoria: form.categoria || "geral",
          ordem: form.ordem || 0, ativo: form.ativo ?? true,
          descricao: form.descricao || null,
        } as any);
        if (error) throw error;
        toast({ title: "Variável criada!" });
      } else {
        const { error } = await supabase.from("proposta_variaveis_custom")
          .update({
            nome: form.nome, label: form.label, expressao: form.expressao,
            tipo_resultado: form.tipo_resultado, categoria: form.categoria,
            ordem: form.ordem, ativo: form.ativo, descricao: form.descricao,
          } as any)
          .eq("id", editingId!);
        if (error) throw error;
        toast({ title: "Variável atualizada!" });
      }
      cancelEdit();
      loadVariaveis();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta variável?")) return;
    await supabase.from("proposta_variaveis_custom").delete().eq("id", id);
    toast({ title: "Variável excluída" });
    loadVariaveis();
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {VARIAVEIS_DISPONIVEIS.map(v => (
              <Badge key={v.nome} variant="outline" className="text-[10px] cursor-help" title={v.desc}>
                [{v.nome}]
              </Badge>
            ))}
          </div>
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
                placeholder="[economia_anual] / [valor_total] * 100" className="min-h-[60px] text-xs font-mono" />
              {form.expressao && (
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] text-muted-foreground">
                    Variáveis usadas: {extractVariables(form.expressao || "").map(v => `[${v}]`).join(", ") || "nenhuma"}
                  </p>
                </div>
              )}
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
              <Button size="sm" onClick={handleSave}><Save className="h-3 w-3 mr-1" /> Salvar</Button>
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
          <Button variant="link" onClick={startNew} className="mt-2">Criar primeira variável</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {variaveis.map(v => (
            <Card key={v.id} className={`border-border/40 ${!v.ativo ? "opacity-50" : ""}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{v.label}</p>
                        <Badge variant="outline" className="text-[9px] font-mono">{v.nome}</Badge>
                        <Badge variant="secondary" className="text-[9px]">{v.categoria}</Badge>
                        {!v.ativo && <Badge variant="destructive" className="text-[9px]">Inativa</Badge>}
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">{v.expressao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => startEdit(v)} disabled={editingId !== null}>
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60" onClick={() => handleDelete(v.id)} disabled={editingId !== null}>
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
