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
  chave: string;
  label: string;
  valor_padrao: string;
  categoria: string;
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
      .select("id, chave, label, valor_padrao, categoria")
      .order("categoria", { ascending: true });
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    setVars((data as unknown as VarRow[]) || []);
    setLoading(false);
  }

  function addVar() {
    setVars([...vars, {
      id: crypto.randomUUID(), chave: "", label: "", valor_padrao: "", categoria: "geral", isNew: true,
    }]);
  }

  function removeVar(idx: number) { setVars(vars.filter((_, i) => i !== idx)); }

  function updateVar(idx: number, key: keyof VarRow, value: string) {
    const updated = [...vars];
    updated[idx] = { ...updated[idx], [key]: value };
    // Auto-generate chave from label
    if (key === "label" && (updated[idx].isNew || !updated[idx].chave)) {
      updated[idx].chave = value
        .toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
    }
    setVars(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const v of vars) {
        if (!v.chave || !v.label) continue;
        const { isNew, id, ...payload } = v;
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

  function copyKey(chave: string) {
    navigator.clipboard.writeText(`[${chave}]`);
    toast({ title: `[${chave}] copiado!` });
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
          Defina variáveis personalizadas para usar nos templates de proposta. Use <code className="text-primary">[chave]</code> no template.
        </p>
        {vars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma variável customizada. Adicione para personalizar seus templates.
          </p>
        ) : (
          <div className="space-y-2">
            {vars.map((v, i) => (
              <div key={v.id} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_auto_auto] gap-2 items-end p-3 rounded-lg border border-border/40 bg-card">
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Label</Label>
                  <Input value={v.label} onChange={(e) => updateVar(i, "label", e.target.value)} placeholder="Nome exibido" className="text-sm h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Chave</Label>
                  <div className="flex items-center gap-1">
                    <Input value={v.chave} onChange={(e) => updateVar(i, "chave", e.target.value)} placeholder="chave_template" className="text-sm h-8 font-mono text-xs" />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => copyKey(v.chave)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] text-muted-foreground">Valor padrão</Label>
                  <Input value={v.valor_padrao} onChange={(e) => updateVar(i, "valor_padrao", e.target.value)} placeholder="Opcional" className="text-sm h-8" />
                </div>
                <Badge variant="outline" className="h-8 text-[10px] shrink-0">{v.categoria}</Badge>
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
