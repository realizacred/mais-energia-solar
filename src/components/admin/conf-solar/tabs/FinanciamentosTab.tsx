import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, Building2 } from "lucide-react";

interface BancoRow {
  id: string;
  nome: string;
  taxa_mensal: number;
  max_parcelas: number;
  ativo: boolean;
  ordem: number;
  isNew?: boolean;
}

export function FinanciamentosTab() {
  const [bancos, setBancos] = useState<BancoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data, error } = await supabase
      .from("financiamento_bancos")
      .select("id, nome, taxa_mensal, max_parcelas, ativo, ordem")
      .order("ordem", { ascending: true });
    if (error) toast({ title: "Erro ao carregar bancos", description: error.message, variant: "destructive" });
    setBancos((data as unknown as BancoRow[]) || []);
    setLoading(false);
  }

  function addBanco() {
    setBancos([...bancos, {
      id: crypto.randomUUID(), nome: "", taxa_mensal: 1.5, max_parcelas: 60,
      ativo: true, ordem: bancos.length, isNew: true,
    }]);
  }

  function removeBanco(idx: number) { setBancos(bancos.filter((_, i) => i !== idx)); }

  function updateBanco(idx: number, key: keyof BancoRow, value: string | number | boolean) {
    const updated = [...bancos];
    updated[idx] = { ...updated[idx], [key]: value };
    setBancos(updated);
  }

  async function handleSave() {
    setSaving(true);
    try {
      for (const banco of bancos) {
        const { isNew, id, ...payload } = banco;
        if (isNew) {
          const { error } = await supabase.from("financiamento_bancos").insert(payload as any);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("financiamento_bancos").update(payload as any).eq("id", id);
          if (error) throw error;
        }
      }
      toast({ title: "Financiamentos salvos" });
      await loadData();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  }

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-4 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Financiadores & Produtos
        </CardTitle>
        <Button variant="outline" size="sm" onClick={addBanco} className="gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        {bancos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum financiador cadastrado. Clique em "Adicionar" para começar.
          </p>
        ) : (
          <div className="space-y-4">
            {bancos.map((b, i) => (
              <div key={b.id} className="border border-border/60 rounded-xl p-4 space-y-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {b.nome || `Banco ${i + 1}`}
                  </span>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-[10px] text-muted-foreground">Ativo</Label>
                      <Switch checked={b.ativo} onCheckedChange={(v) => updateBanco(i, "ativo", v)} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeBanco(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Nome</Label>
                    <Input value={b.nome} onChange={(e) => updateBanco(i, "nome", e.target.value)} placeholder="Ex: BV Financeira" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Taxa mensal (%)</Label>
                    <Input type="number" step="0.01" value={b.taxa_mensal} onChange={(e) => updateBanco(i, "taxa_mensal", parseFloat(e.target.value) || 0)} className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] text-muted-foreground">Máx. parcelas</Label>
                    <Input type="number" step="1" value={b.max_parcelas} onChange={(e) => updateBanco(i, "max_parcelas", parseInt(e.target.value) || 0)} className="text-sm" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Financiamentos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
