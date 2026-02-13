import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical, AlertTriangle } from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Spinner } from "@/components/ui-kit/Spinner";

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

// Statuses used internally by the system – cannot be deleted
const SYSTEM_STATUS_NAMES = [
  "Aguardando Documentação",
  "Aguardando Validação",
];

export function LeadStatusManager() {
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<LeadStatus | null>(null);
  const [statusToDelete, setStatusToDelete] = useState<LeadStatus | null>(null);

  // Form state
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#3b82f6");

  const fetchStatuses = async () => {
    try {
      const { data, error } = await supabase
        .from("lead_status")
        .select("*")
        .order("ordem");

      if (error) throw error;
      setStatuses(data || []);
    } catch (error) {
      console.error("Error loading statuses:", error);
      toast({ title: "Erro ao carregar status", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const openCreate = () => {
    setEditingStatus(null);
    setNome("");
    setCor("#3b82f6");
    setDialogOpen(true);
  };

  const openEdit = (status: LeadStatus) => {
    setEditingStatus(status);
    setNome(status.nome);
    setCor(status.cor);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast({ title: "Nome é obrigatório", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      if (editingStatus) {
        const { error } = await supabase
          .from("lead_status")
          .update({ nome: nome.trim(), cor })
          .eq("id", editingStatus.id);

        if (error) throw error;
        toast({ title: "Status atualizado!" });
      } else {
        // Get next order
        const nextOrdem = statuses.length > 0
          ? Math.max(...statuses.map(s => s.ordem)) + 1
          : 1;

        const { error } = await supabase
          .from("lead_status")
          .insert({ nome: nome.trim(), cor, ordem: nextOrdem });

        if (error) throw error;
        toast({ title: "Status criado!" });
      }

      setDialogOpen(false);
      fetchStatuses();
    } catch (error: any) {
      console.error("Error saving status:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (status: LeadStatus) => {
    setStatusToDelete(status);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!statusToDelete) return;

    setSaving(true);
    try {
      // First check if any leads use this status
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status_id", statusToDelete.id);

      if (count && count > 0) {
        toast({
          title: "Não é possível excluir",
          description: `Existem ${count} lead(s) usando este status. Mova-os para outro status antes de excluir.`,
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from("lead_status")
        .delete()
        .eq("id", statusToDelete.id);

      if (error) throw error;

      toast({ title: "Status excluído!" });
      setDeleteDialogOpen(false);
      setStatusToDelete(null);
      fetchStatuses();
    } catch (error: any) {
      console.error("Error deleting status:", error);
      toast({
        title: "Erro ao excluir",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const isSystemStatus = (nome: string) =>
    SYSTEM_STATUS_NAMES.includes(nome);

  if (loading) {
    return <InlineLoader context="data_load" />;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle>Status de Leads</CardTitle>
              <CardDescription>
                Gerencie os status disponíveis no funil de vendas. Status com ícone de
                alerta são usados internamente pelo sistema e não podem ser excluídos.
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm" className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" />
              Novo Status
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead className="w-24">Cor</TableHead>
                <TableHead className="w-32 text-center">Sistema</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statuses.map((status) => (
                <TableRow key={status.id}>
                  <TableCell className="text-muted-foreground text-xs">
                    {status.ordem}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: status.cor }}
                      />
                      <span className="font-medium">{status.nome}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className="text-xs font-mono"
                      style={{ borderColor: status.cor, color: status.cor }}
                    >
                      {status.cor}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {isSystemStatus(status.nome) && (
                      <AlertTriangle className="h-4 w-4 text-warning mx-auto" />
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(status)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {!isSystemStatus(status.nome) && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => confirmDelete(status)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {statuses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Nenhum status cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingStatus ? "Editar Status" : "Novo Status"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="status-nome">Nome</Label>
              <Input
                id="status-nome"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Em Negociação"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status-cor">Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="status-cor"
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                />
                <Input
                  value={cor}
                  onChange={(e) => setCor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1 font-mono text-sm"
                />
                <span
                  className="px-3 py-1 rounded-full text-xs text-white font-medium"
                  style={{ backgroundColor: cor }}
                >
                  Preview
                </span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner size="sm" className="mr-2" />}
              {editingStatus ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excluir Status</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja excluir o status{" "}
            <strong>{statusToDelete?.nome}</strong>? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving && <Spinner size="sm" className="mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
