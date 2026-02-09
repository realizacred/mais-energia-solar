import { useState } from "react";
import { Plus, Pencil, Trash2, Search, Cpu } from "lucide-react";
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

type TipoSistema = "ON_GRID" | "HIBRIDO" | "OFF_GRID";

interface Inversor {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_nominal_w: number;
  potencia_maxima_w: number | null;
  mppts: number | null;
  tensao_max_v: number | null;
  tensao_min_mppt_v: number | null;
  tensao_max_mppt_v: number | null;
  corrente_max_mppt_a: number | null;
  tensao_linha_v: number | null;
  eficiencia_percent: string | null;
  tipo_sistema: TipoSistema;
  ativo: boolean;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_nominal_w: "", potencia_maxima_w: "",
  mppts: "", tensao_max_v: "", tensao_min_mppt_v: "", tensao_max_mppt_v: "",
  corrente_max_mppt_a: "", tensao_linha_v: "", eficiencia_percent: "",
  tipo_sistema: "ON_GRID" as TipoSistema,
};

const TIPO_LABELS: Record<TipoSistema, string> = {
  ON_GRID: "On-Grid",
  HIBRIDO: "Híbrido",
  OFF_GRID: "Off-Grid",
};

export function InversoresManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Inversor | null>(null);
  const [deleting, setDeleting] = useState<Inversor | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: inversores = [], isLoading } = useQuery({
    queryKey: ["inversores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inversores")
        .select("*")
        .order("fabricante")
        .order("modelo");
      if (error) throw error;
      return data as Inversor[];
    },
  });

  const filtered = inversores.filter((i) => {
    const matchSearch = !search ||
      `${i.fabricante} ${i.modelo}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? i.ativo : !i.ativo);
    return matchSearch && matchAtivo;
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("inversores").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("inversores").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inversores"] });
      toast({ title: editing ? "Inversor atualizado" : "Inversor cadastrado" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("inversores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inversores"] });
      toast({ title: "Inversor excluído" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("inversores").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inversores"] }),
  });

  const openDialog = (inv?: Inversor) => {
    if (inv) {
      setEditing(inv);
      setForm({
        fabricante: inv.fabricante, modelo: inv.modelo,
        potencia_nominal_w: String(inv.potencia_nominal_w),
        potencia_maxima_w: inv.potencia_maxima_w ? String(inv.potencia_maxima_w) : "",
        mppts: inv.mppts ? String(inv.mppts) : "",
        tensao_max_v: inv.tensao_max_v ? String(inv.tensao_max_v) : "",
        tensao_min_mppt_v: inv.tensao_min_mppt_v ? String(inv.tensao_min_mppt_v) : "",
        tensao_max_mppt_v: inv.tensao_max_mppt_v ? String(inv.tensao_max_mppt_v) : "",
        corrente_max_mppt_a: inv.corrente_max_mppt_a ? String(inv.corrente_max_mppt_a) : "",
        tensao_linha_v: inv.tensao_linha_v ? String(inv.tensao_linha_v) : "",
        eficiencia_percent: inv.eficiencia_percent || "",
        tipo_sistema: inv.tipo_sistema,
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim() || !form.potencia_nominal_w) {
      toast({ title: "Preencha fabricante, modelo e potência nominal", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      potencia_nominal_w: parseFloat(form.potencia_nominal_w),
      potencia_maxima_w: form.potencia_maxima_w ? parseFloat(form.potencia_maxima_w) : null,
      mppts: form.mppts ? parseInt(form.mppts) : null,
      tensao_max_v: form.tensao_max_v ? parseFloat(form.tensao_max_v) : null,
      tensao_min_mppt_v: form.tensao_min_mppt_v ? parseFloat(form.tensao_min_mppt_v) : null,
      tensao_max_mppt_v: form.tensao_max_mppt_v ? parseFloat(form.tensao_max_mppt_v) : null,
      corrente_max_mppt_a: form.corrente_max_mppt_a ? parseFloat(form.corrente_max_mppt_a) : null,
      tensao_linha_v: form.tensao_linha_v ? parseFloat(form.tensao_linha_v) : null,
      eficiencia_percent: form.eficiencia_percent || null,
      tipo_sistema: form.tipo_sistema,
    });
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  const formatPotencia = (w: number) => w >= 1000 ? `${(w / 1000).toFixed(1)} kW` : `${w} W`;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5" /> Inversores
          </CardTitle>
          <CardDescription className="mt-1">
            Cadastro de inversores solares com dados elétricos e MPPT.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Inversor
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
                <TableHead>Potência</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>MPPTs</TableHead>
                <TableHead>Eficiência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Nenhum inversor encontrado.
                </TableCell></TableRow>
              ) : filtered.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-medium">{inv.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{inv.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{formatPotencia(inv.potencia_nominal_w)}</Badge></TableCell>
                  <TableCell><Badge variant="secondary">{TIPO_LABELS[inv.tipo_sistema]}</Badge></TableCell>
                  <TableCell>{inv.mppts || "—"}</TableCell>
                  <TableCell>{inv.eficiencia_percent || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={inv.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: inv.id, ativo: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(inv)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(inv)}>
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
              <DialogTitle>{editing ? "Editar Inversor" : "Novo Inversor"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Fabricante *</Label>
                <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: ABB" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: ABB PRO 33.0-TL..." />
              </div>
              <div className="space-y-1">
                <Label>Potência Nominal (W) *</Label>
                <Input type="number" value={form.potencia_nominal_w} onChange={(e) => set("potencia_nominal_w", e.target.value)} placeholder="33000" />
              </div>
              <div className="space-y-1">
                <Label>Potência Máxima (W)</Label>
                <Input type="number" value={form.potencia_maxima_w} onChange={(e) => set("potencia_maxima_w", e.target.value)} placeholder="33000" />
              </div>
              <div className="space-y-1">
                <Label>Tipo Sistema *</Label>
                <Select value={form.tipo_sistema} onValueChange={(v) => set("tipo_sistema", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ON_GRID">On-Grid</SelectItem>
                    <SelectItem value="HIBRIDO">Híbrido</SelectItem>
                    <SelectItem value="OFF_GRID">Off-Grid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>MPPTs</Label>
                <Input type="number" value={form.mppts} onChange={(e) => set("mppts", e.target.value)} placeholder="1" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Máx. (V)</Label>
                <Input type="number" value={form.tensao_max_v} onChange={(e) => set("tensao_max_v", e.target.value)} placeholder="1100" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Mín. MPPT (V)</Label>
                <Input type="number" value={form.tensao_min_mppt_v} onChange={(e) => set("tensao_min_mppt_v", e.target.value)} placeholder="580" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Máx. MPPT (V)</Label>
                <Input type="number" value={form.tensao_max_mppt_v} onChange={(e) => set("tensao_max_mppt_v", e.target.value)} placeholder="950" />
              </div>
              <div className="space-y-1">
                <Label>Corrente Máx. MPPT (A)</Label>
                <Input type="number" value={form.corrente_max_mppt_a} onChange={(e) => set("corrente_max_mppt_a", e.target.value)} placeholder="80" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Linha (V)</Label>
                <Input type="number" value={form.tensao_linha_v} onChange={(e) => set("tensao_linha_v", e.target.value)} placeholder="380" />
              </div>
              <div className="space-y-1">
                <Label>Eficiência (%)</Label>
                <Input value={form.eficiencia_percent} onChange={(e) => set("eficiencia_percent", e.target.value)} placeholder="98,30%" />
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
              <AlertDialogTitle>Excluir Inversor</AlertDialogTitle>
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
