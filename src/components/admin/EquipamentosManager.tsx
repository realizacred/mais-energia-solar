import { useState, useEffect } from "react";
import { Plus, Trash2, Pencil, Zap, CircuitBoard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [disjuntoresRes, transformadoresRes] = await Promise.all([
        supabase.from("disjuntores").select("*").order("amperagem", { ascending: true }),
        supabase.from("transformadores").select("*").order("potencia_kva", { ascending: true }),
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
  };

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

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipamentos</CardTitle>
      </CardHeader>
      <CardContent>
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amperagem (A)</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {disjuntores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum disjuntor cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  disjuntores.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.amperagem} A</TableCell>
                      <TableCell>{d.descricao || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={d.ativo}
                            onCheckedChange={() => handleToggleDisjuntorAtivo(d)}
                          />
                          <span className={`text-sm ${d.ativo ? "text-green-600" : "text-muted-foreground"}`}>
                            {d.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openDisjuntorDialog(d)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingDisjuntor(d)}
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
          </TabsContent>

          {/* Transformadores Tab */}
          <TabsContent value="transformadores">
            <div className="flex justify-end mb-4">
              <Button onClick={() => openTransformadorDialog()} className="gap-2">
                <Plus className="w-4 h-4" />
                Novo Transformador
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Potência (kVA)</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transformadores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum transformador cadastrado
                    </TableCell>
                  </TableRow>
                ) : (
                  transformadores.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.potencia_kva} kVA</TableCell>
                      <TableCell>{t.descricao || "-"}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={t.ativo}
                            onCheckedChange={() => handleToggleTransformadorAtivo(t)}
                          />
                          <span className={`text-sm ${t.ativo ? "text-green-600" : "text-muted-foreground"}`}>
                            {t.ativo ? "Ativo" : "Inativo"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openTransformadorDialog(t)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingTransformador(t)}
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
          </TabsContent>
        </Tabs>

        {/* Disjuntor Dialog */}
        <Dialog open={disjuntorDialogOpen} onOpenChange={setDisjuntorDialogOpen}>
          <DialogContent>
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
              <Button variant="outline" onClick={() => setDisjuntorDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveDisjuntor}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transformador Dialog */}
        <Dialog open={transformadorDialogOpen} onOpenChange={setTransformadorDialogOpen}>
          <DialogContent>
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
              <Button variant="outline" onClick={() => setTransformadorDialogOpen(false)}>
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
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
