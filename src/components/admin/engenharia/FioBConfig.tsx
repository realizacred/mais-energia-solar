import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Scale, Save, Plus, Trash2, Info } from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useFioBEscalonamento, useUpdateFioB, useAddFioB, useDeleteFioB } from "@/hooks/useFioBEscalonamento";

export function FioBConfig() {
  const [newAno, setNewAno] = useState<number>(new Date().getFullYear() + 1);
  const [newPercentual, setNewPercentual] = useState<number>(0);
  const { toast } = useToast();

  const { data: items = [], isLoading: loading } = useFioBEscalonamento();
  const updateMut = useUpdateFioB();
  const addMut = useAddFioB();
  const deleteMut = useDeleteFioB();

  const saving = updateMut.isPending || addMut.isPending;

  const handleUpdate = (id: string, value: number) => {
    updateMut.mutate({ id, percentual_nao_compensado: value }, {
      onSuccess: () => toast({ title: "Fio B atualizado" }),
      onError: (err: any) => toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" }),
    });
  };

  const handleAdd = () => {
    if (items.some((i) => i.ano === newAno)) {
      toast({ title: "Ano já existe", variant: "destructive" });
      return;
    }
    addMut.mutate({ ano: newAno, percentual_nao_compensado: newPercentual }, {
      onSuccess: () => toast({ title: "Ano adicionado" }),
      onError: (err: any) => toast({ title: "Erro ao adicionar", description: err.message, variant: "destructive" }),
    });
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => toast({ title: "Ano removido" }),
      onError: (err: any) => toast({ title: "Erro ao remover", description: err.message, variant: "destructive" }),
    });
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
          <Scale className="h-4 w-4 text-primary" />
          <CardTitle className="text-base">Fio B — Escalonamento Anual</CardTitle>
        </div>
        <CardDescription>
          Percentual de energia não compensável por ano (Lei 14.300).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Info */}
        {currentItem && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-info/5 border border-info/20">
            <Info className="h-4 w-4 text-info mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Atualmente em <strong>{currentItem.ano}</strong> com{" "}
              <Badge variant="secondary" className="text-[10px]">
                {currentItem.percentual_nao_compensado}%
              </Badge>{" "}
              de energia não compensada.
            </p>
          </div>
        )}

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Ano</TableHead>
                <TableHead className="font-semibold text-foreground">% Não Compensado</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-mono">{item.ano}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      defaultValue={item.percentual_nao_compensado}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!isNaN(v) && v !== item.percentual_nao_compensado) handleUpdate(item.id, v);
                      }}
                      className="w-24 h-8 text-sm"
                    />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(item.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Add new */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ano</Label>
            <Input type="number" value={newAno} onChange={(e) => setNewAno(parseInt(e.target.value) || 0)} className="w-24 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">% Não Compensado</Label>
            <Input type="number" step="0.1" value={newPercentual} onChange={(e) => setNewPercentual(parseFloat(e.target.value) || 0)} className="w-28 h-8 text-sm" />
          </div>
          <Button size="sm" onClick={handleAdd} disabled={saving} className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar Ano
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
