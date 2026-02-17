import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, Variable, Copy } from "lucide-react";

interface VarRow {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  ordem: number;
  ativo: boolean;
  descricao: string | null;
  isNew?: boolean;
}

export function VariaveisTab() {
  const [vars, setVars] = useState<VarRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("proposta_variaveis_custom")
      .select("id, nome, label, expressao, tipo_resultado, categoria, ordem, ativo, descricao")
      .order("ordem", { ascending: true });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setVars((data as unknown as VarRow[]) || []);
    setLoading(false);
  }

  function addVar() {
    setVars([...vars, {
      id: crypto.randomUUID(),
      nome: "vc_",
      label: "",
      expressao: "",
      tipo_resultado: "number",
      categoria: "geral",
      ordem: vars.length,
      ativo: true,
      descricao: null,
      isNew: true,
    }]);
  }

  function removeVar(idx: number) { setVars(vars.filter((_, i) => i !== idx)); }

  function updateVar(idx: number, key: keyof VarRow, value: string | boolean | number) {
    const updated = [...vars];
    updated[idx] = { ...updated[idx], [key]: value };
    // Auto-generate nome from label for new vars
    if (key === "label" && updated[idx].isNew && typeof value === "string") {
      const generated = "vc_" + value
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      updated[idx].nome = generated;
    }
    setVars(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const v of vars) {
        if (!v.nome || !v.label) continue;
        const { isNew, id, ...rest } = v;
        const payload = {
          nome: rest.nome,
          label: rest.label,
          expressao: rest.expressao,
          tipo_resultado: rest.tipo_resultado,
          categoria: rest.categoria,
          ordem: rest.ordem,
          ativo: rest.ativo,
          descricao: rest.descricao,
        };
        if (isNew) {
          const { error } = await supabase.from("proposta_variaveis_custom").insert(payload as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("proposta_variaveis_custom").update(payload as any).eq("id", id);
          if (error) throw error;
        }
      }
      toast({ title: "Variáveis salvas" });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  function copyKey(nome: string) {
    navigator.clipboard.writeText(`{{customizada.${nome}}}`);
    toast({ title: `{{customizada.${nome}}} copiado!` });
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Variable className="h-4 w-4 text-primary" />
          Variáveis Customizáveis
        </CardTitle>
        <Button variant="outline" size="sm" onClick={addVar} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nova Variável
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-4">
          Defina variáveis personalizadas para usar nos templates de proposta. Use <code className="text-primary">{"{{customizada.nome}}"}</code> no template.
        </p>
        {vars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma variável customizada. Adicione para personalizar seus templates.
          </p>
        ) : (
          <div className="space-y-2">
            {vars.map((v, i) => (
              <div key={v.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_auto_auto] gap-2 items-end p-3 rounded-lg border border-border/40 bg-card">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Label</Label>
                  <Input value={v.label} onChange={(e) => updateVar(i, "label", e.target.value)} placeholder="Nome exibido" className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Nome (vc_*)</Label>
                  <div className="flex items-center gap-1">
                    <Input value={v.nome} onChange={(e) => updateVar(i, "nome", e.target.value)} placeholder="vc_minha_var" className="text-sm h-8 font-mono text-xs" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyKey(v.nome)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Expressão</Label>
                  <Input value={v.expressao} onChange={(e) => updateVar(i, "expressao", e.target.value)} placeholder="[economia_anual] / [valor_total] * 100" className="text-sm h-8 font-mono text-xs" />
                </div>
                <Badge variant={v.ativo ? "outline" : "destructive"} className="h-8 text-[10px] shrink-0">
                  {v.ativo ? v.categoria : "Inativo"}
                </Badge>
                <Badge variant="outline" className="h-8 text-[10px] shrink-0">{v.tipo_resultado}</Badge>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/60 shrink-0" onClick={() => removeVar(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Variáveis
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
