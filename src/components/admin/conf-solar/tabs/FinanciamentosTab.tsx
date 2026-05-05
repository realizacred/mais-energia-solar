import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, Save, Loader2, Building2, Landmark } from "lucide-react";
import { useFinanciamentoBancos, useSaveFinanciamentoBancos, type BancoRow } from "@/hooks/useFinanciamentoBancos";
import { LoadingState, EmptyState } from "@/components/ui-kit";

export function FinanciamentosTab() {
  const { data: loadedBancos, isLoading: loading } = useFinanciamentoBancos();
  const saveMut = useSaveFinanciamentoBancos();
  const [bancos, setBancos] = useState<BancoRow[]>([]);
  const [initial, setInitial] = useState<string>("[]");

  useEffect(() => {
    if (loadedBancos) {
      setBancos(loadedBancos);
      setInitial(JSON.stringify(loadedBancos));
    }
  }, [loadedBancos]);

  const isDirty = JSON.stringify(bancos) !== initial;

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

  function handleSave() {
    saveMut.mutate(bancos, {
      onSuccess: () => {
        setInitial(JSON.stringify(bancos));
        toast({ title: "Financiamentos salvos" });
      },
      onError: (e: any) => toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" }),
    });
  }

  if (loading) return <LoadingState context="config" />;

  return (
    <div className="space-y-5">
      {/* Header interno */}
      <div className="flex items-start gap-3 justify-between">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Landmark className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Financiadores e produtos</h2>
            <p className="text-sm text-muted-foreground">
              Bancos parceiros disponíveis nas simulações de financiamento.
            </p>
          </div>
        </div>
        <Button variant="default" size="sm" onClick={addBanco} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Adicionar financiador
        </Button>
      </div>

      {bancos.length === 0 ? (
        <Card className="border-border/60 border-l-4 border-l-primary">
          <CardContent className="py-10">
            <EmptyState
              icon={Building2}
              title="Nenhum financiador cadastrado"
              description='Clique em "Adicionar financiador" para começar a configurar os bancos disponíveis.'
              action={
                <Button onClick={addBanco} className="gap-2">
                  <Plus className="h-4 w-4" /> Adicionar financiador
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {bancos.map((b, i) => (
            <Card key={b.id} className="border-border/60 border-l-4 border-l-primary">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-primary mt-0.5" />
                  <div>
                    <CardTitle className="text-sm font-semibold">
                      {b.nome || `Financiador ${i + 1}`}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {b.ativo ? "Ativo nas simulações" : "Desativado"}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={b.ativo} onCheckedChange={(v) => updateBanco(i, "ativo", v)} />
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => removeBanco(i)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</Label>
                    <Input value={b.nome} onChange={(e) => updateBanco(i, "nome", e.target.value)} placeholder="Ex: BV Financeira" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Taxa mensal</Label>
                    <div className="relative">
                      <Input type="number" step="0.01" value={b.taxa_mensal} onChange={(e) => updateBanco(i, "taxa_mensal", parseFloat(e.target.value) || 0)} className="text-sm pr-10" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
                    </div>
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Máximo de parcelas</Label>
                    <Input type="number" step="1" value={b.max_parcelas} onChange={(e) => updateBanco(i, "max_parcelas", parseInt(e.target.value) || 0)} className="text-sm" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex items-center justify-end gap-3 pt-2">
        {isDirty && !saveMut.isPending && (
          <Badge variant="outline" className="text-[10px] border-amber-500/40 text-amber-600 dark:text-amber-400">
            Alterações não salvas
          </Badge>
        )}
        <Button onClick={handleSave} disabled={saveMut.isPending || !isDirty} className="gap-2 min-w-[170px]">
          {saveMut.isPending ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
          ) : (
            <><Save className="h-4 w-4" /> Salvar financiamentos</>
          )}
        </Button>
      </div>
    </div>
  );
}
