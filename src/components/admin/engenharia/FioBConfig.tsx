import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale, Save, Plus, Trash2, Info } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface FioBItem {
  id: string;
  ano: number;
  percentual_nao_compensado: number;
}

export function FioBConfig() {
  const [items, setItems] = useState<FioBItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAno, setNewAno] = useState<number>(new Date().getFullYear() + 1);
  const [newPercentual, setNewPercentual] = useState<number>(0);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data, error } = await supabase
        .from("fio_b_escalonamento")
        .select("*")
        .order("ano", { ascending: true });
      if (error) throw error;
      setItems(
        (data || []).map((d) => ({
          id: d.id,
          ano: d.ano,
          percentual_nao_compensado: Number(d.percentual_nao_compensado),
        }))
      );
    } catch (error: any) {
      toast({ title: "Erro ao carregar Fio B", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (id: string, value: number) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("fio_b_escalonamento")
        .update({ percentual_nao_compensado: value })
        .eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, percentual_nao_compensado: value } : i)));
      toast({ title: "Fio B atualizado" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAdd = async () => {
    if (items.some((i) => i.ano === newAno)) {
      toast({ title: "Ano já existe", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("fio_b_escalonamento")
        .insert({ ano: newAno, percentual_nao_compensado: newPercentual });
      if (error) throw error;
      toast({ title: "Ano adicionado" });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("fio_b_escalonamento").delete().eq("id", id);
      if (error) throw error;
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast({ title: "Ano removido" });
    } catch (error: any) {
      toast({ title: "Erro ao remover", description: error.message, variant: "destructive" });
    }
  };

  const currentYear = new Date().getFullYear();
  const currentItem = items.find((i) => i.ano <= currentYear);

  if (loading) {
    return (
      <Card>
        <CardContent><InlineLoader context="data_load" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scale className="w-5 h-5 text-warning" />
          <CardTitle>Escalonamento do Fio B — Lei 14.300</CardTitle>
        </div>
        <CardDescription>
          Percentual da TUSD Fio B cobrado dos prosumidores GD II por ano.
          {currentItem && (
            <Badge variant="outline" className="ml-2">
              {currentYear}: {currentItem.percentual_nao_compensado}%
            </Badge>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info box */}
        <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-2">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Conforme a Lei 14.300/2022, o custo do Fio B (TUSD) é aplicado progressivamente
            aos prosumidores GD II. O sistema utiliza automaticamente o percentual do ano
            vigente nos cálculos de payback.
          </p>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ano</TableHead>
              <TableHead>% Não Compensado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.ano}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      className="w-20 h-8"
                      value={item.percentual_nao_compensado}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        setItems((prev) =>
                          prev.map((i) =>
                            i.id === item.id ? { ...i, percentual_nao_compensado: val } : i
                          )
                        );
                      }}
                      onBlur={(e) => handleUpdate(item.id, parseFloat(e.target.value) || 0)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </TableCell>
                <TableCell>
                  {item.ano === currentYear ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20">Vigente</Badge>
                  ) : item.ano < currentYear ? (
                    <Badge variant="outline" className="text-muted-foreground">Passado</Badge>
                  ) : (
                    <Badge variant="outline" className="text-info">Futuro</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* Add new year */}
        <div className="flex items-end gap-3 pt-2 border-t">
          <div className="space-y-1">
            <Label className="text-xs">Ano</Label>
            <Input
              type="number"
              className="w-24 h-9"
              value={newAno}
              onChange={(e) => setNewAno(parseInt(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">% Não Compensado</Label>
            <Input
              type="number"
              min={0}
              max={100}
              className="w-24 h-9"
              value={newPercentual}
              onChange={(e) => setNewPercentual(parseFloat(e.target.value) || 0)}
            />
          </div>
          <Button onClick={handleAdd} disabled={saving} size="sm" className="gap-1.5">
            <Plus className="w-4 h-4" />
            Adicionar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
