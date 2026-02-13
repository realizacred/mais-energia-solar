import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, SunMedium, Globe, Building2 } from "lucide-react";
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
import { LoadingState } from "@/components/ui-kit/LoadingState";

interface Modulo {
  id: string;
  fabricante: string;
  modelo: string;
  potencia_wp: number;
  tipo_celula: string;
  eficiencia_percent: number | null;
  comprimento_mm: number | null;
  largura_mm: number | null;
  peso_kg: number | null;
  garantia_produto_anos: number | null;
  garantia_performance_anos: number | null;
  voc_v: number | null;
  isc_a: number | null;
  vmp_v: number | null;
  imp_a: number | null;
  ativo: boolean;
  tenant_id: string | null;
}

const EMPTY_FORM = {
  fabricante: "", modelo: "", potencia_wp: "", tipo_celula: "Mono PERC",
  eficiencia_percent: "", comprimento_mm: "", largura_mm: "", peso_kg: "",
  garantia_produto_anos: "12", garantia_performance_anos: "25",
  vmp_v: "", imp_a: "", voc_v: "", isc_a: "",
};

export function ModulosManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [filterFabricante, setFilterFabricante] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Modulo | null>(null);
  const [deleting, setDeleting] = useState<Modulo | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: modulos = [], isLoading } = useQuery({
    queryKey: ["modulos-solares"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modulos_solares")
        .select("*")
        .order("fabricante")
        .order("potencia_wp", { ascending: false });
      if (error) throw error;
      return data as Modulo[];
    },
  });

  const fabricantes = useMemo(() => {
    const set = new Set(modulos.map((m) => m.fabricante));
    return Array.from(set).sort();
  }, [modulos]);

  const filtered = modulos.filter((m) => {
    const matchSearch = !search ||
      `${m.fabricante} ${m.modelo} ${m.tipo_celula}`.toLowerCase().includes(search.toLowerCase());
    const matchAtivo = filterAtivo === "all" || (filterAtivo === "ativo" ? m.ativo : !m.ativo);
    const matchFab = filterFabricante === "all" || m.fabricante === filterFabricante;
    return matchSearch && matchAtivo && matchFab;
  });

  const isGlobal = (m: Modulo) => m.tenant_id === null;

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      if (editing) {
        const { error } = await supabase.from("modulos_solares").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("modulos_solares").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modulos-solares"] });
      toast({ title: editing ? "Módulo atualizado" : "Módulo cadastrado" });
      setDialogOpen(false);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("modulos_solares").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["modulos-solares"] });
      toast({ title: "Módulo excluído" });
      setDeleting(null);
    },
    onError: (err: any) => toast({ title: "Erro", description: err.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("modulos_solares").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["modulos-solares"] }),
  });

  const openDialog = (m?: Modulo) => {
    if (m) {
      setEditing(m);
      setForm({
        fabricante: m.fabricante, modelo: m.modelo,
        potencia_wp: String(m.potencia_wp),
        tipo_celula: m.tipo_celula || "Mono PERC",
        eficiencia_percent: m.eficiencia_percent ? String(m.eficiencia_percent) : "",
        comprimento_mm: m.comprimento_mm ? String(m.comprimento_mm) : "",
        largura_mm: m.largura_mm ? String(m.largura_mm) : "",
        peso_kg: m.peso_kg ? String(m.peso_kg) : "",
        garantia_produto_anos: m.garantia_produto_anos ? String(m.garantia_produto_anos) : "12",
        garantia_performance_anos: m.garantia_performance_anos ? String(m.garantia_performance_anos) : "25",
        vmp_v: m.vmp_v ? String(m.vmp_v) : "",
        imp_a: m.imp_a ? String(m.imp_a) : "",
        voc_v: m.voc_v ? String(m.voc_v) : "",
        isc_a: m.isc_a ? String(m.isc_a) : "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.fabricante.trim() || !form.modelo.trim() || !form.potencia_wp) {
      toast({ title: "Preencha fabricante, modelo e potência", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      fabricante: form.fabricante.trim(),
      modelo: form.modelo.trim(),
      potencia_wp: parseInt(form.potencia_wp),
      tipo_celula: form.tipo_celula || "Mono PERC",
      eficiencia_percent: form.eficiencia_percent ? parseFloat(form.eficiencia_percent) : null,
      comprimento_mm: form.comprimento_mm ? parseInt(form.comprimento_mm) : null,
      largura_mm: form.largura_mm ? parseInt(form.largura_mm) : null,
      peso_kg: form.peso_kg ? parseFloat(form.peso_kg) : null,
      garantia_produto_anos: form.garantia_produto_anos ? parseInt(form.garantia_produto_anos) : null,
      garantia_performance_anos: form.garantia_performance_anos ? parseInt(form.garantia_performance_anos) : null,
      vmp_v: form.vmp_v ? parseFloat(form.vmp_v) : null,
      imp_a: form.imp_a ? parseFloat(form.imp_a) : null,
      voc_v: form.voc_v ? parseFloat(form.voc_v) : null,
      isc_a: form.isc_a ? parseFloat(form.isc_a) : null,
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
            {modulos.length} módulos cadastrados ({fabricantes.length} fabricantes).
            Registros globais são compartilhados — adicione customizados para sua empresa.
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
            <Input placeholder="Buscar fabricante, modelo..." className="pl-9"
              value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterFabricante} onValueChange={setFilterFabricante}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Fabricante" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os fabricantes</SelectItem>
              {fabricantes.map((f) => (
                <SelectItem key={f} value={f}>{f}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
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
                <TableHead>Tipo</TableHead>
                <TableHead>Eficiência</TableHead>
                <TableHead>Garantia</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="py-8"><LoadingState message="Carregando módulos..." /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Nenhum módulo encontrado.
                </TableCell></TableRow>
              ) : filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">{m.fabricante}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.modelo}</TableCell>
                  <TableCell><Badge variant="outline">{m.potencia_wp}W</Badge></TableCell>
                  <TableCell className="text-xs">{m.tipo_celula}</TableCell>
                  <TableCell>{m.eficiencia_percent ? `${m.eficiencia_percent}%` : "—"}</TableCell>
                  <TableCell className="text-xs">
                    {m.garantia_produto_anos && m.garantia_performance_anos
                      ? `${m.garantia_produto_anos}/${m.garantia_performance_anos}a`
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {isGlobal(m) ? (
                      <Badge variant="secondary" className="gap-1 text-xs">
                        <Globe className="w-3 h-3" /> Global
                      </Badge>
                    ) : (
                      <Badge variant="default" className="gap-1 text-xs">
                        <Building2 className="w-3 h-3" /> Custom
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={m.ativo}
                      disabled={isGlobal(m)}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: m.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {isGlobal(m) ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(m)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(m)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
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
                <Input value={form.fabricante} onChange={(e) => set("fabricante", e.target.value)} placeholder="Ex: Canadian Solar" />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Modelo *</Label>
                <Input value={form.modelo} onChange={(e) => set("modelo", e.target.value)} placeholder="Ex: CS7N-665MS" />
              </div>
              <div className="space-y-1">
                <Label>Potência (Wp) *</Label>
                <Input type="number" value={form.potencia_wp} onChange={(e) => set("potencia_wp", e.target.value)} placeholder="665" />
              </div>
              <div className="space-y-1">
                <Label>Tipo Célula</Label>
                <Select value={form.tipo_celula} onValueChange={(v) => set("tipo_celula", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mono PERC">Mono PERC</SelectItem>
                    <SelectItem value="N-Type TOPCon">N-Type TOPCon</SelectItem>
                    <SelectItem value="N-Type HJT">N-Type HJT</SelectItem>
                    <SelectItem value="N-Type HPBC">N-Type HPBC</SelectItem>
                    <SelectItem value="Policristalino">Policristalino</SelectItem>
                    <SelectItem value="Bifacial">Bifacial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Eficiência (%)</Label>
                <Input type="number" step="0.01" value={form.eficiencia_percent} onChange={(e) => set("eficiencia_percent", e.target.value)} placeholder="22.50" />
              </div>
              <div className="space-y-1">
                <Label>Peso (kg)</Label>
                <Input type="number" step="0.1" value={form.peso_kg} onChange={(e) => set("peso_kg", e.target.value)} placeholder="37.0" />
              </div>
              <div className="space-y-1">
                <Label>Comprimento (mm)</Label>
                <Input type="number" value={form.comprimento_mm} onChange={(e) => set("comprimento_mm", e.target.value)} placeholder="2384" />
              </div>
              <div className="space-y-1">
                <Label>Largura (mm)</Label>
                <Input type="number" value={form.largura_mm} onChange={(e) => set("largura_mm", e.target.value)} placeholder="1303" />
              </div>
              <div className="space-y-1">
                <Label>Garantia Produto (anos)</Label>
                <Input type="number" value={form.garantia_produto_anos} onChange={(e) => set("garantia_produto_anos", e.target.value)} placeholder="12" />
              </div>
              <div className="space-y-1">
                <Label>Garantia Performance (anos)</Label>
                <Input type="number" value={form.garantia_performance_anos} onChange={(e) => set("garantia_performance_anos", e.target.value)} placeholder="25" />
              </div>
              <div className="space-y-1">
                <Label>Vmp (V)</Label>
                <Input type="number" step="0.01" value={form.vmp_v} onChange={(e) => set("vmp_v", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Imp (A)</Label>
                <Input type="number" step="0.01" value={form.imp_a} onChange={(e) => set("imp_a", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Voc (V)</Label>
                <Input type="number" step="0.01" value={form.voc_v} onChange={(e) => set("voc_v", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Isc (A)</Label>
                <Input type="number" step="0.01" value={form.isc_a} onChange={(e) => set("isc_a", e.target.value)} />
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
