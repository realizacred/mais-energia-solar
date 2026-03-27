import { useState } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/dateUtils";
import { useFeriados, useAddFeriado, useSeedFeriadosNacionais, useRemoveFeriado } from "@/hooks/useFeriados";

const FERIADOS_NACIONAIS_BR = [
  { data: "01-01", nome: "Confraternização Universal" },
  { data: "04-21", nome: "Tiradentes" },
  { data: "05-01", nome: "Dia do Trabalho" },
  { data: "09-07", nome: "Independência do Brasil" },
  { data: "10-12", nome: "Nossa Sra. Aparecida" },
  { data: "11-02", nome: "Finados" },
  { data: "11-15", nome: "Proclamação da República" },
  { data: "12-25", nome: "Natal" },
];

export function HolidaysConfig({ tenantId }: { tenantId: string }) {
  const [newData, setNewData] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("local");

  const { data: feriados = [], isLoading: loading } = useFeriados(tenantId);
  const addMut = useAddFeriado();
  const seedMut = useSeedFeriadosNacionais();
  const removeMut = useRemoveFeriado();

  const adding = addMut.isPending || seedMut.isPending;

  const seedNacionais = () => {
    const year = new Date().getFullYear();
    const rows = FERIADOS_NACIONAIS_BR.map(f => ({
      tenant_id: tenantId, data: `${year}-${f.data}`, nome: f.nome, tipo: "nacional" as const, ativo: true,
    }));
    const nextYear = year + 1;
    rows.push(...FERIADOS_NACIONAIS_BR.map(f => ({
      tenant_id: tenantId, data: `${nextYear}-${f.data}`, nome: f.nome, tipo: "nacional" as const, ativo: true,
    })));
    seedMut.mutate(rows, {
      onSuccess: () => toast({ title: "Feriados nacionais adicionados!" }),
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const addFeriado = () => {
    if (!newData || !newNome) {
      toast({ title: "Preencha data e nome", variant: "destructive" });
      return;
    }
    addMut.mutate({ tenant_id: tenantId, data: newData, nome: newNome, tipo: newTipo }, {
      onSuccess: () => { setNewData(""); setNewNome(""); toast({ title: "Feriado adicionado!" }); },
      onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
    });
  };

  const removeFeriado = (id: string) => {
    removeMut.mutate(id, {
      onSuccess: () => toast({ title: "Feriado removido" }),
    });
  };

  const tipoColor = (tipo: string) => {
    switch (tipo) {
      case "nacional": return "bg-primary/10 text-primary";
      case "estadual": return "bg-warning/10 text-warning";
      default: return "bg-muted text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-6 space-y-3">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-56" />
          <div className="flex items-end gap-2">
            <Skeleton className="h-8 w-40" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-8 w-28" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const hasNacionais = feriados.some(f => f.tipo === "nacional");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarOff className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Feriados</CardTitle>
          </div>
          {!hasNacionais && (
            <Button size="sm" variant="outline" onClick={seedNacionais} disabled={adding} className="gap-1.5 text-xs">
              <Plus className="h-3.5 w-3.5" />
              Feriados Nacionais BR
            </Button>
          )}
        </div>
        <CardDescription>
          Dias em que o atendimento estará fechado
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add manual */}
        <div className="flex items-end gap-2 flex-wrap">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Data</label>
            <DateInput value={newData} onChange={setNewData} className="w-40 h-8 text-sm" />
          </div>
          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Ex: Aniversário da cidade" className="h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo</label>
            <Select value={newTipo} onValueChange={setNewTipo}>
              <SelectTrigger className="w-28 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="estadual">Estadual</SelectItem>
                <SelectItem value="nacional">Nacional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button size="sm" onClick={addFeriado} disabled={adding} className="h-8 gap-1">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        {/* List */}
        {feriados.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum feriado cadastrado. Clique em "Feriados Nacionais BR" para importar automaticamente.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {feriados.map(f => (
              <div key={f.id} className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-background hover:bg-muted/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono text-muted-foreground w-24">
                    {formatDate(f.data + "T12:00:00")}
                  </span>
                  <span className="text-sm">{f.nome}</span>
                  <Badge variant="secondary" className={`text-[10px] ${tipoColor(f.tipo)}`}>
                    {f.tipo}
                  </Badge>
                </div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => f.id && removeFeriado(f.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
