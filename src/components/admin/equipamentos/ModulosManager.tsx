import { useState } from "react";
import { Plus, Pencil, Trash2, Search, SunMedium } from "lucide-react";
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

interface Modulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_w: number;
  tipo_celula: string | null;
  numero_celulas: number | null;
  dimensoes_mm: string | null;
  tensao_sistema_v: number | null;
  vmp: number | null;
  imp: number | null;
  voc: number | null;
  isc: number | null;
  coef_temp: string | null;
  eficiencia_percent: string | null;
  ativo: boolean;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_w: "", tipo_celula: "", numero_celulas: "",
  dimensoes_mm: "", tensao_sistema_v: "", vmp: "", imp: "", voc: "", isc: "",
  coef_temp: "", eficiencia_percent: "",
};

export function ModulosManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Modulo | null>(null);
  const [deleting, setDeleting] = useState<Modulo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: modulos = [], isLoading } = useQuery({
    queryKey: ["modulos-fotovoltaicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos_fotovoltaicos")
        .select("*")
        .order("fabricante")
        .order("modelo");
      if (error) throw error;
      return data as Modulo[];
    },
  });

  const filtered = modulos.filter((m) => {
    const matchSearch = !search ||
      `${m.fabricante} ${m.modelo} ${m.tipo_celula || ""}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? m.ativo : !m.ativo);
    return matchSearch && matchAtivo;
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("modulos_fotovoltaicos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modulos_fotovoltaicos").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modulos-fotovoltaicos"] });
      toast({ title: editing ? "Módulo atualizado" : "Módulo cadastrado" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modulos_fotovoltaicos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modulos-fotovoltaicos"] });
      toast({ title: "Módulo excluído" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("modulos_fotovoltaicos").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modulos-fotovoltaicos"] }),
  });

  const openDialog = (m?: Modulo) => {
    if (m) {
      setEditing(m);
      setForm({
        fabricante: m.fabricante, modelo: m.modelo, potencia_w: String(m.potencia_w),
        tipo_celula: m.tipo_celula || "", numero_celulas: m.numero_celulas ? String(m.numero_celulas) : "",
        dimensoes_mm: m.dimensoes_mm || "", tensao_sistema_v: m.tensao_sistema_v ? String(m.tensao_sistema_v) : "",
        vmp: m.vmp ? String(m.vmp) : "", imp: m.imp ? String(m.imp) : "",
        voc: m.voc ? String(m.voc) : "", isc: m.isc ? String(m.isc) : "",
        coef_temp: m.coef_temp || "", eficiencia_percent: m.eficiencia_percent || "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim() || !form.potencia_w) {
      toast({ title: "Preencha fabricante, modelo e potência", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      potencia_w: parseFloat(form.potencia_w),
      tipo_celula: form.tipo_celula || null,
      numero_celulas: form.numero_celulas ? parseInt(form.numero_celulas) : null,
      dimensoes_mm: form.dimensoes_mm || null,
      tensao_sistema_v: form.tensao_sistema_v ? parseFloat(form.tensao_sistema_v) : null,
      vmp: form.vmp ? parseFloat(form.vmp) : null,
      imp: form.imp ? parseFloat(form.imp) : null,
      voc: form.voc ? parseFloat(form.voc) : null,
      isc: form.isc ? parseFloat(form.isc) : null,
      coef_temp: form.coef_temp || null,
      eficiencia_percent: form.eficiencia_percent || null,
    });
  };

  const set = (key: string, val: string) => setForm((p) => ({ ...p, [key]: val }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <SunMedium className="w-5 h-5" />
            Módulos Fotovoltaicos
          </CardTitle>
          <CardDescription className="mt-1">
            Cadastro de painéis solares com especificações técnicas completas.
          </CardDescription>
        </div>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Módulo
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por fabricante, modelo..." className="pl-9"
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

        {/* Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fabricante</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Potência</TableHead>
                <TableHead>Tipo Célula</TableHead>
                <TableHead>Eficiência</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Nenhum módulo encontrado.
                </TableCell></TableRow>
              ) : filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.fabricante}</TableCell>
                  <TableCell>{m.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{m.potencia_w}W</Badge></TableCell>
                  <TableCell>{m.tipo_celula || "—"}</TableCell>
                  <TableCell>{m.eficiencia_percent || "—"}</TableCell>
                  <TableCell>
                    <Switch checked={m.ativo} onCheckedChange={(v) => toggleMutation.mutate({ id: m.id, ativo: v })} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(m)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleting(m)}>
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
              <DialogTitle>{editing ? "Editar Módulo" : "Novo Módulo Fotovoltaico"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 sm:col-span-2">
                <Label>Fabricante *</Label>
                <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: AE SOLAR" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: AE340M6-72" />
              </div>
              <div className="space-y-1">
                <Label>Potência (W) *</Label>
                <Input type="number" value={form.potencia_w} onChange={(e) => set("potencia_w", e.target.value)} placeholder="340" />
              </div>
              <div className="space-y-1">
                <Label>Tipo Célula</Label>
                <Input value={form.tipo_celula} onChange={(e) => set("tipo_celula", e.target.value)} placeholder="MONOCRISTALINO" />
              </div>
              <div className="space-y-1">
                <Label>Nº Células</Label>
                <Input type="number" value={form.numero_celulas} onChange={(e) => set("numero_celulas", e.target.value)} placeholder="72" />
              </div>
              <div className="space-y-1">
                <Label>Dimensões (mm)</Label>
                <Input value={form.dimensoes_mm} onChange={(e) => set("dimensoes_mm", e.target.value)} placeholder="1956x992x40mm" />
              </div>
              <div className="space-y-1">
                <Label>Tensão Sistema (V)</Label>
                <Input type="number" value={form.tensao_sistema_v} onChange={(e) => set("tensao_sistema_v", e.target.value)} placeholder="1000" />
              </div>
              <div className="space-y-1">
                <Label>Eficiência (%)</Label>
                <Input value={form.eficiencia_percent} onChange={(e) => set("eficiencia_percent", e.target.value)} placeholder="17,52%" />
              </div>
              <div className="space-y-1">
                <Label>Vmp (V)</Label>
                <Input type="number" step="0.01" value={form.vmp} onChange={(e) => set("vmp", e.target.value)} placeholder="39.09" />
              </div>
              <div className="space-y-1">
                <Label>Imp (A)</Label>
                <Input type="number" step="0.01" value={form.imp} onChange={(e) => set("imp", e.target.value)} placeholder="8.7" />
              </div>
              <div className="space-y-1">
                <Label>Voc (V)</Label>
                <Input type="number" step="0.01" value={form.voc} onChange={(e) => set("voc", e.target.value)} placeholder="46.94" />
              </div>
              <div className="space-y-1">
                <Label>Isc (A)</Label>
                <Input type="number" step="0.01" value={form.isc} onChange={(e) => set("isc", e.target.value)} placeholder="9.48" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Coef. Temperatura</Label>
                <Input value={form.coef_temp} onChange={(e) => set("coef_temp", e.target.value)} placeholder="-0.0038 / -0.0029 / 0.0005" />
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

        {/* Delete */}
        <AlertDialog open={!!deleting} onOpenChange={(v) => !v && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Módulo</AlertDialogTitle>
              <AlertDialogDescription>
                Excluir "{deleting?.fabricante} {deleting?.modelo}"? Esta ação não pode ser desfeita.
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
