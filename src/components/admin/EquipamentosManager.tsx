import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Pencil, Zap, CircuitBoard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui-kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

interface Disjuntor {
  id: string;
  amperagem: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

interface Transformador {
  id: string;
  potencia_kva: number;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
}

export function EquipamentosManager() {
  const { toast } = useToast();
  const [disjuntores, setDisjuntores] = useState<Disjuntor[]>([]);
  const [transformadores, setTransformadores] = useState<Transformador[]>([]);
  const [loading, setLoading] = useState(true);

  // Disjuntor state
  const [disjuntorDialogOpen, setDisjuntorDialogOpen] = useState(false);
  const [editingDisjuntor, setEditingDisjuntor] = useState<Disjuntor | null>(null);
  const [disjuntorForm, setDisjuntorForm] = useState({ amperagem: "", descricao: "" });
  const [deletingDisjuntor, setDeletingDisjuntor] = useState<Disjuntor | null>(null);

  // Transformador state
  const [transformadorDialogOpen, setTransformadorDialogOpen] = useState(false);
  const [editingTransformador, setEditingTransformador] = useState<Transformador | null>(null);
  const [transformadorForm, setTransformadorForm] = useState({ potencia_kva: "", descricao: "" });
  const [deletingTransformador, setDeletingTransformador] = useState<Transformador | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [disjuntoresRes, transformadoresRes] = await Promise.all([
        supabase.from("disjuntores").select("id, amperagem, descricao, ativo, created_at, updated_at").order("amperagem", { ascending: true }),
        supabase.from("transformadores").select("id, potencia_kva, descricao, ativo, created_at, updated_at").order("potencia_kva", { ascending: true }),
      ]);

      if (disjuntoresRes.error) throw disjuntoresRes.error;
      if (transformadoresRes.error) throw transformadoresRes.error;

      setDisjuntores(disjuntoresRes.data || []);
      setTransformadores(transformadoresRes.data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar equipamentos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Disjuntor handlers
  const openDisjuntorDialog = (disjuntor?: Disjuntor) => {
    if (disjuntor) {
      setEditingDisjuntor(disjuntor);
      setDisjuntorForm({
        amperagem: disjuntor.amperagem.toString(),
        descricao: disjuntor.descricao || "",
      });
    } else {
      setEditingDisjuntor(null);
      setDisjuntorForm({ amperagem: "", descricao: "" });
    }
    setDisjuntorDialogOpen(true);
  };

  const handleSaveDisjuntor = async () => {
    const amperagem = parseInt(disjuntorForm.amperagem);
    if (!amperagem || amperagem <= 0) {
      toast({ title: "Informe uma amperagem válida", variant: "destructive" });
      return;
    }

    try {
      if (editingDisjuntor) {
        const { error } = await supabase
          .from("disjuntores")
          .update({ amperagem, descricao: disjuntorForm.descricao || null })
          .eq("id", editingDisjuntor.id);
        if (error) throw error;
        toast({ title: "Disjuntor atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("disjuntores")
          .insert({ amperagem, descricao: disjuntorForm.descricao || null });
        if (error) throw error;
        toast({ title: "Disjuntor cadastrado com sucesso" });
      }
      setDisjuntorDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleDisjuntorAtivo = async (disjuntor: Disjuntor) => {
    try {
      const { error } = await supabase
        .from("disjuntores")
        .update({ ativo: !disjuntor.ativo })
        .eq("id", disjuntor.id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteDisjuntor = async () => {
    if (!deletingDisjuntor) return;
    try {
      const { error } = await supabase
        .from("disjuntores")
        .delete()
        .eq("id", deletingDisjuntor.id);
      if (error) throw error;
      toast({ title: "Disjuntor excluído" });
      setDeletingDisjuntor(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  // Transformador handlers
  const openTransformadorDialog = (transformador?: Transformador) => {
    if (transformador) {
      setEditingTransformador(transformador);
      setTransformadorForm({
        potencia_kva: transformador.potencia_kva.toString(),
        descricao: transformador.descricao || "",
      });
    } else {
      setEditingTransformador(null);
      setTransformadorForm({ potencia_kva: "", descricao: "" });
    }
    setTransformadorDialogOpen(true);
  };

  const handleSaveTransformador = async () => {
    const potencia_kva = parseFloat(transformadorForm.potencia_kva);
    if (!potencia_kva || potencia_kva <= 0) {
      toast({ title: "Informe uma potência válida", variant: "destructive" });
      return;
    }

    try {
      if (editingTransformador) {
        const { error } = await supabase
          .from("transformadores")
          .update({ potencia_kva, descricao: transformadorForm.descricao || null })
          .eq("id", editingTransformador.id);
        if (error) throw error;
        toast({ title: "Transformador atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("transformadores")
          .insert({ potencia_kva, descricao: transformadorForm.descricao || null });
        if (error) throw error;
        toast({ title: "Transformador cadastrado com sucesso" });
      }
      setTransformadorDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleTransformadorAtivo = async (transformador: Transformador) => {
    try {
      const { error } = await supabase
        .from("transformadores")
        .update({ ativo: !transformador.ativo })
        .eq("id", transformador.id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteTransformador = async () => {
    if (!deletingTransformador) return;
    try {
      const { error } = await supabase
        .from("transformadores")
        .delete()
        .eq("id", deletingTransformador.id);
      if (error) throw error;
      toast({ title: "Transformador excluído" });
      setDeletingTransformador(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const SkeletonRows = () => (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-5 w-16 rounded-md" /></TableCell>
          <TableCell><Skeleton className="h-4 w-32" /></TableCell>
          <TableCell><Skeleton className="h-5 w-10 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
        </TableRow>
      ))}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={CircuitBoard}
        title="Equipamentos"
        description="Gerencie disjuntores e transformadores cadastrados"
      />

      <Tabs defaultValue="disjuntores">
        <TabsList className="mb-4">
          <TabsTrigger value="disjuntores" className="gap-2">
            <CircuitBoard className="w-4 h-4" />
            Disjuntores
          </TabsTrigger>
          <TabsTrigger value="transformadores" className="gap-2">
            <Zap className="w-4 h-4" />
            Transformadores
          </TabsTrigger>
        </TabsList>

        {/* Disjuntores Tab */}
        <TabsContent value="disjuntores">
          <div className="flex justify-end mb-4">
            <Button onClick={() => openDisjuntorDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Disjuntor
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Amperagem</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows />
                ) : disjuntores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                          <CircuitBoard className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">Nenhum disjuntor cadastrado</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">Cadastre um novo disjuntor para começar.</p>
                        <Button onClick={() => openDisjuntorDialog()} className="gap-2">
                          <Plus className="w-4 h-4" /> Novo Disjuntor
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  disjuntores.map((d) => (
                    <TableRow key={d.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                          {d.amperagem} A
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{d.descricao || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={d.ativo}
                            onCheckedChange={() => handleToggleDisjuntorAtivo(d)}
                          />
                          <Badge variant="outline" className={d.ativo
                            ? "bg-success/10 text-success border-success/20 text-xs"
                            : "bg-muted text-muted-foreground border-border text-xs"
                          }>
                            {d.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDisjuntorDialog(d)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingDisjuntor(d)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Transformadores Tab */}
        <TabsContent value="transformadores">
          <div className="flex justify-end mb-4">
            <Button onClick={() => openTransformadorDialog()} className="gap-2">
              <Plus className="w-4 h-4" />
              Novo Transformador
            </Button>
          </div>

          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Potência</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <SkeletonRows />
                ) : transformadores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-16">
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                          <Zap className="h-7 w-7 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-1">Nenhum transformador cadastrado</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mb-4">Cadastre um novo transformador para começar.</p>
                        <Button onClick={() => openTransformadorDialog()} className="gap-2">
                          <Plus className="w-4 h-4" /> Novo Transformador
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  transformadores.map((t) => (
                    <TableRow key={t.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-medium">
                          {t.potencia_kva} kVA
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{t.descricao || "—"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.ativo}
                            onCheckedChange={() => handleToggleTransformadorAtivo(t)}
                          />
                          <Badge variant="outline" className={t.ativo
                            ? "bg-success/10 text-success border-success/20 text-xs"
                            : "bg-muted text-muted-foreground border-border text-xs"
                          }>
                            {t.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openTransformadorDialog(t)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeletingTransformador(t)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Disjuntor Dialog */}
      <Dialog open={disjuntorDialogOpen} onOpenChange={setDisjuntorDialogOpen}>
         <DialogContent className="w-[90vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingDisjuntor ? "Editar Disjuntor" : "Novo Disjuntor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="amperagem">Amperagem (A) *</Label>
              <Input
                id="amperagem"
                type="number"
                placeholder="Ex: 32"
                value={disjuntorForm.amperagem}
                onChange={(e) =>
                  setDisjuntorForm({ ...disjuntorForm, amperagem: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao-disjuntor">Descrição (opcional)</Label>
              <Textarea
                id="descricao-disjuntor"
                placeholder="Ex: Disjuntor bipolar"
                value={disjuntorForm.descricao}
                onChange={(e) =>
                  setDisjuntorForm({ ...disjuntorForm, descricao: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDisjuntorDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDisjuntor}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transformador Dialog */}
      <Dialog open={transformadorDialogOpen} onOpenChange={setTransformadorDialogOpen}>
        <DialogContent className="w-[90vw] max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTransformador ? "Editar Transformador" : "Novo Transformador"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="potencia_kva">Potência (kVA) *</Label>
              <Input
                id="potencia_kva"
                type="number"
                step="0.1"
                placeholder="Ex: 15"
                value={transformadorForm.potencia_kva}
                onChange={(e) =>
                  setTransformadorForm({ ...transformadorForm, potencia_kva: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao-transformador">Descrição (opcional)</Label>
              <Textarea
                id="descricao-transformador"
                placeholder="Ex: Transformador trifásico"
                value={transformadorForm.descricao}
                onChange={(e) =>
                  setTransformadorForm({ ...transformadorForm, descricao: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransformadorDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveTransformador}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Disjuntor Confirmation */}
      <AlertDialog open={!!deletingDisjuntor} onOpenChange={() => setDeletingDisjuntor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Disjuntor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O disjuntor de {deletingDisjuntor?.amperagem}A será
              removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDisjuntor}
              className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Transformador Confirmation */}
      <AlertDialog
        open={!!deletingTransformador}
        onOpenChange={() => setDeletingTransformador(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transformador?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O transformador de{" "}
              {deletingTransformador?.potencia_kva} kVA será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTransformador}
              className="border-destructive text-destructive hover:bg-destructive/10 border bg-transparent"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
