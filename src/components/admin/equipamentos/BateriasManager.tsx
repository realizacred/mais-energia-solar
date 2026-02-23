import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Battery } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Bateria {
  id: string;
  fabricante: string;
  modelo: string;
  tipo_bateria: string | null;
  energia_kwh: number | null;
  dimensoes_mm: string | null;
  tensao_operacao_v: string | null;
  tensao_carga_v: number | null;
  tensao_nominal_v: number | null;
  potencia_max_saida_kw: number | null;
  corrente_max_descarga_a: number | null;
  corrente_max_carga_a: number | null;
  correntes_recomendadas_a: string | null;
  ativo: boolean;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", tipo_bateria: "", energia_kwh: "", dimensoes_mm: "",
  tensao_operacao_v: "", tensao_carga_v: "", tensao_nominal_v: "",
  potencia_max_saida_kw: "", corrente_max_descarga_a: "", corrente_max_carga_a: "",
  correntes_recomendadas_a: "",
};

export function BateriasManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Bateria | null>(null);
  const [deleting, setDeleting] = useState<Bateria | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: baterias = [], isLoading } = useQuery({
    queryKey: ["baterias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("baterias")
        .select("id, tenant_id, fabricante, modelo, tipo_bateria, energia_kwh, tensao_nominal_v, tensao_carga_v, tensao_operacao_v, corrente_max_carga_a, corrente_max_descarga_a, correntes_recomendadas_a, potencia_max_saida_kw, dimensoes_mm, ativo, created_at, updated_at")
        .order("fabricante")
        .order("modelo");
      if (error) throw error;
      return data as Bateria[];
    },
  });

  const filtered = baterias.filter((b) => {
    const matchSearch = !search ||
      `${b.fabricante} ${b.modelo} ${b.tipo_bateria || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? b.ativo : !b.ativo);
    return matchSearch && matchAtivo;
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("baterias").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("baterias").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baterias"] });
      toast({ title: editing ? "Bateria atualizada" : "Bateria cadastrada" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("baterias").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["baterias"] });
      toast({ title: "Bateria excluída" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("baterias").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["baterias"] }),
  });

  const openDialog = (b?: Bateria) => {
    if (b) {
      setEditing(b);
      setForm({
        fabricante: b.fabricante, modelo: b.modelo,
        tipo_bateria: b.tipo_bateria || "", energia_kwh: b.energia_kwh ? String(b.energia_kwh) : "",
        dimensoes_mm: b.dimensoes_mm || "", tensao_operacao_v: b.tensao_operacao_v || "",
        tensao_carga_v: b.tensao_carga_v != null ? String(b.tensao_carga_v) : "",
        tensao_nominal_v: b.tensao_nominal_v ? String(b.tensao_nominal_v) : "",
        potencia_max_saida_kw: b.potencia_max_saida_kw != null ? String(b.potencia_max_saida_kw) : "",
        corrente_max_descarga_a: b.corrente_max_descarga_a ? String(b.corrente_max_descarga_a) : "",
        corrente_max_carga_a: b.corrente_max_carga_a ? String(b.corrente_max_carga_a) : "",
        correntes_recomendadas_a: b.correntes_recomendadas_a || "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim()) {
      toast({ title: "Preencha fabricante e modelo", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      tipo_bateria: form.tipo_bateria || null,
      energia_kwh: form.energia_kwh ? parseFloat(form.energia_kwh) : null,
      dimensoes_mm: form.dimensoes_mm || null,
      tensao_operacao_v: form.tensao_operacao_v || null,
      tensao_carga_v: form.tensao_carga_v !== "" ? parseFloat(form.tensao_carga_v) : null,
      tensao_nominal_v: form.tensao_nominal_v ? parseFloat(form.tensao_nominal_v) : null,
      potencia_max_saida_kw: form.potencia_max_saida_kw !== "" ? parseFloat(form.potencia_max_saida_kw) : null,
      corrente_max_descarga_a: form.corrente_max_descarga_a ? parseFloat(form.corrente_max_descarga_a) : null,
      corrente_max_carga_a: form.corrente_max_carga_a ? parseFloat(form.corrente_max_carga_a) : null,
      correntes_recomendadas_a: form.correntes_recomendadas_a || null,
    });
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Battery className="w-5 h-5" /> Baterias
          </CardTitle>
          <CardDescription className="mt-1">
            Cadastro de baterias para sistemas híbridos e off-grid.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Bateria
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar fabricante, modelo..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="inativo">Inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Energia</TableHead>
                <TableHead>Tensão Nom.</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhuma bateria encontrada.
                </TableCell></TableRow>
              ) : filtered.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.fabricante}</TableCell>
                  <TableCell>{b.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{b.tipo_bateria || "—"}</Badge></TableCell>
                  <TableCell>{b.energia_kwh ? `${b.energia_kwh} kWh` : "—"}</TableCell>
                  <TableCell>{b.tensao_nominal_v ? `${b.tensao_nominal_v}V` : "—"}</TableCell>
                  <TableCell>
                    <Switch checked={b.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: b.id, ativo: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(b)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(b)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editing ? "Editar Bateria" : "Nova Bateria"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Fabricante *</Label>
                <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: UNIPOWER" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: UPLFP48-100 3U" />
              </div>
              <div className="space-y-1">
                <Label>Tipo Bateria</Label>
                <Input value={form.tipo_bateria} onChange={(e) => set("tipo_bateria", e.target.value)} placeholder="Baterias de Íon-Lítio" />
              </div>
              <div className="space-y-1">
                <Label>Energia (kWh)</Label>
                <Input type="number" step="0.1" value={form.energia_kwh} onChange={(e) => set("energia_kwh", e.target.value)} placeholder="5" />
              </div>
              <div className="space-y-1">
                <Label>Dimensões (mm)</Label>
                <Input value={form.dimensoes_mm} onChange={(e) => set("dimensoes_mm", e.target.value)} placeholder="390x442x140mm" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Operação (V)</Label>
                <Input value={form.tensao_operacao_v} onChange={(e) => set("tensao_operacao_v", e.target.value)} placeholder="42 ~ 54" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Carga (V)</Label>
                <Input type="number" step="0.1" value={form.tensao_carga_v} onChange={(e) => set("tensao_carga_v", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Nominal (V)</Label>
                <Input type="number" value={form.tensao_nominal_v} onChange={(e) => set("tensao_nominal_v", e.target.value)} placeholder="48" />
              </div>
              <div className="space-y-1">
                <Label>Potência Máx. Saída (kW)</Label>
                <Input type="number" step="0.1" value={form.potencia_max_saida_kw} onChange={(e) => set("potencia_max_saida_kw", e.target.value)} placeholder="0" />
              </div>
              <div className="space-y-1">
                <Label>Corrente Máx. Descarga (A)</Label>
                <Input type="number" value={form.corrente_max_descarga_a} onChange={(e) => set("corrente_max_descarga_a", e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1">
                <Label>Corrente Máx. Carga (A)</Label>
                <Input type="number" value={form.corrente_max_carga_a} onChange={(e) => set("corrente_max_carga_a", e.target.value)} placeholder="100" />
              </div>
              <div className="space-y-1">
                <Label>Correntes Recomendadas (A)</Label>
                <Input value={form.correntes_recomendadas_a} onChange={(e) => set("correntes_recomendadas_a", e.target.value)} placeholder="Opcional" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Bateria</AlertDialogTitle>
              <AlertDialogDescription>
                Excluir "{deleting?.fabricante} {deleting?.modelo}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90"
                onClick={() => deleting && deleteMutation.mutate(deleting.id)}>
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
