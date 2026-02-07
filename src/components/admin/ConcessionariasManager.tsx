import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Building, Search, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  ativo: boolean;
  created_at: string;
}

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

export function ConcessionariasManager() {
  const { toast } = useToast();
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Concessionaria | null>(null);
  const [deleting, setDeleting] = useState<Concessionaria | null>(null);
  const [form, setForm] = useState({ nome: "", sigla: "", estado: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("concessionarias")
        .select("*")
        .order("estado", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      setConcessionarias(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar concessionárias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (concessionaria?: Concessionaria) => {
    if (concessionaria) {
      setEditing(concessionaria);
      setForm({
        nome: concessionaria.nome,
        sigla: concessionaria.sigla || "",
        estado: concessionaria.estado || "",
      });
    } else {
      setEditing(null);
      setForm({ nome: "", sigla: "", estado: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome da concessionária", variant: "destructive" });
      return;
    }

    try {
      const payload = {
        nome: form.nome.trim(),
        sigla: form.sigla.trim() || null,
        estado: form.estado || null,
      };

      if (editing) {
        const { error } = await supabase
          .from("concessionarias")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Concessionária atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from("concessionarias")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Concessionária cadastrada com sucesso" });
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleAtivo = async (concessionaria: Concessionaria) => {
    try {
      const { error } = await supabase
        .from("concessionarias")
        .update({ ativo: !concessionaria.ativo })
        .eq("id", concessionaria.id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase
        .from("concessionarias")
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Concessionária excluída" });
      setDeleting(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const filteredConcessionarias = concessionarias.filter(c => {
    const matchesSearch = searchTerm === "" || 
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.sigla && c.sigla.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = filterEstado === "all" || c.estado === filterEstado;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "ativo" && c.ativo) || 
      (filterStatus === "inativo" && !c.ativo);
    return matchesSearch && matchesEstado && matchesStatus;
  });

  const hasActiveFilters = filterEstado !== "all" || filterStatus !== "all" || searchTerm !== "";
  
  const clearFilters = () => {
    setSearchTerm("");
    setFilterEstado("all");
    setFilterStatus("all");
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Building className="w-5 h-5" />
          Concessionárias de Energia
        </CardTitle>
        <Button onClick={() => openDialog()} className="gap-2">
          <Plus className="w-4 h-4" />
          Nova Concessionária
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4 mb-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou sigla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Filtros:</span>
            </div>

            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                {ESTADOS_BRASIL.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpar filtros
              </Button>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredConcessionarias.length} concessionária(s)
            </span>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Sigla</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConcessionarias.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  Nenhuma concessionária encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredConcessionarias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nome}</TableCell>
                  <TableCell>{c.sigla || "-"}</TableCell>
                  <TableCell>
                    {c.estado ? (
                      <Badge variant="outline">{c.estado}</Badge>
                    ) : "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={c.ativo}
                        onCheckedChange={() => handleToggleAtivo(c)}
                      />
                      <span className={`text-sm ${c.ativo ? "text-green-600" : "text-muted-foreground"}`}>
                        {c.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openDialog(c)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(c)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editing ? "Editar Concessionária" : "Nova Concessionária"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome *</Label>
                <Input
                  id="nome"
                  placeholder="Ex: Energisa Minas Gerais"
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sigla">Sigla</Label>
                <Input
                  id="sigla"
                  placeholder="Ex: Energisa-MG"
                  value={form.sigla}
                  onChange={(e) => setForm({ ...form, sigla: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="estado">Estado</Label>
                <Select value={form.estado} onValueChange={(v) => setForm({ ...form, estado: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o estado" />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADOS_BRASIL.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Concessionária?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A concessionária "{deleting?.nome}" será
                removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
