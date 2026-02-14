import { useState, useEffect } from "react";
import { CalendarOff, Plus, Trash2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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

type Feriado = {
  id?: string;
  data: string;
  nome: string;
  tipo: string;
  ativo: boolean;
};

export function HolidaysConfig({ tenantId }: { tenantId: string }) {
  const [feriados, setFeriados] = useState<Feriado[]>([]);
  const [loading, setLoading] = useState(true);
  const [newData, setNewData] = useState("");
  const [newNome, setNewNome] = useState("");
  const [newTipo, setNewTipo] = useState("local");
  const [adding, setAdding] = useState(false);

  useEffect(() => { loadFeriados(); }, [tenantId]);

  const loadFeriados = async () => {
    const { data, error } = await supabase
      .from("tenant_feriados")
      .select("id, data, nome, tipo, ativo")
      .eq("tenant_id", tenantId)
      .order("data");

    if (!error && data) setFeriados(data);
    setLoading(false);
  };

  const seedNacionais = async () => {
    setAdding(true);
    const year = new Date().getFullYear();
    const rows = FERIADOS_NACIONAIS_BR.map(f => ({
      tenant_id: tenantId,
      data: `${year}-${f.data}`,
      nome: f.nome,
      tipo: "nacional" as const,
      ativo: true,
    }));

    // Also add next year
    const nextYear = year + 1;
    rows.push(...FERIADOS_NACIONAIS_BR.map(f => ({
      tenant_id: tenantId,
      data: `${nextYear}-${f.data}`,
      nome: f.nome,
      tipo: "nacional" as const,
      ativo: true,
    })));

    const { error } = await supabase
      .from("tenant_feriados")
      .upsert(rows, { onConflict: "tenant_id,data" });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Feriados nacionais adicionados!" });
      loadFeriados();
    }
    setAdding(false);
  };

  const addFeriado = async () => {
    if (!newData || !newNome) {
      toast({ title: "Preencha data e nome", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("tenant_feriados").insert({
      tenant_id: tenantId,
      data: newData,
      nome: newNome,
      tipo: newTipo,
    });

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      setNewData("");
      setNewNome("");
      toast({ title: "Feriado adicionado!" });
      loadFeriados();
    }
    setAdding(false);
  };

  const removeFeriado = async (id: string) => {
    const { error } = await supabase.from("tenant_feriados").delete().eq("id", id);
    if (!error) {
      setFeriados(feriados.filter(f => f.id !== id));
      toast({ title: "Feriado removido" });
    }
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
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
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
            <Input type="date" value={newData} onChange={e => setNewData(e.target.value)} className="w-40 h-8 text-sm" />
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
                    {new Date(f.data + "T12:00:00").toLocaleDateString("pt-BR")}
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
